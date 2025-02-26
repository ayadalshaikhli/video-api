import axios from 'axios';
import { consola } from 'consola';
import { retryFunction } from '../utils/utils.js';
import fs from 'fs';

export const whisperAudio = async (audioUrl, saveToFile = false) => {
    try {
        // Your Cloudflare API credentials
        const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const cfApiToken = process.env.CLOUDFLARE_API_KEY;
        const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/openai/whisper`;

        // Check for valid Cloudflare API credentials
        if (!cfAccountId || !cfApiToken) {
            consola.error("❌ Cloudflare API credentials are not set in environment variables!");
            throw new Error("Cloudflare API credentials not configured");
        }

        // Fetch the audio file from the provided URL (binary data)
        const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
        consola.info("✅ Audio file fetched.");

        // Prepare the API request payload (raw binary audio)
        const data = response.data;

        // Retry the API call if necessary
        const transcriptionResponse = await retryFunction(async () => {
            consola.info("🚀 Sending audio to Cloudflare Whisper API for transcription...");
            const response = await axios.post(apiUrl, data, {
                headers: {
                    'Authorization': `Bearer ${cfApiToken}`,
                    'Content-Type': 'application/octet-stream',
                }
            });

            consola.info("📡 Cloudflare Whisper API response status:", response.status);
            return response;
        });

        // Check the status of the transcription response
        if (transcriptionResponse.status !== 200) {
            consola.error(`❌ Transcription failed with status: ${transcriptionResponse.status}`);
            throw new Error(`Transcription failed with status: ${transcriptionResponse.status}`);
        }

        // Extract the full response data
        const responseData = transcriptionResponse.data;

        // Create a complete transcription result object
        const transcriptionResult = {
            text: responseData.result.text || null,
            wordCount: responseData.result.word_count || 0,
            vtt: responseData.result.vtt || null,
            words: responseData.result.words || [],
            success: responseData.success,
            errors: responseData.errors,
            messages: responseData.messages
        };
        consola.log(transcriptionResult)
        consola.info("✅ Transcription completed successfully.");

        // If saveToFile is true, save the complete transcription data
        if (saveToFile) {
            const fileData = {
                ...transcriptionResult,
                timestamp: new Date().toISOString(),
            };

            fs.writeFileSync(
                './transcriptionResult.json',
                JSON.stringify(fileData, null, 2),
                'utf-8'
            );
            consola.info("✅ Transcription saved to 'transcriptionResult.json'.");
        }

        return transcriptionResult;

    } catch (error) {
        consola.error(`❌ Error in transcribing audio with Cloudflare Whisper: ${error.message}`);
        throw error;
    }
};