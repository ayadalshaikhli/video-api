// actions/generateSpeechAndSave.js
import { db } from "../lib/db/drizzle.js";
import { voices, userAudioGenerations } from "../lib/db/schema.js";
import { Buffer } from "buffer";
import { uploadAudioFile, uploadVoiceFile } from "./cloudflare.js";
import { getUser } from "../lib/db/queries.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autoRetryFetch(url, options, retries = 10, delay = 1000) {
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

async function autoRetryUpload(uploadFunction, buffer, filename, mimeType, retries = 10, delay = 1000) {
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

export async function generateSpeechAndSave({
    prompt,
    voiceId,
    clonedVoiceFile, // expected from multer (if provided)
    languageIsoCode,
    userOverride, // optional: provided by the controller
    // Advanced Zyphra options (model/format fixed internally)
    speakingRate = 15,
    emotionSettings = {},
    pitchStd = 45.0
}) {

    console.log("Generating speech and saving...");

    // Log the input parameters
    console.log("Prompt:", prompt);
    console.log("Voice ID:", voiceId);
    console.log("Language ISO Code:", languageIsoCode);

    let user = userOverride;
    if (!user) {
        console.log("No user provided, attempting to get user...");
        user = await getUser();
    }

    if (!user) {
        console.error("User not authenticated");
        throw new Error("User not authenticated");
    }

    console.log("Authenticated User:", user.id);

    let speakerAudioBase64 = null;

    // If a cloned voice file is provided, use it directly
    if (clonedVoiceFile) {
        console.log("Cloned voice file provided, converting to base64...");
        const arrayBuffer = clonedVoiceFile.buffer;
        speakerAudioBase64 = Buffer.from(arrayBuffer).toString("base64");
    }
    // Otherwise, fetch the selected voice from the database if voiceId is provided
    else if (voiceId && voiceId !== "default") {
        console.log("Fetching selected voice from database for voiceId:", voiceId);
        const [voice] = await db.select().from(voices).where(eq(voices.id, voiceId));

        if (voice) {
            console.log("Voice found in DB. Fetching voice file...");
            const voiceResponse = await autoRetryFetch(voice.voiceUrl, {
                method: "GET",
                headers: {
                    "X-API-Key": process.env.ZYPHRA_API_KEY || "",
                },
            });

            if (voiceResponse.ok) {
                const voiceArrayBuffer = await voiceResponse.arrayBuffer();
                speakerAudioBase64 = Buffer.from(voiceArrayBuffer).toString("base64");
                console.log("Voice file fetched and converted to base64.");
            } else {
                console.error("Failed to fetch the selected voice file");
                throw new Error("Failed to fetch the selected voice file");
            }
        } else {
            console.error("No voice found in DB for voiceId:", voiceId);
        }
    }

    // Clean the text for TTS processing
    const cleanedPrompt = prompt
        .replace(/\*([^*]+)\*/g, '$1') // Remove markdown bold formatting
        .replace(/…/g, '...') // Replace ellipsis with three dots
        .replace(/[^\w\s.,!?;:'"-]/g, '') // Remove special characters that might cause issues
        .trim();

    console.log("Original text length:", prompt.length);
    console.log("Cleaned text length:", cleanedPrompt.length);
    console.log("Text cleaning applied:", prompt !== cleanedPrompt);

    const requestBody = {
        text: cleanedPrompt,
        speaking_rate: speakingRate,
        mime_type: 'audio/mpeg',
        language_iso_code: languageIsoCode,
        model: 'zonos-v0.1-transformer',
        ...(speakerAudioBase64 && { speaker_audio: speakerAudioBase64 }),
    };

    // Add model-specific parameters
    // Keep payload minimal to match Zyphra schema — no emotion or pitchStd

    console.log("Zyphra API request body:", JSON.stringify(requestBody, null, 2));
    console.log("Text length:", prompt.length, "characters");
    console.log("Text preview:", prompt.substring(0, 100) + "...");

    try {
        console.log("Sending request to Zyphra API...");
        // Retry the API call if necessary
        let response = await autoRetryFetch(
            "http://api.zyphra.com/v1/audio/text-to-speech",
            {
                method: "POST",
                headers: {
                    "X-API-Key": process.env.ZYPHRA_API_KEY || "",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok && response.status === 422) {
            try {
                const body = await response.text();
                console.warn('Zyphra 422 body:', body?.slice(0, 500));
            } catch {}
            const minimalBody = {
                text: prompt,
                speaking_rate: speakingRate,
                language_iso_code: languageIsoCode,
                model: 'zonos-v0.1-transformer',
                mime_type: 'audio/mpeg'
            };
            response = await autoRetryFetch(
                "http://api.zyphra.com/v1/audio/text-to-speech",
                {
                    method: "POST",
                    headers: {
                        "X-API-Key": process.env.ZYPHRA_API_KEY || "",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(minimalBody),
                }
            );
        }

        if (!response.ok) {
            const status = response.status;
            let body = '';
            try { body = await response.text(); } catch {}
            console.error("API request failed", status, body?.slice(0, 500));
            throw new Error(`API request failed with status ${status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log("Response body received and converted to array buffer.");
        console.log("Audio buffer size:", arrayBuffer.byteLength, "bytes");
        console.log("Response headers:", Object.fromEntries(response.headers.entries()));

        const audioBuffer = Buffer.from(arrayBuffer);
        console.log("Audio buffer created.");

        // Upload as MP3
        console.log("Uploading audio file...");
        const uploadAudioResult = await autoRetryUpload(uploadAudioFile, audioBuffer, 'audio.mp3', 'audio/mp3');
        const audioPublicUrl = uploadAudioResult.publicUrl || uploadAudioResult;
        console.log("Audio file uploaded successfully:", audioPublicUrl);

        // Save the generated audio URL to the database
        const [record] = await db
            .insert(userAudioGenerations)
            .values({
                userId: user.id,
                voiceId: voiceId === "default" ? null : voiceId,
                prompt,
                audioUrl: audioPublicUrl,
            })
            .returning();

        console.log("Speech generation and saving successful. Database record created:", record);

        // Return both the record and the audio buffer for direct use
        return {
            ...record,
            audioBuffer: audioBuffer.toString('base64'),
            audioMimeType: 'audio/mp3'
        };

    } catch (error) {
        console.error("Error during speech generation and saving:", error);
        throw error;
    }
}


export async function uploadVoice(file, userOverride) {
    let user = userOverride;
    if (!user) {
        user = await getUser();
    }
    if (!user) {
        throw new Error("User not authenticated");
    }
    const nameWithoutExtension = file.originalname.replace(/\.[^/.]+$/, "");

    // Adjust uploadVoiceFile() to accept a Buffer, filename, and mimetype.
    const uploadResult = await autoRetryUpload(uploadVoiceFile, file.buffer, file.originalname, file.mimetype);

    const [newVoice] = await db
        .insert(voices)
        .values({
            name: nameWithoutExtension,
            voiceUrl: uploadResult.publicUrl,
            createdBy: user.id,
            isSystem: false,
        })
        .returning();

    return newVoice;
}

export async function uploadConvertedVoice(convertedVoiceData, user) {
    // You might want to generate a default name from the original file name:
    const nameWithoutExtension = convertedVoiceData.originalname.replace(/\.[^/.]+$/, "");

    // Insert the new voice into the database (adjust field names as needed).
    const [newVoice] = await db
        .insert(voices)
        .values({
            name: nameWithoutExtension,
            voiceUrl: convertedVoiceData.publicUrl,
            createdBy: user.id,
            isSystem: false,
        })
        .returning();
    return newVoice;
}
