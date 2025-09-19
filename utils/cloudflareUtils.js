import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 configuration
const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_ACCESS_KEY_SECRET,
    },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET;

/**
 * Upload file to Cloudflare R2
 */
export const uploadToR2 = async (file, key, contentType) => {
    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: file,
            ContentType: contentType,
        });

        await r2Client.send(command);
        
        // Return public URL using the dev endpoint for public access
        return `${process.env.CLOUDFLARE_R2_DEV_ENDPOINT}/${key}`;
    } catch (error) {
        console.error('Error uploading to R2:', error);
        throw new Error('Failed to upload file to R2');
    }
};

/**
 * Generate presigned URL for upload
 */
export const generatePresignedUploadUrl = async (key, contentType, expiresIn = 3600) => {
    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn });
        return presignedUrl;
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        throw new Error('Failed to generate presigned URL');
    }
};

/**
 * Generate presigned URL for download
 */
export const generatePresignedDownloadUrl = async (key, expiresIn = 3600) => {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn });
        return presignedUrl;
    } catch (error) {
        console.error('Error generating download URL:', error);
        throw new Error('Failed to generate download URL');
    }
};

/**
 * Generate AI images using Cloudflare Workers AI
 */
export const generateAIImage = async (prompt, options = {}) => {
    // Check if Cloudflare AI is configured
    if (!process.env.CLOUDFLARE_AI_BASE_URL || !process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_AI_TOKEN) {
        throw new Error('Cloudflare AI not configured');
    }
    
    try {
        const {
            model = 'flux-dev',
            width = 1024,
            height = 1024,
            steps = 20,
            guidance = 7.5
        } = options;

        const response = await fetch(`${process.env.CLOUDFLARE_AI_BASE_URL}/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                width,
                height,
                steps,
                guidance,
                num_inference_steps: steps,
                guidance_scale: guidance,
            }),
        });

        if (!response.ok) {
            throw new Error(`AI image generation failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        // Upload generated image to R2
        const imageKey = `ai-images/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
        const imageUrl = await uploadToR2(result.data, imageKey, 'image/png');
        
        return {
            success: true,
            imageUrl,
            prompt,
            metadata: {
                model,
                width,
                height,
                steps,
                guidance
            }
        };
    } catch (error) {
        console.error('Error generating AI image:', error);
        throw new Error('Failed to generate AI image');
    }
};

/**
 * Generate text-to-speech using Cloudflare Workers AI
 */
export const generateTTS = async (text, options = {}) => {
    // Check if Cloudflare AI is configured
    if (!process.env.CLOUDFLARE_AI_BASE_URL || !process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_AI_TOKEN) {
        throw new Error('Cloudflare AI not configured');
    }
    
    try {
        const {
            voice = 'alloy',
            model = 'tts-1',
            speed = 1.0
        } = options;

        const response = await fetch(`${process.env.CLOUDFLARE_AI_BASE_URL}/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                voice,
                speed,
            }),
        });

        if (!response.ok) {
            throw new Error(`TTS generation failed: ${response.statusText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        
        // Upload generated audio to R2
        const audioKey = `tts-audio/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
        const audioUrl = await uploadToR2(audioBuffer, audioKey, 'audio/mpeg');
        
        return {
            success: true,
            audioUrl,
            text,
            metadata: {
                voice,
                model,
                speed,
                duration: 0 // Would need to calculate this
            }
        };
    } catch (error) {
        console.error('Error generating TTS:', error);
        throw new Error('Failed to generate TTS');
    }
};

/**
 * Transcribe audio using Cloudflare Workers AI
 */
export const transcribeAudio = async (audioUrl, options = {}) => {
    try {
        const {
            model = 'whisper-1',
            language = 'en',
            responseFormat = 'json'
        } = options;

        // Download audio file
        const audioResponse = await fetch(audioUrl);
        const audioBuffer = await audioResponse.arrayBuffer();

        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
        formData.append('model', model);
        formData.append('language', language);
        formData.append('response_format', responseFormat);

        const response = await fetch(`${process.env.CLOUDFLARE_AI_BASE_URL}/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`,
            },
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Transcription failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        return {
            success: true,
            transcription: result.text,
            segments: result.segments || [],
            metadata: {
                model,
                language,
                duration: result.duration || 0
            }
        };
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw new Error('Failed to transcribe audio');
    }
};

/**
 * Generate multiple AI images for segments
 */
export const generateSegmentImages = async (segments, basePrompt = '') => {
    try {
        const imagePromises = segments.map(async (segment, index) => {
            const prompt = basePrompt ? `${basePrompt}, ${segment.text}` : segment.text;
            
            const result = await generateAIImage(prompt, {
                width: 1080,
                height: 1920,
                steps: 15,
                guidance: 7.0
            });
            
            return {
                segmentId: segment.id,
                imageUrl: result.imageUrl,
                prompt: result.prompt
            };
        });

        const results = await Promise.all(imagePromises);
        
        return {
            success: true,
            images: results
        };
    } catch (error) {
        console.error('Error generating segment images:', error);
        throw new Error('Failed to generate segment images');
    }
};

/**
 * Process composition with AI services
 */
export const processCompositionWithAI = async (composition) => {
    // Check if Cloudflare AI is configured
    if (!process.env.CLOUDFLARE_AI_BASE_URL || !process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_AI_TOKEN) {
        throw new Error('Cloudflare AI not configured');
    }
    
    try {
        const results = {
            audioUrl: null,
            images: [],
            captions: []
        };

        // Generate TTS
        if (composition.script) {
            const ttsResult = await generateTTS(composition.script, {
                voice: composition.voice || 'alloy'
            });
            results.audioUrl = ttsResult.audioUrl;
        }

        // Generate images for segments
        if (composition.segments && composition.segments.length > 0) {
            const imageResults = await generateSegmentImages(composition.segments);
            results.images = imageResults.images;
        }

        // Generate captions from script
        if (composition.script) {
            const { generateCaptionsFromText } = await import('./captionUtils.js');
            const captions = generateCaptionsFromText(composition.script, 30000); // 30 seconds default
            results.captions = captions;
        }

        return {
            success: true,
            results
        };
    } catch (error) {
        console.error('Error processing composition with AI:', error);
        throw new Error('Failed to process composition with AI');
    }
};

