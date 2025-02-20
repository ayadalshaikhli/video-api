import fetch from 'node-fetch';
import { consola } from 'consola';
import { retryFunction } from '../utils/utils.js';

// Helper to extract a JSON array from text using regex.
function extractJsonArray(text) {
  // Use a regex to capture the first JSON array block (including newlines)
  const match = text.match(/\[.*\]/s);
  // If a match is found, remove any trailing commas before } or ]
  return match ? match[0].replace(/,\s*([\]}])/g, '$1') : text;
}

/**
 * generateImagePrompts
 * @param {string} transcriptionText - The full transcription text (article content).
 * @param {string} videoStyleGuidelines - Video style guidelines as a string.
 * @param {number} numImages - The desired number of image prompts.
 * @returns {Promise<string[]>} - Resolves with an array of text prompts.
 */
export const generateImagePrompts = async (transcriptionText, videoStyleGuidelines, numImages) => {
  try {
    // Construct the prompt with explicit instructions.
    const prompt = `You are an assistant that generates creative image prompts for video content.
Using the following article content: "${transcriptionText}"
and the video style guidelines: "${videoStyleGuidelines}",
generate exactly ${numImages} highly detailed, creative, and unique image prompts that relate directly to the article.
Each prompt must be a single, self-contained sentence describing a unique scene with specific visual details (subjects, environment, lighting, colors, and mood).
Your response must be ONLY a valid JSON array of ${numImages} strings and nothing else.`;

    consola.info("LLM Image Prompt Request sent.");

    const token = process.env.CLOUDFLARE_API_KEY;
    if (!token) {
      throw new Error("Cloudflare API token is not set in environment variables");
    }

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-2-7b-chat-fp16`;

    const payload = {
      messages: [
        {
          role: "system",
          content: "Respond ONLY with a JSON array of strings and nothing else. Do not include any extra text or commentary. Avoid NSFW content."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 600, // increased tokens to help ensure complete output
      temperature: 0.2
    };

    const apiCall = async () => {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(`LLM API error: ${res.statusText}`);
      }
      return res.json();
    };

    const result = await retryFunction(apiCall, 3, 1000);
    consola.info("LLM Response received.");

    const rawOutput = result?.result?.response;
    consola.info("Raw LLM output:", rawOutput);

    // Directly extract the JSON array without an explicit check.
    const jsonArrayText = extractJsonArray(rawOutput);
    consola.info("Extracted JSON array text:", jsonArrayText);

    let promptsArray = JSON.parse(jsonArrayText);
    // Map each item to a string: if it's an object with a 'scene' key, extract it.
    promptsArray = promptsArray.map(item => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "object" && item.scene) return item.scene.trim();
      return JSON.stringify(item).trim();
    });

    return promptsArray;
  } catch (error) {
    consola.error("Error generating image prompts:", error.message);
    throw error;
  }
};
