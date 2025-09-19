import { db } from '../lib/db/drizzle.js';
import { compositions, segments, captions, voices } from '../lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { renderMedia } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import { createWriteStream } from 'fs';
import fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import pkg from '@remotion/captions';
const { parseSrt, parseVtt } = pkg;
import { 
    generateCaptionsFromText, 
    parseSrtToCaptions, 
    parseVttToCaptions,
    validateCaptionTiming,
    autoCorrectCaptionTiming
} from '../utils/captionUtils.js';
import { 
    processCompositionWithAI,
    generateAIImage,
    generateTTS,
    uploadToR2
} from '../utils/cloudflareUtils.js';
import { generateImageFromPrompt } from '../actions/image-generation.js';
import { uploadImageFile } from '../actions/cloudflare.js';
import { getUserFromSession } from '../utils/session.js';
import { fetchVideoStylesByIds } from '../data/media-styles.js';
import { consola } from 'consola';

// Helper function to get dimensions based on aspect ratio
const getDimensions = (aspect) => {
    switch (aspect) {
        case '9:16':
            return { width: 1080, height: 1920 };
        case '16:9':
            return { width: 1920, height: 1080 };
        case '1:1':
            return { width: 1080, height: 1080 };
        default:
            return { width: 1080, height: 1920 };
    }
};

// This function returns default SDXL parameters if none are provided in the style record.
function getSdxlParams(styleRecord) {
    const defaultParams = {
        model: "flux-1-schnell",
        negative_prompt: "",
        height: 512,
        width: 512,
        num_steps: 20,
        guidance: 7.5,
        seed: 0,
    };
    if (!styleRecord || !styleRecord.sdxlParams) return defaultParams;
    return { ...defaultParams, ...styleRecord.sdxlParams };
}

// Create a new video composition
export const createVideoComposition = async (req, res) => {
    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({ 
                error: 'Not authenticated' 
            });
        }

        const { 
            script, 
            voice, 
            musicUrl, 
            aspect = '9:16', 
            videoStyleId, 
            imageGenerator,
            // Advanced audio options (model/format fixed internally)
            speakingRate = 15,
            language = 'en-us',
            emotionSettings = {},
            pitchStd = 45.0,
            duration = 30
        } = req.body;

        if (!script || !voice) {
            return res.status(400).json({ 
                error: 'Missing required fields: script, voice' 
            });
        }

        // Create composition as draft
        const [newComposition] = await db.insert(compositions).values({
            userId: user.id,
            script,
            voice,
            musicUrl,
            aspect,
            status: 'draft'
        }).returning();

        // Return the draft composition immediately - async generation will happen in edit page
        res.status(201).json({
            success: true,
            composition: {
                id: newComposition.id,
                status: 'draft',
                script,
                voice,
                aspect,
                videoStyleId,
                imageGenerator,
                speakingRate,
                language,
                emotionSettings,
                pitchStd
            }
        });

        return; // Exit early - no need to do full generation here

        // The following code will be moved to createVideoCompositionAsync
        // Generate TTS audio using Zyphra API (default model, mp3)
        let audioUrl = musicUrl;
        if (script && voice && !musicUrl) {
            try {
                console.log('Generating TTS...');

                // Prepare Zyphra API request body
                const zyphraRequestBody = {
                    text: script,
                    speaking_rate: speakingRate,
                    language_iso_code: language,
                    model: 'zonos-v0.1-transformer',
                    mime_type: 'audio/mpeg'
                };

                // Keep payload minimal to match Zyphra schema — no emotion or pitchStd

                // Add voice cloning if voice is provided
                if (voice && voice !== 'default') {
                    try {
                        // Fetch the voice from database
                        const [voiceRecord] = await db.select().from(voices).where(eq(voices.id, voice));
                        if (voiceRecord) {
                            console.log('Fetching voice file for cloning...');
                            const voiceResponse = await fetch(voiceRecord.voiceUrl, {
                                method: 'GET',
                                headers: {
                                    'X-API-Key': process.env.ZYPHRA_API_KEY || '',
                                },
                            });

                            if (voiceResponse.ok) {
                                const voiceArrayBuffer = await voiceResponse.arrayBuffer();
                                const speakerAudioBase64 = Buffer.from(voiceArrayBuffer).toString('base64');
                                zyphraRequestBody.speaker_audio = speakerAudioBase64;
                                console.log('Voice file fetched and added to request');
                            } else {
                                console.warn('Failed to fetch voice file, using default voice');
                            }
                        }
                    } catch (voiceError) {
                        console.warn('Error fetching voice for cloning:', voiceError.message);
                    }
                }

                // Make request to Zyphra API
                const zyphraResponse = await fetch('http://api.zyphra.com/v1/audio/text-to-speech', {
                    method: 'POST',
                    headers: {
                        'X-API-Key': process.env.ZYPHRA_API_KEY || '',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(zyphraRequestBody)
                });

                let finalResponse = zyphraResponse;

                // If validation failed, retry once with minimal payload (no emotion/pitch/speaker_audio)
                if (!finalResponse.ok && finalResponse.status === 422) {
                    try {
                        const errorBody = await finalResponse.text();
                        console.warn('Zyphra 422 body:', errorBody?.slice(0, 500));
                    } catch {}

                    const minimalBody = {
                        text: script,
                        speaking_rate: speakingRate,
                        language_iso_code: language,
                        model: 'zonos-v0.1-transformer',
                        mime_type: 'audio/mpeg'
                    };
                    finalResponse = await fetch('http://api.zyphra.com/v1/audio/text-to-speech', {
                        method: 'POST',
                        headers: {
                            'X-API-Key': process.env.ZYPHRA_API_KEY || '',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(minimalBody)
                    });
                }

                if (finalResponse.ok) {
                    const audioArrayBuffer = await finalResponse.arrayBuffer();
                    const audioBuffer = Buffer.from(audioArrayBuffer);
                    
                    // Upload to storage
                    const audioKey = `tts-audio/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
                    const uploadResult = await uploadToR2(audioBuffer, audioKey, 'audio/mp3');
                    audioUrl = uploadResult; // uploadToR2 returns a public URL string
                    console.log('✅ TTS generated and uploaded:', audioUrl);
                } else {
                    let body = '';
                    try { body = await finalResponse.text(); } catch {}
                    console.warn('Zyphra TTS generation failed:', finalResponse.status, body?.slice(0, 500));
                }
            } catch (error) {
                console.warn('TTS generation failed');
            }
        }
        
        // Log if Cloudflare AI is not configured
        if (!process.env.CLOUDFLARE_API_KEY || !process.env.CLOUDFLARE_ACCOUNT_ID) {
            console.log('Cloudflare AI not configured - using placeholder images and basic composition');
        }

        // Fetch video style guidelines if available
        let videoStyleRecord = null;
        if (videoStyleId) {
            console.log(`Fetching video style with ID: ${videoStyleId}`);
            const vsResults = await fetchVideoStylesByIds([videoStyleId]);
            if (vsResults.length > 0) {
                videoStyleRecord = vsResults[0];
                console.log(`Found video style: ${videoStyleRecord.name}`);
            }
        }
        let videoStyleGuidelines = "";
        if (videoStyleRecord && videoStyleRecord.prompts) {
            videoStyleGuidelines = Array.isArray(videoStyleRecord.prompts)
                ? videoStyleRecord.prompts.join(" ")
                : videoStyleRecord.prompts;
            console.log(`Video style guidelines: ${videoStyleGuidelines}`);
        }

        // Get SDXL parameters (or use default)
        const sdxlParams = videoStyleRecord
            ? getSdxlParams(videoStyleRecord)
            : {
                model: imageGenerator || "flux-1-schnell",
                negative_prompt: "",
                height: 512,
                width: 512,
                num_steps: 20,
                guidance: 7.5,
                seed: 0,
            };
        
        // Override the model with the selected image generator if provided
        if (imageGenerator) {
            sdxlParams.model = imageGenerator;
        }
        
        // Reduce steps/guidance for faster generation and less API load
        if (sdxlParams.num_steps > 6) {
            sdxlParams.num_steps = 6;
        }
        if (typeof sdxlParams.guidance === 'number' && sdxlParams.guidance > 4) {
            sdxlParams.guidance = 4;
        }

        // Generate initial segments from script - use selected duration
        const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const targetDuration = duration; // Use the selected duration
        const segmentDuration = targetDuration / Math.min(sentences.length, 8); // Max 8 segments

        // Minimal logging
        console.log(`Starting image generation for ${sentences.length} segments (concurrency: 2)...`);
        
        // Helper delay
        const delay = (ms) => new Promise((r) => setTimeout(r, ms));
        
        // Build generation tasks to execute with limited concurrency (max 8 segments)
        const totalSentences = Math.min(sentences.length, 8);
        const tasks = sentences.slice(0, totalSentences).map((sentence, index) => async () => {
            const start = index * segmentDuration;
            const end = start + segmentDuration;
            let mediaUrl;
            try {
                const dimensions = getDimensions(aspect);
                const imageResult = await generateImageFromPrompt(
                    sentence.trim(),
                    videoStyleGuidelines,
                    sdxlParams.model,
                    {
                        width: dimensions.width,
                        height: dimensions.height,
                        steps: sdxlParams.num_steps,
                        guidance: sdxlParams.guidance,
                        seed: Math.floor(Math.random() * 1000000),
                        negative_prompt: sdxlParams.negative_prompt,
                        quiet: true
                    }
                );
                if (imageResult && imageResult.filePath) {
                    const fs = await import('fs');
                    const fileBuffer = fs.readFileSync(imageResult.filePath);
                    const imageFile = {
                        buffer: fileBuffer,
                        originalname: `generated-${Date.now()}.jpg`,
                        mimetype: "image/jpeg"
                    };
                    const uploadResult = await uploadImageFile(imageFile);
                    if (uploadResult && uploadResult.publicUrl) {
                        mediaUrl = uploadResult.publicUrl;
                        try { fs.unlinkSync(imageResult.filePath); } catch {}
                    } else {
                        throw new Error('Failed to upload image to storage');
                    }
                } else {
                    throw new Error('Image generation failed - no result returned');
                }
            } catch (error) {
                console.warn(`❌ image ${index + 1} failed; using placeholder`);
                const dimensions = getDimensions(aspect);
                mediaUrl = `https://via.placeholder.com/${dimensions.width}x${dimensions.height}/000000/FFFFFF?text=${encodeURIComponent(sentence.trim())}`;
            }
            return {
                compositionId: newComposition.id,
                text: sentence.trim(),
                start,
                end,
                mediaUrl,
                animation: 'fade',
                style: {
                    fontFamily: 'Arial',
                    fontSize: 24,
                    color: '#ffffff',
                    background: 'transparent'
                },
                order: index
            };
        });
        
        // Run tasks with limited concurrency (2 at a time) and slight staggering inside a batch
        const segmentData = [];
        const concurrency = 2;
        for (let i = 0; i < tasks.length; i += concurrency) {
            const batch = tasks.slice(i, i + concurrency);
            const results = await Promise.all(batch.map((fn, j) => (j > 0 ? delay(j * 200) : Promise.resolve()).then(fn)));
            segmentData.push(...results);
            // concise progress per image
            results.forEach((_, idx) => {
                const n = i + idx + 1;
                console.log(`image ${n} check`);
            });
            // brief pause between batches to ease rate limits
            if (i + concurrency < tasks.length) {
                await delay(400);
            }
        }
        await db.insert(segments).values(segmentData);
        console.log(`Images generated. Created ${segmentData.length} segments for composition ${newComposition.id}`);

        // Generate captions from script
        const captionData = generateCaptionsFromText(script, duration * 1000, {
            sentencesPerCaption: 1,
            pauseBetweenSentences: 500,
            minCaptionDuration: 2000,
            maxCaptionDuration: 5000
        }).map(caption => ({
            ...caption,
            compositionId: newComposition.id
        }));

        await db.insert(captions).values(captionData);
        console.log(`Created ${captionData.length} captions for composition ${newComposition.id}`);

        // Update composition with generated audio URL (if available)
        if (audioUrl && audioUrl !== musicUrl) {
            console.log(`[TTS] Saving musicUrl on composition ${newComposition.id}:`, audioUrl);
            await db.update(compositions)
                .set({ musicUrl: audioUrl })
                .where(eq(compositions.id, newComposition.id));
            const [verifyComp] = await db
                .select()
                .from(compositions)
                .where(eq(compositions.id, newComposition.id));
            console.log(`[TTS] musicUrl saved?`, !!verifyComp?.musicUrl, verifyComp?.musicUrl);
        } else {
            console.log('[TTS] No audioUrl generated or unchanged.');
        }

        // Fetch the complete composition with segments and captions
        const completeComposition = await getCompositionById(newComposition.id);

        res.status(201).json({
            success: true,
            composition: completeComposition
        });

    } catch (error) {
        console.error('Error creating composition:', error);
        res.status(500).json({ 
            error: 'Failed to create composition',
            details: error.message 
        });
    }
};

// Create video composition with Socket.IO real-time updates
export const createVideoCompositionAsync = async (req, res, io) => {
    const socketId = req.body.socketId;
    const compositionId = req.body.compositionId;
    
    if (!socketId || !compositionId) {
        return res.status(400).json({ 
            error: 'Missing socketId or compositionId' 
        });
    }

    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({ 
                error: 'Not authenticated' 
            });
        }

        // Get the composition
        const [composition] = await db.select()
            .from(compositions)
            .where(eq(compositions.id, compositionId));
        
        if (!composition) {
            return res.status(404).json({ 
                error: 'Composition not found' 
            });
        }

        const { 
            script, 
            voice, 
            musicUrl, 
            aspect = '9:16'
        } = composition;

        // Get generation parameters from request body
        const {
            videoStyleId,
            imageGenerator,
            speakingRate = 15,
            language = 'en-us',
            emotionSettings = {},
            pitchStd = 45.0,
            duration = 30
        } = req.body;

        // Check if composition already has segments (prevent duplicate generation)
        const existingSegments = await db.select()
            .from(segments)
            .where(eq(segments.compositionId, compositionId));
        
        if (existingSegments.length > 0) {
            consola.info(`Composition ${compositionId} already has ${existingSegments.length} segments. Skipping generation.`);
            
            // Fetch the complete composition and return it
            const completeComposition = await getCompositionById(compositionId);
            
            io.to(socketId).emit('generation-progress', {
                step: 'completed',
                message: 'Video already generated!',
                progress: 100,
                composition: completeComposition
            });

            return res.status(200).json({
                success: true,
                message: 'Video already generated',
                compositionId: compositionId
            });
        }

        // Update status to processing
        await db.update(compositions)
            .set({ status: 'processing' })
            .where(eq(compositions.id, compositionId));

        // Send initial progress
        io.to(socketId).emit('generation-progress', {
            step: 'initializing',
            message: 'Starting video generation...',
            progress: 0
        });

        // Step 1: Generate TTS Audio
        io.to(socketId).emit('generation-progress', {
            step: 'audio',
            message: 'Generating audio from script...',
            progress: 10
        });

        let audioUrl = musicUrl;
        if (script && voice && !musicUrl) {
            try {
                consola.info('Generating TTS...');

                const zyphraRequestBody = {
                    text: script,
                    speaking_rate: speakingRate,
                    language_iso_code: language,
                    model: 'zonos-v0.1-transformer',
                    mime_type: 'audio/mpeg'
                };

                // Add voice cloning if voice is provided
                if (voice && voice !== 'default') {
                    try {
                        const [voiceRecord] = await db.select().from(voices).where(eq(voices.id, voice));
                        if (voiceRecord) {
                            const voiceResponse = await fetch(voiceRecord.voiceUrl, {
                                method: 'GET',
                                headers: {
                                    'X-API-Key': process.env.ZYPHRA_API_KEY || '',
                                },
                            });

                            if (voiceResponse.ok) {
                                const voiceArrayBuffer = await voiceResponse.arrayBuffer();
                                const speakerAudioBase64 = Buffer.from(voiceArrayBuffer).toString('base64');
                                zyphraRequestBody.speaker_audio = speakerAudioBase64;
                            }
                        }
                    } catch (voiceError) {
                        consola.warn('Error fetching voice for cloning:', voiceError.message);
                    }
                }

                const zyphraResponse = await fetch('http://api.zyphra.com/v1/audio/text-to-speech', {
                    method: 'POST',
                    headers: {
                        'X-API-Key': process.env.ZYPHRA_API_KEY || '',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(zyphraRequestBody)
                });

                if (zyphraResponse.ok) {
                    const audioArrayBuffer = await zyphraResponse.arrayBuffer();
                    const audioBuffer = Buffer.from(audioArrayBuffer);
                    
                    const audioKey = `tts-audio/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
                    const uploadResult = await uploadToR2(audioBuffer, audioKey, 'audio/mp3');
                    audioUrl = uploadResult;
                    consola.success('✅ TTS generated and uploaded');
                }
            } catch (error) {
                consola.warn('TTS generation failed:', error.message);
            }
        }

        // Update composition with audio URL
        if (audioUrl && audioUrl !== musicUrl) {
            await db.update(compositions)
                .set({ musicUrl: audioUrl })
                .where(eq(compositions.id, compositionId));
        }

        io.to(socketId).emit('generation-progress', {
            step: 'audio',
            message: 'Audio generation completed',
            progress: 25
        });

        // Step 2: Generate Images
        io.to(socketId).emit('generation-progress', {
            step: 'images',
            message: 'Generating images for video segments...',
            progress: 30
        });

        // Fetch video style guidelines
        let videoStyleRecord = null;
        if (videoStyleId) {
            const vsResults = await fetchVideoStylesByIds([videoStyleId]);
            if (vsResults.length > 0) {
                videoStyleRecord = vsResults[0];
            }
        }

        let videoStyleGuidelines = "";
        if (videoStyleRecord && videoStyleRecord.prompts) {
            videoStyleGuidelines = Array.isArray(videoStyleRecord.prompts)
                ? videoStyleRecord.prompts.join(" ")
                : videoStyleRecord.prompts;
        }

        const sdxlParams = videoStyleRecord
            ? getSdxlParams(videoStyleRecord)
            : {
                model: imageGenerator || "flux-1-schnell",
                negative_prompt: "",
                height: 512,
                width: 512,
                num_steps: 6,
                guidance: 4,
                seed: 0,
            };
        
        if (imageGenerator) {
            sdxlParams.model = imageGenerator;
        }

        // Generate segments from script - use selected duration
        const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const targetDuration = duration; // Use the selected duration
        const segmentDuration = targetDuration / Math.min(sentences.length, 8); // Max 8 segments
        const delay = (ms) => new Promise((r) => setTimeout(r, ms));

        const segmentData = [];
        const totalSentences = Math.min(sentences.length, 8); // Limit to 8 segments max

        for (let i = 0; i < totalSentences; i++) {
            const sentence = sentences[i];
            const start = i * segmentDuration;
            const end = start + segmentDuration;
            
            // Update progress for each image
            const imageProgress = 30 + (i / totalSentences) * 40; // 30-70% for images
            io.to(socketId).emit('generation-progress', {
                step: 'images',
                message: `Generating image ${i + 1} of ${totalSentences}...`,
                progress: Math.round(imageProgress)
            });

            let mediaUrl;
            try {
                const dimensions = getDimensions(aspect);
                const imageResult = await generateImageFromPrompt(
                    sentence.trim(),
                    videoStyleGuidelines,
                    sdxlParams.model,
                    {
                        width: dimensions.width,
                        height: dimensions.height,
                        steps: sdxlParams.num_steps,
                        guidance: sdxlParams.guidance,
                        seed: Math.floor(Math.random() * 1000000),
                        negative_prompt: sdxlParams.negative_prompt,
                        quiet: true
                    }
                );

                if (imageResult && imageResult.filePath) {
                    const fs = await import('fs');
                    const fileBuffer = fs.readFileSync(imageResult.filePath);
                    const imageFile = {
                        buffer: fileBuffer,
                        originalname: `generated-${Date.now()}.jpg`,
                        mimetype: "image/jpeg"
                    };
                    const uploadResult = await uploadImageFile(imageFile);
                    if (uploadResult && uploadResult.publicUrl) {
                        mediaUrl = uploadResult.publicUrl;
                        try { fs.unlinkSync(imageResult.filePath); } catch {}
                    }
                }
            } catch (error) {
                consola.warn(`Image ${i + 1} generation failed:`, error.message);
                const dimensions = getDimensions(aspect);
                mediaUrl = `https://via.placeholder.com/${dimensions.width}x${dimensions.height}/000000/FFFFFF?text=${encodeURIComponent(sentence.trim())}`;
            }

            segmentData.push({
                compositionId: compositionId,
                text: sentence.trim(),
                start,
                end,
                mediaUrl,
                animation: 'fade',
                style: {
                    fontFamily: 'Arial',
                    fontSize: 24,
                    color: '#ffffff',
                    background: 'transparent'
                },
                order: i
            });

            // Small delay between images
            await delay(200);
        }

        await db.insert(segments).values(segmentData);
        consola.success(`Created ${segmentData.length} segments`);

        io.to(socketId).emit('generation-progress', {
            step: 'images',
            message: 'Image generation completed',
            progress: 70
        });

        // Step 3: Generate Captions
        io.to(socketId).emit('generation-progress', {
            step: 'captions',
            message: 'Generating captions...',
            progress: 75
        });

        const captionData = generateCaptionsFromText(script, duration * 1000, {
            sentencesPerCaption: 1,
            pauseBetweenSentences: 500,
            minCaptionDuration: 2000,
            maxCaptionDuration: 5000
        }).map(caption => ({
            ...caption,
            compositionId: compositionId
        }));

        await db.insert(captions).values(captionData);
        consola.success(`Created ${captionData.length} captions`);

        io.to(socketId).emit('generation-progress', {
            step: 'captions',
            message: 'Captions generated',
            progress: 85
        });

        // Step 4: Finalize
        io.to(socketId).emit('generation-progress', {
            step: 'finalizing',
            message: 'Finalizing composition...',
            progress: 90
        });

        // Update status to completed
        await db.update(compositions)
            .set({ status: 'completed' })
            .where(eq(compositions.id, compositionId));

        // Fetch the complete composition
        const completeComposition = await getCompositionById(compositionId);

        io.to(socketId).emit('generation-progress', {
            step: 'completed',
            message: 'Video generation completed!',
            progress: 100,
            composition: completeComposition
        });

        consola.success(`Video composition ${compositionId} completed successfully`);

        res.status(200).json({
            success: true,
            message: 'Video generation started',
            compositionId: compositionId
        });

    } catch (error) {
        consola.error('Error in async video generation:', error);
        
        // Update status to failed
        if (compositionId) {
            await db.update(compositions)
                .set({ status: 'failed' })
                .where(eq(compositions.id, compositionId));
        }

        io.to(socketId).emit('generation-progress', {
            step: 'error',
            message: 'Video generation failed',
            progress: 0,
            error: error.message
        });

        res.status(500).json({ 
            error: 'Failed to generate video',
            details: error.message 
        });
    }
};

// Get composition by ID
export const getVideoComposition = async (req, res) => {
    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({ 
                error: 'Not authenticated' 
            });
        }

        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ error: 'Composition ID is required' });
        }

        const composition = await getCompositionById(id);
        
        if (!composition) {
            return res.status(404).json({ error: 'Composition not found' });
        }

        // Check if the composition belongs to the authenticated user
        if (composition.userId !== user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            success: true,
            composition
        });

    } catch (error) {
        console.error('Error fetching composition:', error);
        res.status(500).json({ 
            error: 'Failed to fetch composition',
            details: error.message 
        });
    }
};

// Helper function to get composition with segments and captions
const getCompositionById = async (id) => {
    const [composition] = await db
        .select()
        .from(compositions)
        .where(eq(compositions.id, id));

    if (!composition) {
        console.log(`Composition ${id} not found in database`);
        return null;
    }

    const compositionSegments = await db
        .select()
        .from(segments)
        .where(eq(segments.compositionId, id))
        .orderBy(segments.order);

    const compositionCaptions = await db
        .select()
        .from(captions)
        .where(eq(captions.compositionId, id))
        .orderBy(captions.startMs);

    console.log(`Retrieved composition ${id}:`, {
        hasComposition: !!composition,
        segmentsCount: compositionSegments.length,
        captionsCount: compositionCaptions.length,
        script: composition.script?.substring(0, 100) + '...'
    });

    return {
        ...composition,
        segments: compositionSegments,
        captions: compositionCaptions
    };
};

// Utility function to update composition in database
const updateCompositionInDB = async (id, updates) => {
    try {
        const compositionUpdates = {};
        const allowedFields = ['script', 'voice', 'musicUrl', 'aspect', 'status', 'customizations'];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                compositionUpdates[field] = updates[field];
            }
        }

        if (Object.keys(compositionUpdates).length > 0) {
            compositionUpdates.updatedAt = new Date();
            await db.update(compositions)
                .set(compositionUpdates)
                .where(eq(compositions.id, id));
        }

        return true;
    } catch (error) {
        console.error('Error updating composition in DB:', error);
        throw error;
    }
};

// Update composition
export const updateComposition = async (req, res) => {
    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({ 
                error: 'Not authenticated' 
            });
        }

        const { id } = req.params;
        const updates = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Composition ID is required' });
        }

        // Check if the composition belongs to the authenticated user
        const composition = await getCompositionById(id);
        if (!composition) {
            return res.status(404).json({ error: 'Composition not found' });
        }
        if (composition.userId !== user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Update main composition fields
        const compositionUpdates = {};
        const allowedFields = ['script', 'voice', 'musicUrl', 'aspect', 'status'];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                compositionUpdates[field] = updates[field];
            }
        }

        if (Object.keys(compositionUpdates).length > 0) {
            compositionUpdates.updatedAt = new Date();
            await db.update(compositions)
                .set(compositionUpdates)
                .where(eq(compositions.id, id));
        }

        // Update segments if provided
        if (updates.segments) {
            // Delete existing segments
            await db.delete(segments).where(eq(segments.compositionId, id));
            
            // Insert new segments
            const segmentData = updates.segments.map(segment => ({
                ...segment,
                compositionId: parseInt(id)
            }));
            await db.insert(segments).values(segmentData);
        }

        // Update captions if provided
        if (updates.captions) {
            // Delete existing captions
            await db.delete(captions).where(eq(captions.compositionId, id));
            
            // Insert new captions
            const captionData = updates.captions.map(caption => ({
                ...caption,
                compositionId: parseInt(id)
            }));
            await db.insert(captions).values(captionData);
        }

        // Fetch updated composition
        const updatedComposition = await getCompositionById(id);

        res.json({
            success: true,
            composition: updatedComposition
        });

    } catch (error) {
        console.error('Error updating composition:', error);
        res.status(500).json({ 
            error: 'Failed to update composition',
            details: error.message 
        });
    }
};

// Render final video
export const renderVideo = async (req, res) => {
    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({ 
                error: 'Not authenticated' 
            });
        }

        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ error: 'Composition ID is required' });
        }

        const composition = await getCompositionById(id);
        
        if (!composition) {
            return res.status(404).json({ error: 'Composition not found' });
        }

        // Check if the composition belongs to the authenticated user
        if (composition.userId !== user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Update status to rendering
        await db.update(compositions)
            .set({ status: 'rendering', updatedAt: new Date() })
            .where(eq(compositions.id, id));

        // Start rendering process (this would be done in a worker in production)
        const renderJob = {
            id: uuidv4(),
            compositionId: id,
            status: 'rendering',
            progress: 0
        };

        // In a real implementation, you'd queue this job and return immediately
        // For now, we'll simulate the process
        res.json({
            success: true,
            jobId: renderJob.id,
            message: 'Render job started'
        });

        // Start actual rendering process
        setTimeout(async () => {
            try {
                const outputPath = join(tmpdir(), `video-${id}-${Date.now()}.mp4`);
                
                // Bundle the Remotion composition
                const bundleLocation = await bundle({
                    entryPoint: join(process.cwd(), 'src/index.ts'),
                    webpackOverride: (config) => {
                        // Add any necessary webpack overrides here
                        return config;
                    },
                });
                
                // Calculate video dimensions and duration
                const dimensions = getDimensions(composition.aspect);
                const durationInFrames = Math.max(
                    120, // Minimum 4 seconds at 30fps
                    ...composition.segments.map(s => {
                        const start = parseFloat(s.start) || 0;
                        const end = parseFloat(s.end) || (start + 3);
                        return Math.ceil(end * 30);
                    })
                );
                
                // Render the video
                await renderMedia({
                    composition: {
                        id: 'VideoComposition',
                        width: dimensions.width,
                        height: dimensions.height,
                        fps: 30,
                        durationInFrames: durationInFrames,
                    },
                    serveUrl: bundleLocation,
                    codec: 'h264',
                    outputLocation: outputPath,
                    logLevel: 'error',
                    chromiumOptions: {
                        disableWebSecurity: true,
                    },
                    inputProps: {
                        // Data properties (flattened)
                        id: composition.id,
                        segments: composition.segments,
                        captions: composition.captions,
                        musicUrl: composition.musicUrl,
                        script: composition.script,
                        aspect: composition.aspect || '9:16',
                        
                        // Default customization properties
                        fontSize: 64,
                        fontWeight: 700,
                        fontFamily: 'Inter',
                        textTransform: 'uppercase',
                        activeWordColor: '#fff',
                        inactiveWordColor: '#00ffea',
                        positionFromBottom: 9,
                        wordsPerBatch: 3,
                        showEmojis: true,
                        musicVolume: 8
                    },
                    // Add audio if available
                    ...(composition.musicUrl && {
                        audioCodec: 'aac',
                        audioBitrate: '128k',
                    }),
                });

                // Save video to temp folder for inspection
                const tempVideoDir = join(process.cwd(), 'temp_videos');
                if (!fs.existsSync(tempVideoDir)) {
                    fs.mkdirSync(tempVideoDir, { recursive: true });
                }
                const tempVideoPath = join(tempVideoDir, `composition-${id}-${Date.now()}.mp4`);
                fs.copyFileSync(outputPath, tempVideoPath);
                console.log(`Video saved to temp folder: ${tempVideoPath}`);

                // Upload to Cloudflare R2 or similar storage
                const videoBuffer = fs.readFileSync(outputPath);
                const finalVideoUrl = await uploadToR2(videoBuffer, `videos/${id}-${Date.now()}.mp4`, 'video/mp4');

                // Update composition with final video URL
                await db.update(compositions)
                    .set({ 
                        status: 'completed', 
                        finalVideoUrl,
                        updatedAt: new Date() 
                    })
                    .where(eq(compositions.id, id));

                console.log(`Video rendered successfully: ${finalVideoUrl}`);
                console.log(`Temp video saved at: ${tempVideoPath}`);
                
                // Clean up temporary file (but keep the temp_videos copy)
                try {
                    fs.unlinkSync(outputPath);
                    console.log('Temporary file cleaned up');
                } catch (cleanupError) {
                    console.warn('Failed to clean up temporary file:', cleanupError.message);
                }

            } catch (renderError) {
                console.error('Render error:', renderError);
                await db.update(compositions)
                    .set({ 
                        status: 'failed', 
                        updatedAt: new Date() 
                    })
                    .where(eq(compositions.id, id));
            }
        }, 1000); // Start rendering after 1 second

    } catch (error) {
        console.error('Error starting render:', error);
        res.status(500).json({ 
            error: 'Failed to start render',
            details: error.message 
        });
    }
};

// Upload/replace captions
export const updateCaptions = async (req, res) => {
    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({ 
                error: 'Not authenticated' 
            });
        }

        const { id } = req.params;
        const { captionsData, format = 'json' } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Composition ID is required' });
        }

        // Check if the composition belongs to the authenticated user
        const composition = await getCompositionById(id);
        if (!composition) {
            return res.status(404).json({ error: 'Composition not found' });
        }
        if (composition.userId !== user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        let parsedCaptions = [];

        if (format === 'srt' && typeof captionsData === 'string') {
            parsedCaptions = parseSrtToCaptions(captionsData);
        } else if (format === 'vtt' && typeof captionsData === 'string') {
            parsedCaptions = parseVttToCaptions(captionsData);
        } else if (format === 'json' && Array.isArray(captionsData)) {
            parsedCaptions = captionsData;
        } else {
            return res.status(400).json({ 
                error: 'Invalid captions format. Expected SRT string, VTT string, or JSON array.' 
            });
        }

        // Validate caption timing
        const validationErrors = validateCaptionTiming(parsedCaptions);
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                error: 'Caption timing validation failed',
                details: validationErrors
            });
        }

        // Auto-correct timing issues
        parsedCaptions = autoCorrectCaptionTiming(parsedCaptions);

        // Delete existing captions
        await db.delete(captions).where(eq(captions.compositionId, id));

        // Insert new captions
        const captionData = parsedCaptions.map(caption => ({
            compositionId: parseInt(id),
            text: caption.text,
            startMs: caption.startMs,
            endMs: caption.endMs,
            timestampMs: caption.timestampMs || null,
            confidence: caption.confidence || null
        }));

        await db.insert(captions).values(captionData);

        // Fetch updated composition
        const updatedComposition = await getCompositionById(id);

        res.json({
            success: true,
            composition: updatedComposition
        });

    } catch (error) {
        console.error('Error updating captions:', error);
        res.status(500).json({ 
            error: 'Failed to update captions',
            details: error.message 
        });
    }
};

// Render final video with customizations
export const renderFinalVideo = async (req, res) => {
    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({ 
                error: 'Not authenticated' 
            });
        }

        const { id } = req.params;
        const {
            captionStyle,
            fontSize,
            fontWeight,
            fontFamily,
            textTransform,
            activeWordColor,
            inactiveWordColor,
            positionFromBottom,
            wordsPerBatch,
            showEmojis,
            backgroundMusic,
            musicVolume,
            customMusicFile,
            youtubeUrl
        } = req.body;

        console.log('Rendering final video with customizations:', {
            id,
            captionStyle,
            fontSize,
            fontWeight,
            fontFamily,
            textTransform,
            activeWordColor,
            inactiveWordColor,
            positionFromBottom,
            wordsPerBatch,
            showEmojis,
            backgroundMusic,
            musicVolume
        });

        // Get the composition data
        const composition = await getCompositionById(id);
        if (!composition) {
            return res.status(404).json({
                success: false,
                error: 'Composition not found'
            });
        }

        // Check if the composition belongs to the authenticated user
        if (composition.userId !== user.id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Debug: Log composition data
        console.log('Composition data for rendering:', {
            id: composition.id,
            hasSegments: !!composition.segments,
            segmentsCount: composition.segments?.length || 0,
            hasCaptions: !!composition.captions,
            captionsCount: composition.captions?.length || 0,
            musicUrl: composition.musicUrl,
            script: composition.script?.substring(0, 100) + '...'
        });

        // Update composition with customizations
        const updatedComposition = {
            ...composition,
            customizations: {
                captionStyle,
                fontSize,
                fontWeight,
                fontFamily,
                textTransform,
                activeWordColor,
                inactiveWordColor,
                positionFromBottom,
                wordsPerBatch,
                showEmojis,
                backgroundMusic,
                musicVolume,
                customMusicFile,
                youtubeUrl
            },
            status: 'rendering'
        };

        // Update the composition in the database
        await updateCompositionInDB(id, updatedComposition);

        // Start the actual video rendering process
        console.log('Final video rendering started with customizations');

        res.json({
            success: true,
            message: 'Final video rendering started',
            composition: updatedComposition
        });

        // Start actual rendering process in background
        setTimeout(async () => {
            const debugLogs = [];
            const addDebugLog = (step, data) => {
                debugLogs.push({
                    timestamp: new Date().toISOString(),
                    step,
                    ...data
                });
            };
            
            try {
                addDebugLog('render_start', {
                    compositionId: id,
                    message: `Starting video rendering for composition ${id}...`
                });
                console.log(`Starting video rendering for composition ${id}...`);
                const outputPath = join(tmpdir(), `final-video-${id}-${Date.now()}.mp4`);
                addDebugLog('output_path_set', { outputPath });
                console.log(`Output path: ${outputPath}`);
                
                // Bundle the Remotion composition
                addDebugLog('bundle_start', { message: 'Bundling Remotion composition...' });
                console.log('Bundling Remotion composition...');
                const entryPoint = join(process.cwd(), 'src/index.ts');
                addDebugLog('entry_point', { entryPoint });
                console.log(`Entry point: ${entryPoint}`);
                
                const bundleLocation = await bundle({
                    entryPoint,
                    webpackOverride: (config) => {
                        // Add any necessary webpack overrides here
                        return config;
                    },
                });
                addDebugLog('bundle_complete', { bundleLocation });
                console.log(`Bundle location: ${bundleLocation}`);
                
                // Calculate video dimensions and duration
                const dimensions = getDimensions(updatedComposition.aspect);
                const durationInFrames = Math.max(
                    120, // Minimum 4 seconds at 30fps
                    ...updatedComposition.segments.map(s => {
                        const start = parseFloat(s.start) || 0;
                        const end = parseFloat(s.end) || (start + 3);
                        return Math.ceil(end * 30);
                    })
                );
                addDebugLog('video_calculations', {
                    dimensions,
                    durationInFrames,
                    aspect: updatedComposition.aspect,
                    segmentsCount: updatedComposition.segments.length
                });
                console.log(`Video dimensions: ${dimensions.width}x${dimensions.height}, duration: ${durationInFrames} frames`);
                
                // Render the video with customizations
                console.log('Starting video rendering...');
                console.log('=== Input Props Debug ===');
                console.log('Updated composition:', {
                    id: updatedComposition.id,
                    hasSegments: !!updatedComposition.segments,
                    segmentsCount: updatedComposition.segments?.length || 0,
                    hasCaptions: !!updatedComposition.captions,
                    captionsCount: updatedComposition.captions?.length || 0,
                    firstSegment: updatedComposition.segments?.[0],
                    firstCaption: updatedComposition.captions?.[0],
                    musicUrl: updatedComposition.musicUrl,
                    script: updatedComposition.script?.substring(0, 100)
                });
                
                // Debug the data structure being passed to Remotion
                const dataForRemotion = {
                    id: updatedComposition.id,
                    segments: updatedComposition.segments || [],
                    captions: updatedComposition.captions || [],
                    musicUrl: updatedComposition.musicUrl,
                    script: updatedComposition.script
                };
                
                // Comprehensive logging of data structure
                const controllerDebugLog = {
                    timestamp: new Date().toISOString(),
                    step: 'controller_data_preparation',
                    compositionId: id,
                    originalComposition: {
                        id: updatedComposition.id,
                        hasSegments: !!updatedComposition.segments,
                        segmentsCount: updatedComposition.segments?.length || 0,
                        hasCaptions: !!updatedComposition.captions,
                        captionsCount: updatedComposition.captions?.length || 0,
                        musicUrl: updatedComposition.musicUrl,
                        script: updatedComposition.script?.substring(0, 100)
                    },
                    dataForRemotion: {
                        id: dataForRemotion.id,
                        hasSegments: !!dataForRemotion.segments,
                        segmentsCount: dataForRemotion.segments?.length || 0,
                        hasCaptions: !!dataForRemotion.captions,
                        captionsCount: dataForRemotion.captions?.length || 0,
                        musicUrl: dataForRemotion.musicUrl,
                        script: dataForRemotion.script?.substring(0, 100)
                    },
                    firstSegment: dataForRemotion.segments?.[0] || null,
                    firstCaption: dataForRemotion.captions?.[0] || null
                };
                console.log('🎬 Controller data preparation:', JSON.stringify(controllerDebugLog, null, 2));
                
                // Embed remote assets directly as data URLs so Chromium page can access them without filesystem mapping.
                const fetch = (await import('node-fetch')).default;
                let embeddedImages = 0;
                for (let i = 0; i < dataForRemotion.segments.length; i++) {
                    const seg = dataForRemotion.segments[i];
                    const remoteUrl = seg.mediaUrl || seg.imageUrl;
                    if (!remoteUrl || !/^https?:/i.test(remoteUrl)) continue;
                    try {
                        const resp = await fetch(remoteUrl);
                        if (!resp.ok) {
                            console.warn('Image fetch failed', remoteUrl, resp.status);
                            continue;
                        }
                        const buf = Buffer.from(await resp.arrayBuffer());
                        if (buf.length > 4 * 1024 * 1024) { // Skip huge images to avoid memory bloat
                            console.warn('Skipping embedding large image (>4MB), keeping remote URL:', remoteUrl);
                            continue;
                        }
                        const mime = resp.headers.get('content-type') || 'image/jpeg';
                        seg.mediaUrl = `data:${mime};base64,${buf.toString('base64')}`;
                        embeddedImages++;
                    } catch (e) {
                        console.warn('Image embed error', remoteUrl, e);
                    }
                }
                let embeddedMusic = false;
                if (dataForRemotion.musicUrl && /^https?:/i.test(dataForRemotion.musicUrl)) {
                    try {
                        const resp = await fetch(dataForRemotion.musicUrl);
                        if (resp.ok) {
                            const buf = Buffer.from(await resp.arrayBuffer());
                            if (buf.length <= 15 * 1024 * 1024) { // 15MB cap
                                const mime = resp.headers.get('content-type') || 'audio/mpeg';
                                dataForRemotion.musicUrl = `data:${mime};base64,${buf.toString('base64')}`;
                                embeddedMusic = true;
                            } else {
                                console.warn('Music too large to embed, keeping remote URL size=', buf.length);
                            }
                        } else {
                            console.warn('Music fetch failed', dataForRemotion.musicUrl, resp.status);
                        }
                    } catch (e) {
                        console.warn('Music embed error', dataForRemotion.musicUrl, e);
                    }
                }
                const assetEmbedLog = {
                    timestamp: new Date().toISOString(),
                    step: 'asset_embed_complete',
                    imagesEmbedded: embeddedImages,
                    musicEmbedded: embeddedMusic,
                    totalSegments: dataForRemotion.segments.length,
                    segmentsWithMedia: dataForRemotion.segments.filter(s => s.mediaUrl).length
                };
                console.log('🎬 Asset embed complete:', JSON.stringify(assetEmbedLog, null, 2));
                
                const finalDataLog = {
                    timestamp: new Date().toISOString(),
                    step: 'final_data_structure',
                    dataForRemotion: {
                        id: dataForRemotion.id,
                        segmentsCount: dataForRemotion.segments.length,
                        captionsCount: dataForRemotion.captions.length,
                        hasMusicUrl: !!dataForRemotion.musicUrl,
                        segments: dataForRemotion.segments.map((s, i) => ({
                            index: i,
                            text: s.text?.substring(0, 50) + '...',
                            start: s.start,
                            end: s.end,
                            hasMediaUrl: !!s.mediaUrl,
                            mediaUrlType: s.mediaUrl ? (s.mediaUrl.startsWith('data:') ? 'data-url' : 'remote-url') : 'none'
                        }))
                    },
                    customizations: {
                        captionStyle,
                        fontSize,
                        fontWeight,
                        fontFamily,
                        textTransform,
                        activeWordColor,
                        inactiveWordColor,
                        positionFromBottom,
                        wordsPerBatch,
                        showEmojis,
                        backgroundMusic,
                        musicVolume,
                        customMusicFile,
                        youtubeUrl
                    }
                };
                console.log('🎬 Final data structure for Remotion:', JSON.stringify(finalDataLog, null, 2));
                
                const renderMediaLog = {
                    timestamp: new Date().toISOString(),
                    step: 'render_media_call',
                    composition: {
                        id: 'VideoComposition',
                        width: dimensions.width,
                        height: dimensions.height,
                        fps: 30,
                        durationInFrames: durationInFrames,
                    },
                    serveUrl: bundleLocation,
                    outputLocation: outputPath,
                    inputPropsKeys: [
                        'id', 'segments', 'captions', 'musicUrl', 'script', 'aspect',
                        'fontSize', 'fontWeight', 'fontFamily', 'textTransform',
                        'activeWordColor', 'inactiveWordColor', 'positionFromBottom',
                        'wordsPerBatch', 'showEmojis', 'musicVolume'
                    ],
                    inputPropsData: {
                        hasSegments: !!dataForRemotion.segments,
                        hasCaptions: !!dataForRemotion.captions,
                        segmentsCount: dataForRemotion.segments?.length || 0,
                        captionsCount: dataForRemotion.captions?.length || 0,
                        hasCustomizations: true
                    }
                };
                console.log('🎬 About to call renderMedia:', JSON.stringify(renderMediaLog, null, 2));

                // Flatten the props structure to match the schema
                const inputProps = {
                    // Data properties (flattened)
                    id: dataForRemotion.id,
                    segments: dataForRemotion.segments,
                    captions: dataForRemotion.captions,
                    musicUrl: dataForRemotion.musicUrl,
                    script: dataForRemotion.script,
                    aspect: dataForRemotion.aspect || '9:16',
                    
                    // Customization properties (flattened)
                    fontSize,
                    fontWeight,
                    fontFamily,
                    textTransform,
                    activeWordColor,
                    inactiveWordColor,
                    positionFromBottom,
                    wordsPerBatch,
                    showEmojis,
                    musicVolume
                };
                
                console.log('🎬 Final inputProps being passed to renderMedia:', {
                    hasSegments: !!inputProps.segments,
                    hasCaptions: !!inputProps.captions,
                    segmentsCount: inputProps.segments?.length || 0,
                    captionsCount: inputProps.captions?.length || 0,
                    hasCustomizations: !!(inputProps.fontSize && inputProps.fontFamily),
                    inputPropsKeys: Object.keys(inputProps)
                });

                await renderMedia({
                    composition: {
                        id: 'VideoComposition',
                        width: dimensions.width,
                        height: dimensions.height,
                        fps: 30,
                        durationInFrames: durationInFrames,
                    },
                    serveUrl: bundleLocation,
                    codec: 'h264',
                    outputLocation: outputPath,
                    logLevel: 'error',
                    chromiumOptions: {
                        disableWebSecurity: true,
                    },
                    inputProps,
                    ...(updatedComposition.musicUrl && {
                        audioCodec: 'aac',
                        audioBitrate: '128k',
                    }),
                });

                const renderCompleteLog = {
                    timestamp: new Date().toISOString(),
                    step: 'render_complete',
                    message: 'Video rendering completed, uploading to storage...',
                    outputPath,
                    compositionId: id
                };
                console.log('🎬 Video rendering completed:', JSON.stringify(renderCompleteLog, null, 2));
                
                // Save video to temp folder for inspection
                const tempVideoDir = join(process.cwd(), 'temp_videos');
                if (!fs.existsSync(tempVideoDir)) {
                    fs.mkdirSync(tempVideoDir, { recursive: true });
                }
                const tempVideoPath = join(tempVideoDir, `composition-${id}-${Date.now()}.mp4`);
                fs.copyFileSync(outputPath, tempVideoPath);
                console.log(`Video saved to temp folder: ${tempVideoPath}`);
                
                // Upload to Cloudflare R2 or similar storage
                const videoBuffer = fs.readFileSync(outputPath);
                const finalVideoUrl = await uploadToR2(videoBuffer, `final-videos/${id}-${Date.now()}.mp4`, 'video/mp4');

                // Update composition with final video URL and completed status
                await db.update(compositions)
                    .set({ 
                        status: 'completed', 
                        finalVideoUrl,
                        updatedAt: new Date() 
                    })
                    .where(eq(compositions.id, id));

                addDebugLog('render_success', {
                    finalVideoUrl,
                    tempVideoPath,
                    message: 'Final video rendered successfully'
                });
                console.log(`Final video rendered successfully: ${finalVideoUrl}`);
                console.log(`Temp video saved at: ${tempVideoPath}`);
                
                // Write comprehensive debug logs to JSON file
                try {
                    const debugFilePath = join(process.cwd(), 'temp_videos', `debug-logs-${id}-${Date.now()}.json`);
                    fs.writeFileSync(debugFilePath, JSON.stringify({
                        compositionId: id,
                        timestamp: new Date().toISOString(),
                        debugLogs,
                        finalResult: {
                            success: true,
                            finalVideoUrl,
                            tempVideoPath
                        }
                    }, null, 2));
                    console.log(`Debug logs saved to: ${debugFilePath}`);
                } catch (debugError) {
                    console.warn('Failed to save debug logs:', debugError.message);
                }
                
                // Clean up temporary file (but keep the temp_videos copy)
                try {
                    fs.unlinkSync(outputPath);
                    console.log('Temporary file cleaned up');
                } catch (cleanupError) {
                    console.warn('Failed to clean up temporary file:', cleanupError.message);
                }

            } catch (renderError) {
                addDebugLog('render_error', {
                    error: renderError.message,
                    stack: renderError.stack,
                    message: 'Final video render error'
                });
                
                // Write error debug logs to JSON file
                try {
                    const debugFilePath = join(process.cwd(), 'temp_videos', `debug-logs-error-${id}-${Date.now()}.json`);
                    fs.writeFileSync(debugFilePath, JSON.stringify({
                        compositionId: id,
                        timestamp: new Date().toISOString(),
                        debugLogs,
                        error: {
                            message: renderError.message,
                            stack: renderError.stack,
                            name: renderError.name
                        },
                        finalResult: {
                            success: false,
                            error: renderError.message
                        }
                    }, null, 2));
                    console.log(`Error debug logs saved to: ${debugFilePath}`);
                } catch (debugError) {
                    console.warn('Failed to save error debug logs:', debugError.message);
                }
                
                console.error('Final video render error:', renderError);
                console.error('Error stack:', renderError.stack);
                await db.update(compositions)
                    .set({ 
                        status: 'failed', 
                        updatedAt: new Date() 
                    })
                    .where(eq(compositions.id, id));
            }
        }, 1000); // Start rendering after 1 second

    } catch (error) {
        console.error('Error rendering final video:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to render final video',
            details: error.message
        });
    }
};

// Get video composition status
export const getVideoCompositionStatus = async (req, res) => {
    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }

        const { id } = req.params;
        
        const composition = await getCompositionById(id);
        if (!composition) {
            return res.status(404).json({
                success: false,
                error: 'Composition not found'
            });
        }

        // Check if the composition belongs to the authenticated user
        if (composition.userId !== user.id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        res.json({
            success: true,
            composition: {
                id: composition.id,
                status: composition.status,
                finalVideoUrl: composition.finalVideoUrl,
                customizations: composition.customizations,
                createdAt: composition.createdAt,
                updatedAt: composition.updatedAt
            }
        });

    } catch (error) {
        console.error('Error getting composition status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get composition status',
            details: error.message
        });
    }
};

// Get user's composition videos
export const getUserVideos = async (req, res) => {
    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }

        // Get all compositions for the user
        const userCompositions = await db.select()
            .from(compositions)
            .where(eq(compositions.userId, user.id))
            .orderBy(compositions.createdAt);

        // Debug: Log what we found
        console.log(`Found ${userCompositions.length} compositions for user ${user.id}`);
        userCompositions.forEach(comp => {
            console.log(`Composition ${comp.id}: ${comp.script?.substring(0, 50)}...`);
        });

        res.json({
            success: true,
            videos: userCompositions
        });

    } catch (error) {
        console.error('Error fetching user videos:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user videos',
            details: error.message
        });
    }
};

// Debug endpoint to check database tables
export const debugDatabase = async (req, res) => {
    try {
        console.log('Checking database tables...');
        
        // Check if compositions table exists and has data
        const allCompositions = await db.select().from(compositions).limit(5);
        console.log(`Found ${allCompositions.length} compositions in database`);
        
        // Check if segments table exists and has data
        const allSegments = await db.select().from(segments).limit(5);
        console.log(`Found ${allSegments.length} segments in database`);
        
        // Check if captions table exists and has data
        const allCaptions = await db.select().from(captions).limit(5);
        console.log(`Found ${allCaptions.length} captions in database`);
        
        res.json({
            success: true,
            debug: {
                compositionsCount: allCompositions.length,
                segmentsCount: allSegments.length,
                captionsCount: allCaptions.length,
                sampleComposition: allCompositions[0] || null,
                sampleSegment: allSegments[0] || null,
                sampleCaption: allCaptions[0] || null
            }
        });
        
    } catch (error) {
        console.error('Database debug error:', error);
        res.status(500).json({
            success: false,
            error: 'Database debug failed',
            details: error.message
        });
    }
};
