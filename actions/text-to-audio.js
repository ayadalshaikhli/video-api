// actions/generateSpeechAndSave.js
import { db } from "../lib/db/drizzle.js";
import { voices, userAudioGenerations } from "../lib/db/schema.js";
import { Buffer } from "buffer";
import { uploadAudioFile, uploadVoiceFile } from "./cloudflare.js";
import { getUser } from "../lib/db/queries.js"; // fallback if user not provided via userOverride
import { eq } from "drizzle-orm";
import crypto from "crypto";

// Helper: sleep for a specified number of milliseconds.
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Auto-retry fetch helper with exponential backoff.
async function autoRetryFetch(url, options, retries = 3, delay = 1000) {
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

export async function generateSpeechAndSave({
    prompt,
    voiceId,
    clonedVoiceFile, // expected from multer (if provided)
    languageIsoCode,
    userOverride, // optional: provided by the controller
}) {
    let user = userOverride;
    if (!user) {
        user = await getUser();
    }
    if (!user) {
        throw new Error("User not authenticated");
    }

    let speakerAudioBase64 = null;
    // If a cloned voice file is provided, use it directly.
    if (clonedVoiceFile) {
        // For multer, file data is in file.buffer
        const arrayBuffer = clonedVoiceFile.buffer;
        speakerAudioBase64 = Buffer.from(arrayBuffer).toString("base64");
    }
    // Otherwise, if a saved voice is selected, fetch it from DB and convert.
    else if (voiceId && voiceId !== "default") {
        const [voice] = await db.select().from(voices).where(eq(voices.id, voiceId));
        if (voice) {
            const voiceResponse = await fetch(voice.voiceUrl);
            if (voiceResponse.ok) {
                const voiceArrayBuffer = await voiceResponse.arrayBuffer();
                speakerAudioBase64 = Buffer.from(voiceArrayBuffer).toString("base64");
            } else {
                throw new Error("Failed to fetch the selected voice file");
            }
        }
    }

    const requestBody = {
        text: prompt,
        speaking_rate: 15,
        mime_type: "audio/webm",
        language_iso_code: languageIsoCode,
        ...(speakerAudioBase64 && { speaker_audio: speakerAudioBase64 }),
    };

    const response = await autoRetryFetch(
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

    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    // In Node, use Buffer directly instead of Blob/File.
    const audioBuffer = Buffer.from(arrayBuffer);
    // Adjust your uploadAudioFile() so that it accepts a Buffer, filename, and mime type.
    const uploadAudioResult = await uploadAudioFile(audioBuffer, "audio.webm", "audio/webm");

    const [record] = await db
        .insert(userAudioGenerations)
        .values({
            userId: user.id,
            voiceId: voiceId === "default" ? null : voiceId,
            prompt,
            audioUrl: uploadAudioResult.publicUrl,
        })
        .returning();

    return record;
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
    const uploadResult = await uploadVoiceFile(file.buffer, file.originalname, file.mimetype);

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
