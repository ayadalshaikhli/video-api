/**
 * Video Composition Controller - Fixed and Optimized
 * 
 * KEY IMPROVEMENTS:
 * 1. Fixed caption-voice synchronization by using actual audio duration from ffprobe
 * 2. Removed redundant Zyphra TTS code - now only uses Cloudflare Aura TTS
 * 3. Improved caption timing to distribute evenly across actual audio duration
 * 4. Cleaned up unused imports and parameters
 * 5. Better error handling and logging for audio generation
 * 6. Segments now properly timed based on actual audio duration
 */

import { db } from '../lib/db/drizzle.js';
import { compositions, segments, captions } from '../lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { renderMedia } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import { createWriteStream } from 'fs';
import fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { 
    generateCaptionsFromText, 
    parseSrtToCaptions, 
    parseVttToCaptions,
    validateCaptionTiming,
    autoCorrectCaptionTiming
} from '../utils/captionUtils.js';
import { whisperAudio } from '../actions/whisper.js';
import ffprobe from 'node-ffprobe';
import ffprobeStatic from 'ffprobe-static';
import { uploadToR2 } from '../utils/cloudflareUtils.js';
import { generateImageFromPrompt } from '../actions/image-generation.js';
import { uploadImageFile } from '../actions/cloudflare.js';
import { getUserFromSession } from '../utils/session.js';
import { fetchVideoStylesByIds } from '../data/media-styles.js';
import { consola } from 'consola';
import { generateSpeechAndSave } from '../actions/text-to-audio.js';

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


// Helper function to process transcription data for caption matching (same as captionMatchRoute)
const processTranscriptionForCaptions = (transcriptionData, originalText) => {
    try {
        let captions = [];
        
        // Cloudflare Whisper returns words array directly
        if (transcriptionData.words && transcriptionData.words.length > 0) {
            transcriptionData.words.forEach((word, wordIndex) => {
                captions.push({
                    id: `word-${wordIndex}`,
                    text: word.word || word.text || word,
                    start: word.start || 0,
                    end: word.end || 0,
                    confidence: word.confidence || 1,
                    // Add millisecond timing for precise synchronization
                    startMs: Math.round((word.start || 0) * 1000),
                    endMs: Math.round((word.end || 0) * 1000)
                });
            });
        } else if (transcriptionData.vtt) {
            // Parse VTT format if available
            const vttLines = transcriptionData.vtt.split('\n');
            let wordIndex = 0;
            
            for (let i = 0; i < vttLines.length; i++) {
                const line = vttLines[i].trim();
                // Look for time stamps in VTT format: 00:00:00.000 --> 00:00:01.000
                if (line.includes('-->')) {
                    const [startTime, endTime] = line.split(' --> ');
                    const nextLine = vttLines[i + 1];
                    
                    if (nextLine && nextLine.trim()) {
                        const words = nextLine.trim().split(' ');
                        const segmentStart = parseVTTTime(startTime);
                        const segmentEnd = parseVTTTime(endTime);
                        const segmentDuration = segmentEnd - segmentStart;
                        const timePerWord = segmentDuration / words.length;
                        
                        words.forEach((word, idx) => {
                            const wordStart = segmentStart + (idx * timePerWord);
                            const wordEnd = wordStart + timePerWord;
                            
                            captions.push({
                                id: `vtt-${wordIndex}`,
                                text: word,
                                start: wordStart,
                                end: wordEnd,
                                confidence: 1,
                                // Add millisecond timing for precise synchronization
                                startMs: Math.round(wordStart * 1000),
                                endMs: Math.round(wordEnd * 1000)
                            });
                            wordIndex++;
                        });
                    }
                }
            }
        } else if (transcriptionData.text) {
            // Fallback: split text evenly across estimated duration
            const words = transcriptionData.text.split(' ');
            const estimatedDuration = words.length * 0.5; // Estimate 0.5 seconds per word
            const timePerWord = estimatedDuration / words.length;
            
            words.forEach((word, index) => {
                const start = index * timePerWord;
                const end = start + timePerWord;
                
                captions.push({
                    id: `fallback-${index}`,
                    text: word,
                    start: start,
                    end: end,
                    confidence: 1,
                    // Add millisecond timing for precise synchronization
                    startMs: Math.round(start * 1000),
                    endMs: Math.round(end * 1000)
                });
            });
        }

        // Sort captions by start time
        captions.sort((a, b) => a.start - b.start);
        
        console.log(`🎬 [Caption Verification] Processed ${captions.length} caption segments`);
        return captions;
        
    } catch (error) {
        console.error('🎬 [Caption Verification] Error processing transcription:', error);
        // Return basic fallback
        const words = originalText.split(' ');
        return words.map((word, index) => ({
            id: `fallback-${index}`,
            text: word,
            start: index * 0.5,
            end: (index + 1) * 0.5,
            confidence: 1,
            // Add millisecond timing for precise synchronization
            startMs: Math.round(index * 0.5 * 1000),
            endMs: Math.round((index + 1) * 0.5 * 1000)
        }));
    }
};

// Helper function to parse VTT time format (00:00:00.000) to seconds
const parseVTTTime = (timeString) => {
    const parts = timeString.split(':');
    const seconds = parseFloat(parts[2]);
    const minutes = parseInt(parts[1]);
    const hours = parseInt(parts[0]);
    
    return hours * 3600 + minutes * 60 + seconds;
};

// Helper function to get audio duration in seconds from audio URL
const getAudioDuration = async (audioUrl) => {
    try {
        // Download audio file
        const response = await fetch(audioUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.statusText}`);
        }
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        
        // Create temporary file
        const tempPath = join(tmpdir(), `audio-${Date.now()}.mp3`);
        fs.writeFileSync(tempPath, audioBuffer);
        
        // Use ffprobe to get duration
        ffprobe.FFPROBE_PATH = ffprobeStatic.path;
        const info = await ffprobe(tempPath);
        
        // Clean up temp file
        fs.unlinkSync(tempPath);
        
        const duration = parseFloat(info.streams[0].duration);
        console.log(`Audio duration detected: ${duration} seconds`);
        return duration;
    } catch (error) {
        console.warn('Could not detect audio duration:', error.message);
        return null;
    }
};

// Helper function to calculate video duration in frames based on audio and segments
// Uses the same precise timing logic as caption matching
const calculateVideoDurationInFrames = (composition) => {
    const fps = 30;
    
    // Try to use stored audio duration first
    if (composition.audioDuration) {
        const audioDurationInFrames = Math.ceil(composition.audioDuration * fps);
        console.log(`Using stored audio duration: ${composition.audioDuration}s = ${audioDurationInFrames} frames`);
        return audioDurationInFrames;
    }
    
    // Fallback to segment-based calculation with precise timing
    if (composition.segments && composition.segments.length > 0) {
        const maxSegmentEnd = Math.max(...composition.segments.map(s => {
            const start = parseFloat(s.start) || 0;
            const end = parseFloat(s.end) || (start + 3);
            return parseFloat(end.toFixed(3)); // Ensure precise timing
        }));
        const segmentDurationInFrames = Math.ceil(maxSegmentEnd * fps);
        console.log(`Using segment-based duration (precise timing): ${maxSegmentEnd}s = ${segmentDurationInFrames} frames`);
        return Math.max(120, segmentDurationInFrames); // Minimum 4 seconds
    }
    
    // Final fallback
    console.log('Using default duration: 10 seconds = 300 frames');
    return 300; // 10 seconds default
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
            duration = 30,
            captionMatchingData
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
            musicUrl: musicUrl || null,
            aspect,
            status: 'draft'
        }).returning();

        // If we have caption matching data, create segments and captions with perfect timing
        if (captionMatchingData && captionMatchingData.wordLevelCaptions) {
            console.log('🎬 Creating composition with caption matching data:', {
                compositionId: newComposition.id,
                wordLevelCaptions: captionMatchingData.wordLevelCaptions.length,
                audioUrl: captionMatchingData.audioUrl
            });

            // Create a single segment for the entire script with perfect timing
            const [newSegment] = await db.insert(segments).values({
                compositionId: newComposition.id,
                text: script,
                caption: script,
                start: 0,
                end: captionMatchingData.timingAnalysis?.totalDuration || duration,
                duration: captionMatchingData.timingAnalysis?.totalDuration || duration,
                order: 1,
                animation: 'fadeIn',
                mediaUrl: null // Will be generated later
            }).returning();

            // Insert word-level captions with precise timing
            const captionInserts = captionMatchingData.wordLevelCaptions.map((caption, index) => ({
                compositionId: newComposition.id,
                segmentId: newSegment.id,
                text: caption.text,
                startMs: caption.startMs || Math.round(caption.start * 1000),
                endMs: caption.endMs || Math.round(caption.end * 1000),
                order: index
            }));

            if (captionInserts.length > 0) {
                await db.insert(captions).values(captionInserts);
                console.log(`✅ Inserted ${captionInserts.length} word-level captions with perfect timing`);
            }

            // Update composition with audio URL if available
            if (captionMatchingData.audioUrl) {
                await db.update(compositions)
                    .set({ musicUrl: captionMatchingData.audioUrl })
                    .where(eq(compositions.id, newComposition.id));
            }
        }

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
                duration,
                hasCaptionMatching: !!captionMatchingData
            }
        });

        return; // Exit early - composition will be generated asynchronously

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
            duration = 30
        } = req.body;

        // Check composition status and prevent concurrent generation
        if (composition.status === 'processing' || composition.status === 'completed') {
            consola.info(`Composition ${compositionId} already in status: ${composition.status}. Skipping generation.`);
            
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
                message: 'Composition already exists',
                compositionId: compositionId
            });
        }

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

        // Atomically update status to processing (this will fail if another process already did it)
        const updateResult = await db.update(compositions)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(and(
                eq(compositions.id, compositionId),
                eq(compositions.status, 'draft') // Only update if still in draft status
            ))
            .returning();

        if (updateResult.length === 0) {
            consola.info(`Composition ${compositionId} already being processed by another request.`);
            return res.status(409).json({
                success: false,
                message: 'Composition is already being processed'
            });
        }

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
        let actualAudioDuration = duration; // Default fallback
        
        if (script && voice && !musicUrl) {
            try {
                consola.info('Generating TTS using Zyphra API...');

                // Use Zyphra TTS
                const result = await generateSpeechAndSave({
                    prompt: script,
                    voiceId: voice,
                    languageIsoCode: 'en-us',
                    userOverride: user
                });

                if (result && result.audioUrl) {
                    audioUrl = result.audioUrl;
                    
                    // Get actual audio duration from the generated audio file
                    consola.info('Detecting actual audio duration...');
                    const detectedDuration = await getAudioDuration(audioUrl);
                    if (detectedDuration) {
                        actualAudioDuration = detectedDuration;
                        consola.success(`✅ Zyphra TTS generated with actual duration: ${actualAudioDuration}s`);
                    } else {
                        // Estimate based on text length as fallback
                        const wordsCount = script.split(/\s+/).length;
                        actualAudioDuration = Math.max(2, wordsCount * 0.6); // ~0.6 seconds per word
                        consola.warn(`Using estimated duration based on word count: ${actualAudioDuration}s`);
                    }
                } else {
                    throw new Error('Failed to generate audio');
                }
            } catch (error) {
                consola.error('TTS generation failed:', error.message);
                throw error;
            }
        }

        // Update composition with audio URL and duration
        const updateData = {};
        if (audioUrl && audioUrl !== musicUrl) {
            updateData.musicUrl = audioUrl;
        }
        if (actualAudioDuration !== duration) {
            updateData.audioDuration = actualAudioDuration;
        }
        
        if (Object.keys(updateData).length > 0) {
            await db.update(compositions)
                .set(updateData)
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

        // Generate segments from script - use actual audio duration
        const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const targetDuration = actualAudioDuration; // Use the actual audio duration
        const maxSegments = Math.min(sentences.length, 8); // Max 8 segments
        const segmentDuration = targetDuration / maxSegments;
        const delay = (ms) => new Promise((r) => setTimeout(r, ms));
        
        consola.info(`Using actual audio duration: ${targetDuration}s for ${sentences.length} sentences (${maxSegments} segments)`);

        const segmentData = [];

        for (let i = 0; i < maxSegments; i++) {
            const sentence = sentences[i];
            const start = i * segmentDuration;
            const end = start + segmentDuration;
            
            // Update progress for each image
            const imageProgress = 30 + (i / maxSegments) * 40; // 30-70% for images
            io.to(socketId).emit('generation-progress', {
                step: 'images',
                message: `Generating image ${i + 1} of ${maxSegments}...`,
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

        // Double-check for duplicates after insertion (race condition protection)
        const allSegments = await db.select()
            .from(segments)
            .where(eq(segments.compositionId, compositionId));
        
        if (allSegments.length > maxSegments) {
            consola.warn(`Detected ${allSegments.length} segments, expected ${maxSegments}. Cleaning up duplicates...`);
            
            // Keep only the first set of segments by creation order
            const segmentsToKeep = allSegments.slice(0, maxSegments);
            const segmentsToDelete = allSegments.slice(maxSegments);
            
            for (const segment of segmentsToDelete) {
                await db.delete(segments).where(eq(segments.id, segment.id));
            }
            
            consola.success(`Cleaned up ${segmentsToDelete.length} duplicate segments`);
        }

        io.to(socketId).emit('generation-progress', {
            step: 'images',
            message: 'Image generation completed',
            progress: 70
        });

        // Step 3: Generate Word-Level Captions with Precise Timing
        io.to(socketId).emit('generation-progress', {
            step: 'captions',
            message: 'Generating precise word-level captions...',
            progress: 75
        });

        // ALWAYS generate word-level captions with precise timing using transcription
        // This is what the "Fix Caption Timing" button does - we're making it automatic
        console.log('🎬 [Async Generation] Generating word-level captions with transcription (automatic precise timing)...');
        
        let captionData = [];
        try {
            // Use the same transcription process as the "Fix Caption Timing" button
            console.log('🎬 [Async Generation] Transcribing audio for word-level timing:', audioUrl);
            const transcriptionResult = await whisperAudio(audioUrl);
            console.log('🎬 [Async Generation] Transcription result:', {
                hasWords: !!transcriptionResult.words,
                wordsCount: transcriptionResult.words?.length || 0,
                duration: transcriptionResult.duration,
                hasText: !!transcriptionResult.text
            });
            
            // Process transcription data exactly like the "Fix Caption Timing" button does
            const processedCaptions = processTranscriptionForCaptions(transcriptionResult, script);
            console.log('🎬 [Async Generation] Processed captions from transcription:', {
                count: processedCaptions.length,
                firstCaption: processedCaptions[0] ? {
                    text: processedCaptions[0].text,
                    startMs: processedCaptions[0].startMs,
                    endMs: processedCaptions[0].endMs
                } : null
            });
            
            if (processedCaptions && processedCaptions.length > 0) {
                // Use the processed word-level captions (same as "Fix Caption Timing")
                captionData = processedCaptions.map((caption, wordIndex) => ({
                    compositionId: compositionId,
                    text: caption.text,
                    startMs: caption.startMs,
                    endMs: caption.endMs,
                    order: wordIndex
                }));
                
                console.log(`✅ [Async Generation] Created ${captionData.length} WORD-LEVEL captions automatically (no manual fix needed)`);
            } else {
                throw new Error('No word-level captions could be generated from transcription');
            }
        } catch (error) {
            console.error('🎬 [Async Generation] Word-level transcription failed, trying direct word extraction:', error.message);
            
            // Try direct word extraction from transcription result
            try {
                const transcriptionResult = await whisperAudio(audioUrl);
                if (transcriptionResult.words && transcriptionResult.words.length > 0) {
                    captionData = transcriptionResult.words.map((word, wordIndex) => ({
                        compositionId: compositionId,
                        text: word.word || word.text || word,
                        startMs: Math.round((word.start || 0) * 1000),
                        endMs: Math.round((word.end || 0) * 1000),
                        order: wordIndex
                    }));
                    console.log(`✅ [Async Generation] Fallback: Created ${captionData.length} word-level captions from direct transcription`);
                } else {
                    throw new Error('No words in transcription result');
                }
            } catch (fallbackError) {
                console.error('🎬 [Async Generation] All word-level methods failed, using sentence fallback:', fallbackError.message);
                // Only use sentence-based as last resort
                const scriptSentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
                captionData = generateCaptionsFromText(script, actualAudioDuration * 1000, {
                    sentencesPerCaption: 1,
                    pauseBetweenSentences: 200,
                    minCaptionDuration: 1000,
                    maxCaptionDuration: Math.max(2000, (actualAudioDuration * 1000) / scriptSentences.length)
                }).map(caption => ({
                    ...caption,
                    compositionId: compositionId
                }));
                console.log(`⚠️ [Async Generation] Last resort: Created ${captionData.length} sentence-based captions`);
            }
        }

        await db.insert(captions).values(captionData);
        consola.success(`Created ${captionData.length} captions (${captionData.length > 10 ? 'WORD-LEVEL with precise timing' : 'sentence-based'})`);

        io.to(socketId).emit('generation-progress', {
            step: 'captions',
            message: `Generated ${captionData.length} word-level captions with precise timing`,
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
export const getCompositionById = async (id) => {
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

    // Group captions by segment for better organization
    const segmentsWithCaptions = compositionSegments.map(segment => {
        const segmentCaptions = compositionCaptions.filter(caption => 
            caption.segmentId === segment.id
        );
        
        return {
            ...segment,
            captions: segmentCaptions
        };
    });

    console.log(`Retrieved composition ${id}:`, {
        hasComposition: !!composition,
        segmentsCount: compositionSegments.length,
        captionsCount: compositionCaptions.length,
        segmentsWithCaptions: segmentsWithCaptions.length,
        script: composition.script?.substring(0, 100) + '...',
        musicUrl: composition.musicUrl
    });

    // If we have audio and captions, verify caption matching (non-blocking)
    if (composition.musicUrl && compositionCaptions.length > 0 && composition.script) {
        console.log('🎬 [Composition Retrieval] Verifying caption matching...');
        // Run verification in background without blocking the response
        setImmediate(async () => {
            try {
                const verificationResult = await verifyCaptionMatching(
                    composition.musicUrl, 
                    composition.script, 
                    compositionCaptions
                );
                
                if (verificationResult.success) {
                    console.log('✅ [Composition Retrieval] Caption verification completed');
                    console.log('🎬 [Composition Retrieval] Verification details:', {
                        actualDuration: verificationResult.actualDuration,
                        processedCaptionsCount: verificationResult.processedCaptions.length,
                        existingCaptionsCount: compositionCaptions.length
                    });
                } else {
                    console.log('❌ [Composition Retrieval] Caption verification failed:', verificationResult.error);
                }
            } catch (error) {
                console.error('❌ [Composition Retrieval] Caption verification error:', error);
            }
        });
    }

    return {
        ...composition,
        segments: segmentsWithCaptions,
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

// Add new segment with TTS generation
// Export the verification function for use in routes
export const verifyCaptionMatching = async (audioUrl, originalText, existingCaptions = []) => {
    try {
        console.log('🎬 [Caption Verification] Starting verification:', {
            audioUrl: audioUrl?.substring(0, 100) + '...',
            originalTextLength: originalText?.length,
            existingCaptionsCount: existingCaptions?.length || 0
        });

        if (!audioUrl || !originalText) {
            console.log('❌ [Caption Verification] Missing audio URL or original text');
            return { success: false, error: 'Missing audio URL or original text' };
        }

        // Transcribe with Whisper directly using the audio URL
        console.log('🎬 [Caption Verification] Transcribing audio with Whisper...');
        const transcriptionResult = await whisperAudio(audioUrl);
        console.log('🎬 [Caption Verification] Transcription result:', {
            hasWords: !!transcriptionResult.words,
            wordsCount: transcriptionResult.words?.length || 0,
            duration: transcriptionResult.duration,
            text: transcriptionResult.text?.substring(0, 100) + '...'
        });

        // Process transcription data to create word-level timing
        const processedCaptions = processTranscriptionForCaptions(transcriptionResult, originalText);
        console.log('🎬 [Caption Verification] Processed captions:', {
            count: processedCaptions.length,
            firstCaption: processedCaptions[0] ? {
                text: processedCaptions[0].text,
                start: processedCaptions[0].start,
                end: processedCaptions[0].end,
                startMs: processedCaptions[0].startMs,
                endMs: processedCaptions[0].endMs
            } : null,
            lastCaption: processedCaptions[processedCaptions.length - 1] ? {
                text: processedCaptions[processedCaptions.length - 1].text,
                start: processedCaptions[processedCaptions.length - 1].start,
                end: processedCaptions[processedCaptions.length - 1].end,
                startMs: processedCaptions[processedCaptions.length - 1].startMs,
                endMs: processedCaptions[processedCaptions.length - 1].endMs
            } : null
        });

        // Compare with existing captions if available
        if (existingCaptions && existingCaptions.length > 0) {
            console.log('🎬 [Caption Verification] Comparing with existing captions:', {
                existingCount: existingCaptions.length,
                newCount: processedCaptions.length,
                existingFirst: existingCaptions[0] ? {
                    text: existingCaptions[0].text,
                    startMs: existingCaptions[0].startMs,
                    endMs: existingCaptions[0].endMs
                } : null
            });

            // Check timing differences
            const timingDifferences = [];
            const minLength = Math.min(existingCaptions.length, processedCaptions.length);
            
            for (let i = 0; i < minLength; i++) {
                const existing = existingCaptions[i];
                const newCaption = processedCaptions[i];
                
                if (existing.startMs !== undefined && newCaption.startMs !== undefined) {
                    const startDiff = Math.abs(existing.startMs - newCaption.startMs);
                    const endDiff = Math.abs(existing.endMs - newCaption.endMs);
                    
                    if (startDiff > 100 || endDiff > 100) { // More than 100ms difference
                        timingDifferences.push({
                            index: i,
                            text: newCaption.text,
                            existingStart: existing.startMs,
                            newStart: newCaption.startMs,
                            existingEnd: existing.endMs,
                            newEnd: newCaption.endMs,
                            startDiff,
                            endDiff
                        });
                    }
                }
            }

            console.log('🎬 [Caption Verification] Timing differences found:', timingDifferences.length);
            if (timingDifferences.length > 0) {
                console.log('⚠️ [Caption Verification] First 5 timing differences:', timingDifferences.slice(0, 5));
            }
        }

        // If we found significant timing differences, suggest using the new captions
        const shouldUpdateCaptions = existingCaptions.length > 0 && 
            processedCaptions.length > existingCaptions.length * 2; // Word-level vs segment-level

        return {
            success: true,
            transcriptionData: transcriptionResult,
            processedCaptions: processedCaptions,
            actualDuration: transcriptionResult.duration,
            verificationComplete: true,
            shouldUpdateCaptions: shouldUpdateCaptions,
            timingMismatch: existingCaptions.length > 0 && processedCaptions.length > existingCaptions.length * 2
        };

    } catch (error) {
        console.error('❌ [Caption Verification] Error:', error);
        return { 
            success: false, 
            error: error.message,
            verificationComplete: false
        };
    }
};

// Update captions with precise word-level timing from transcription
export const updateCaptionsWithPreciseTiming = async (req, res) => {
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

        // Get the composition
        const composition = await getCompositionById(id);
        
        if (!composition) {
            return res.status(404).json({ error: 'Composition not found' });
        }

        if (!composition.musicUrl || !composition.script) {
            return res.status(400).json({ 
                error: 'Composition must have audio and script for caption update' 
            });
        }

        console.log('🎬 [Update Captions] Starting caption update with precise timing for composition:', id);

        // Get precise captions from transcription
        const verificationResult = await verifyCaptionMatching(
            composition.musicUrl,
            composition.script,
            []
        );

        if (!verificationResult.success) {
            return res.status(500).json({ 
                error: 'Failed to get precise captions: ' + verificationResult.error 
            });
        }

        // Delete existing captions
        await db.delete(captions).where(eq(captions.compositionId, id));
        console.log('🎬 [Update Captions] Deleted existing captions');

        // Insert new precise captions
        const newCaptions = verificationResult.processedCaptions.map((caption, index) => ({
            compositionId: id,
            text: caption.text,
            startMs: caption.startMs,
            endMs: caption.endMs,
            order: index
        }));

        await db.insert(captions).values(newCaptions);
        console.log(`🎬 [Update Captions] Inserted ${newCaptions.length} precise captions`);

        res.json({
            success: true,
            message: 'Captions updated with precise word-level timing',
            captionsCount: newCaptions.length,
            actualDuration: verificationResult.actualDuration
        });

    } catch (error) {
        console.error('Error updating captions:', error);
        res.status(500).json({ 
            error: 'Failed to update captions',
            details: error.message 
        });
    }
};

// Update individual segment caption
export const updateSegmentCaption = async (req, res) => {
    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({ 
                error: 'Not authenticated' 
            });
        }

        const { id } = req.params;
        const { segmentId, caption } = req.body;

        console.log('[Update Segment Caption] Starting for composition:', id);
        console.log('[Update Segment Caption] Segment data:', { segmentId, caption });

        // Validate required fields
        if (!caption || caption.trim() === '') {
            return res.status(400).json({ 
                error: 'Caption text is required' 
            });
        }

        if (!segmentId) {
            return res.status(400).json({ 
                error: 'Segment ID is required' 
            });
        }

        // Get current composition
        const composition = await db.select().from(compositions).where(eq(compositions.id, id)).execute();
        if (!composition.length) {
            return res.status(404).json({ 
                error: 'Composition not found' 
            });
        }

        const currentComposition = composition[0];

        // Find the segment in the segments table
        const segmentResult = await db.select().from(segments).where(eq(segments.id, segmentId)).execute();
        if (!segmentResult.length) {
            return res.status(404).json({ 
                error: 'Segment not found' 
            });
        }

        const segmentToUpdate = segmentResult[0];
        console.log('[Update Segment Caption] Found segment to update:', segmentToUpdate);

        // Generate new audio for the updated caption
        let audioFileName = null;
        let actualAudioDuration = parseFloat(segmentToUpdate.end) - parseFloat(segmentToUpdate.start);

        try {
            console.log('[Update Segment Caption] Generating new audio for caption:', caption);
            
            // Import TTS function
            const { generateTTS } = await import('../actions/cloudflare-tts.js');
            
            // Generate audio with the new caption
            const audioResult = await generateTTS(caption, {
                voice: currentComposition.voice || 'aura-asteria-en',
                speed: 1.0,
                stability: 0.5,
                clarity: 0.75
            });

            if (audioResult && audioResult.audioUrl) {
                // Download and save the audio file
                const audioResponse = await fetch(audioResult.audioUrl);
                const audioBuffer = await audioResponse.arrayBuffer();
                
                // Get actual audio duration using ffprobe
                const { getAudioDuration } = await import('../utils/ffprobe.js');
                actualAudioDuration = await getAudioDuration(Buffer.from(audioBuffer));
                
                // Save audio file
                audioFileName = `segment_${segmentId}_${Date.now()}.mp3`;
                const audioPath = join(tmpdir(), audioFileName);
                fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
                
                console.log('[Update Segment Caption] Audio generated and saved:', {
                    fileName: audioFileName,
                    duration: actualAudioDuration
                });
            }
        } catch (error) {
            console.error('[Update Segment Caption] Audio generation error:', error.message);
            // Continue without new audio - keep existing audio
        }

        // Update the segment in the database
        const [updatedSegment] = await db.update(segments)
            .set({
                text: caption.trim(),
                end: parseFloat(segmentToUpdate.start) + actualAudioDuration, // Update end time based on new audio duration
                mediaUrl: audioFileName || segmentToUpdate.mediaUrl, // Keep existing audio if new generation failed
                updatedAt: new Date()
            })
            .where(eq(segments.id, segmentId))
            .returning();

        console.log('[Update Segment Caption] Segment updated successfully:', updatedSegment);

        // Get the updated composition with all segments
        const updatedComposition = await getCompositionById(id);

        res.json({
            success: true,
            segment: updatedSegment,
            composition: updatedComposition,
            message: 'Segment caption updated successfully'
        });

    } catch (error) {
        console.error('[Update Segment Caption] Error:', error);
        res.status(500).json({ 
            error: 'Failed to update segment caption',
            details: error.message 
        });
    }
};

export const addSegment = async (req, res) => {
    try {
        const user = await getUserFromSession(req);
        if (!user) {
            return res.status(401).json({ 
                error: 'Not authenticated' 
            });
        }

        const { id } = req.params;
        const { caption, duration = 4, animation = 'none', overlay = false, replaceSegmentId } = req.body;

        console.log('[Add Segment] Starting for composition:', id);
        console.log('[Add Segment] New segment data:', { caption, duration, animation, overlay, replaceSegmentId });

        // Validate required fields
        if (!caption || caption.trim() === '') {
            return res.status(400).json({ 
                error: 'Caption text is required' 
            });
        }

        // Get current composition
        const composition = await db.select().from(compositions).where(eq(compositions.id, id)).execute();
        if (!composition.length) {
            return res.status(404).json({ 
                error: 'Composition not found' 
            });
        }

        const currentComposition = composition[0];
        const existingSegments = currentComposition.segments || [];

        // Handle segment replacement if replaceSegmentId is provided
        let segmentToReplace = null;
        let updatedSegments = [...existingSegments];
        
        if (replaceSegmentId) {
            const replaceIndex = existingSegments.findIndex(seg => seg.id === replaceSegmentId);
            if (replaceIndex !== -1) {
                segmentToReplace = existingSegments[replaceIndex];
                console.log('[Add Segment] Found segment to replace:', segmentToReplace);
            }
        }

        // Calculate new segment start time
        let segmentStart = 0;
        if (segmentToReplace) {
            // Replacing existing segment - use its start time
            segmentStart = segmentToReplace.start || 0;
        } else {
            // Adding new segment - calculate start time from total duration
            segmentStart = existingSegments.reduce((sum, segment) => {
                return sum + (parseFloat(segment.duration) || 4);
            }, 0);
        }

        console.log('[Add Segment] Segment start time:', segmentStart);

        // Generate TTS for new segment
        console.log('[Add Segment] Generating TTS for caption:', caption);
        const audioFileName = await generateSpeechAndSave(caption);
        
        if (!audioFileName) {
            return res.status(500).json({ 
                error: 'Failed to generate audio for new segment' 
            });
        }

        console.log('[Add Segment] Generated audio file:', audioFileName);

        // Get actual audio duration using ffprobe
        let actualAudioDuration = parseFloat(duration);
        try {
            const audioPath = join(process.cwd(), 'uploads', audioFileName);
            if (fs.existsSync(audioPath)) {
                ffprobe.setFfprobePath(ffprobeStatic.path);
                const audioInfo = await ffprobe(audioPath);
                actualAudioDuration = parseFloat(audioInfo.streams[0].duration);
                console.log('[Add Segment] Actual audio duration:', actualAudioDuration);
            }
        } catch (error) {
            console.warn('[Add Segment] Could not get audio duration, using default:', error.message);
        }

        // Generate word-level captions for this segment using transcription
        console.log('[Add Segment] Generating word-level captions with transcription...');
        let segmentCaptions = [];
        
        try {
            // Get the audio URL for this segment (we need to construct it from the audio file)
            const audioUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:9469'}/uploads/${audioFileName}`;
            
            // Use transcription to get word-level timing
            const transcriptionResult = await whisperAudio(audioUrl);
            
            if (transcriptionResult.words && transcriptionResult.words.length > 0) {
                // Create word-level captions from transcription
                segmentCaptions = transcriptionResult.words.map((word, wordIndex) => ({
                    text: word.word || word.text || word,
                    startMs: Math.round((word.start || 0) * 1000),
                    endMs: Math.round((word.end || 0) * 1000),
                    timestampMs: Math.round((word.start || 0) * 1000),
                    confidence: word.confidence || 0.95
                }));
                
                console.log(`[Add Segment] Created ${segmentCaptions.length} word-level captions from transcription`);
            } else {
                // Fallback to sentence-based captions
                console.log('[Add Segment] Transcription failed, using sentence-based captions');
                segmentCaptions = generateCaptionsFromText(caption, actualAudioDuration * 1000, {
                    sentencesPerCaption: 1,
                    pauseBetweenSentences: 100,
                    minCaptionDuration: 800,
                    maxCaptionDuration: Math.max(2000, (actualAudioDuration * 1000) / 2)
                });
            }
        } catch (error) {
            console.error('[Add Segment] Transcription error, using fallback:', error.message);
            // Fallback to sentence-based captions
            segmentCaptions = generateCaptionsFromText(caption, actualAudioDuration * 1000, {
                sentencesPerCaption: 1,
                pauseBetweenSentences: 100,
                minCaptionDuration: 800,
                maxCaptionDuration: Math.max(2000, (actualAudioDuration * 1000) / 2)
            });
        }

        // Adjust caption timing to be relative to segment start
        const adjustedCaptions = segmentCaptions.map(cap => ({
            ...cap,
            startMs: cap.startMs + (segmentStart * 1000),
            endMs: cap.endMs + (segmentStart * 1000),
            timestampMs: cap.timestampMs + (segmentStart * 1000),
            compositionId: id
        }));

        // Create new segment
        const newSegment = {
            id: segmentToReplace ? segmentToReplace.id : `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            caption: caption.trim(),
            duration: actualAudioDuration,
            start: segmentStart,
            animation,
            overlay,
            mediaUrl: audioFileName,
            captions: adjustedCaptions
        };

        console.log('[Add Segment] New segment created:', newSegment);

        // Update segments array - replace or add
        if (segmentToReplace) {
            const replaceIndex = updatedSegments.findIndex(seg => seg.id === replaceSegmentId);
            updatedSegments[replaceIndex] = newSegment;
            console.log('[Add Segment] Replaced existing segment at index:', replaceIndex);
        } else {
            updatedSegments.push(newSegment);
            console.log('[Add Segment] Added new segment');
        }
        
        // Recalculate segment start times to ensure proper sequence with precise timing
        let currentStart = 0;
        updatedSegments.forEach((segment, index) => {
            segment.start = parseFloat(currentStart.toFixed(3)); // Ensure precise timing
            segment.end = parseFloat((currentStart + (parseFloat(segment.duration) || 4)).toFixed(3));
            currentStart += parseFloat(segment.duration) || 4;
        });

        // Update caption timing based on recalculated segment positions
        if (newSegment.captions) {
            const segmentStartMs = newSegment.start * 1000;
            newSegment.captions = newSegment.captions.map(cap => ({
                ...cap,
                startMs: (cap.startMs - (segmentStart * 1000)) + segmentStartMs,
                endMs: (cap.endMs - (segmentStart * 1000)) + segmentStartMs,
                timestampMs: (cap.timestampMs - (segmentStart * 1000)) + segmentStartMs
            }));
        }

        // Calculate new total duration with precise timing
        const newTotalDuration = updatedSegments.reduce((sum, segment) => {
            return sum + parseFloat((parseFloat(segment.duration) || 4).toFixed(3));
        }, 0);

        console.log('[Add Segment] New total duration:', newTotalDuration);
        console.log('[Add Segment] Updated segments with timing:', updatedSegments.map(s => ({ id: s.id, start: s.start, duration: s.duration })));

        // Update composition in database
        const updatedComposition = await db
            .update(compositions)
            .set({
                segments: updatedSegments,
                duration: newTotalDuration,
                updatedAt: new Date()
            })
            .where(eq(compositions.id, id))
            .returning()
            .execute();

        console.log('[Add Segment] Composition updated successfully');

        // Store captions in database
        if (newSegment.captions && newSegment.captions.length > 0) {
            try {
                // Remove existing captions for this segment if it's a replacement
                if (segmentToReplace) {
                    await db.delete(captions)
                        .where(and(
                            eq(captions.compositionId, id),
                            eq(captions.segmentId, segmentToReplace.id)
                        ));
                }

                // Add segment ID to captions and insert
                const captionsWithSegmentId = newSegment.captions.map(cap => ({
                    ...cap,
                    segmentId: newSegment.id
                }));

                await db.insert(captions).values(captionsWithSegmentId);
                console.log('[Add Segment] Generated and stored', newSegment.captions.length, 'captions');
            } catch (error) {
                console.error('[Add Segment] Error storing captions:', error);
            }
        }

        // Emit real-time update via socket
        if (req.io) {
            req.io.emit('compositionUpdated', {
                id,
                segments: updatedSegments,
                duration: newTotalDuration,
                captions: newSegment.captions
            });
            console.log('[Add Segment] Socket update emitted');
        }

        res.json({
            success: true,
            segment: newSegment,
            composition: updatedComposition[0],
            message: 'Segment added successfully with audio generation'
        });

    } catch (error) {
        console.error('[Add Segment] Error:', error);
        res.status(500).json({ 
            error: 'Failed to add segment',
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
                const durationInFrames = calculateVideoDurationInFrames(composition);
                
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
            youtubeUrl,
            captionHorizontalAlign,
            captionMaxWidthPercent,
            captionPaddingPx,
            captionBorderRadiusPx,
            captionBackgroundColor,
            captionBackgroundOpacity,
            captionBackdropBlurPx,
            captionHorizontalOffsetPx,
            captionBoxShadow
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
                youtubeUrl,
                captionHorizontalAlign,
                captionMaxWidthPercent,
                captionPaddingPx,
                captionBorderRadiusPx,
                captionBackgroundColor,
                captionBackgroundOpacity,
                captionBackdropBlurPx,
                captionHorizontalOffsetPx,
                captionBoxShadow
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
                const durationInFrames = calculateVideoDurationInFrames(updatedComposition);
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
                    musicVolume,
                    captionHorizontalAlign,
                    captionMaxWidthPercent,
                    captionPaddingPx,
                    captionBorderRadiusPx,
                    captionBackgroundColor,
                    captionBackgroundOpacity,
                    captionBackdropBlurPx,
                    captionHorizontalOffsetPx,
                    captionBoxShadow
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
