// actions/cloudflare-tts.js
import { db } from "../lib/db/drizzle.js";
import { userAudioGenerations } from "../lib/db/schema.js";
import { Buffer } from "buffer";
import { uploadAudioFile } from "./cloudflare.js";
import { getUser } from "../lib/db/queries.js";
import crypto from "crypto";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autoRetryFetch(url, options, retries = 5, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            await sleep(delay);
            delay *= 2;
        }
    }
}

async function autoRetryUpload(uploadFunction, buffer, filename, mimeType, retries = 5, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await uploadFunction(buffer, filename, mimeType);
            return result;
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            await sleep(delay);
            delay *= 2;
        }
    }
}

// Available Deepgram Aura voices
export const CLOUDFLARE_VOICES = {
    'angus': 'Angus - Deep male voice',
    'asteria': 'Asteria - Female voice',
    'arcas': 'Arcas - Male voice', 
    'orion': 'Orion - Male voice',
    'orpheus': 'Orpheus - Male voice',
    'athena': 'Athena - Female voice',
    'luna': 'Luna - Female voice',
    'zeus': 'Zeus - Powerful male voice',
    'perseus': 'Perseus - Male voice',
    'helios': 'Helios - Male voice',
    'hera': 'Hera - Female voice',
    'stella': 'Stella - Female voice'
};

export async function generateCloudflareAuraTTS({
    prompt,
    speaker = 'angus', // Default speaker
    userOverride, // optional: provided by the controller
    encoding = 'mp3',
    container = 'none',
    sample_rate = 24000,
    bit_rate = 128000
}) {
    console.log("🎤 Starting Cloudflare Deepgram Aura TTS generation...");
    console.log("Text:", prompt);
    console.log("Speaker:", speaker);

    if (!prompt || prompt.trim().length === 0) {
        throw new Error("Text prompt is required for TTS generation");
    }

    // Validate speaker
    if (!CLOUDFLARE_VOICES[speaker]) {
        console.warn(`Invalid speaker '${speaker}', using default 'angus'`);
        speaker = 'angus';
    }

    // Determine user for database logging
    let userId = null;
    if (userOverride && userOverride.id) {
        userId = userOverride.id;
    } else {
        try {
            const user = await getUser();
            userId = user?.id || null;
        } catch (error) {
            console.warn("Could not get user for TTS generation:", error.message);
        }
    }

    const requestBody = {
        text: prompt,
        speaker: speaker,
        encoding: encoding,
        container: container,
        sample_rate: sample_rate,
        bit_rate: bit_rate
    };

    console.log("Cloudflare Aura TTS request body:", JSON.stringify(requestBody, null, 2));

    try {
        console.log("Sending request to Cloudflare AI API...");
        
        const response = await autoRetryFetch(
            `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/deepgram/aura-1`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            }
        );

        console.log("Cloudflare TTS response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Cloudflare TTS API error:", errorText);
            throw new Error(`Cloudflare TTS API failed with status ${response.status}: ${errorText}`);
        }

        // Get the audio buffer directly from the response
        const audioBuffer = await response.arrayBuffer();
        const audioSize = audioBuffer.byteLength;
        
        console.log(`✅ Cloudflare TTS generated ${audioSize} bytes of audio`);

        if (audioSize === 0) {
            throw new Error("Received empty audio response from Cloudflare TTS");
        }

        // Convert to Buffer for upload
        const buffer = Buffer.from(audioBuffer);
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(3).toString('hex');
        const filename = `cloudflare-tts-${timestamp}-${randomString}.mp3`;

        console.log("Uploading audio to Cloudflare R2...");
        
        // Upload to Cloudflare R2
        const uploadResult = await autoRetryUpload(
            uploadAudioFile,
            buffer,
            filename,
            'audio/mpeg'
        );

        console.log("✅ Audio uploaded successfully:", uploadResult);

        // Calculate audio duration (approximate based on text length and speaking rate)
        // This is an estimation - actual duration will be detected later in the controller
        const wordsCount = prompt.split(/\s+/).length;
        const estimatedDuration = Math.max(2, wordsCount * 0.6); // ~0.6 seconds per word (more realistic)

        // Log to database if user is available
        if (userId) {
            try {
                const generationRecord = {
                    userId: userId,
                    prompt: prompt,
                    audioUrl: uploadResult,
                    provider: 'cloudflare-aura',
                    voiceId: speaker,
                    duration: estimatedDuration,
                    characterCount: prompt.length,
                    createdAt: new Date()
                };

                await db.insert(userAudioGenerations).values(generationRecord);
                console.log("✅ TTS generation logged to database");
            } catch (dbError) {
                console.warn("Failed to log TTS generation to database:", dbError.message);
            }
        }

        return {
            success: true,
            audioUrl: uploadResult,
            filename: filename,
            duration: estimatedDuration,
            characterCount: prompt.length,
            speaker: speaker,
            provider: 'cloudflare-aura'
        };

    } catch (error) {
        console.error("❌ Cloudflare TTS generation failed:", error);
        throw new Error(`Cloudflare TTS generation failed: ${error.message}`);
    }
}
