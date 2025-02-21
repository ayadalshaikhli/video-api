import fetch from "node-fetch";
import { consola } from "consola";
import { retryFunction } from "../utils/utils.js";

export const generateImagePrompts = async (transcriptionText, videoStylePrompt, numImages) => {
  try {
    // Build a prompt with strict instructions: no extra words, no introductions.
    const prompt = `You are an assistant that generates creative image prompts for video content.
    Using the following article content: "${transcriptionText}",
    generate exactly ${numImages} highly detailed, creative, and unique image prompts that tell a coherent story.
    The first prompt should set the scene and establish the narrative.
    The following prompts must progress logically through the key events of the story.
    The final prompt should depict the narrative’s climax or final outcome.
    Each prompt must be a single, self-contained sentence that describes a unique scene with specific visual details (subjects, environment, lighting, colors, and mood).
    Respond with a comma-separated list of exactly ${numImages} prompts and nothing else.`;

    consola.info("LLM Image Prompt Request sent.");

    const token = process.env.CLOUDFLARE_API_KEY;
    if (!token) {
      throw new Error("Cloudflare API token is not set in environment variables");
    }

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/google/gemma-2b-it-lora`;

    const payload = {
      messages: [
        {
          role: "system",
          content:
            `Respond with a comma-separated list of exactly ${numImages} image prompts and nothing else.
Do NOT include any extra words or commentary.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 600,
      temperature: 0.2
    };

    const apiCall = async () => {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
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

    let rawOutput = result?.result?.response;
    consola.info("Raw LLM output:", rawOutput);

    // Remove any leading/trailing brackets, newlines, and unwanted introductory text.
    let cleaned = rawOutput
      .replace(/[\[\]\n]/g, "")  // Remove brackets & newlines
      .replace(/^\s*(Sure[,\s]*|Here are[,\s]*)/i, "")  // Remove "Sure" or "Here are" at start
      .replace(/here are \d+ image prompts based on the article content:\s*/i, "") // Remove phrases like "here are 4 image prompts based on the article content:"
      .trim();

    // Split the cleaned output using numbered markers (e.g., "1. ", "2. ", etc.)
    let promptsArray = cleaned.split(/\d+\.\s+/).filter(s => s.length > 0);

    // Ensure exactly numImages prompts
    while (promptsArray.length < numImages) {
      promptsArray.push(promptsArray[promptsArray.length - 1]); // Repeat the last prompt if missing
    }
    promptsArray = promptsArray.slice(0, numImages);

    return promptsArray;
  } catch (error) {
    consola.error("Error generating image prompts:", error.message);
    throw error;
  }
};
