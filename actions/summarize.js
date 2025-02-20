import fetch from 'node-fetch';
import { consola } from 'consola';
import { retryFunction } from '../utils/utils.js';  // Import retry function from utils

export const summarizeText = async (text) => {
    try {
        // Log the incoming content
        consola.info("Text received for storytelling:", text.slice(0, 100)); // Log the first 100 chars

        if (!text || text.trim().length === 0) {
            consola.error("❌ The text provided is empty or invalid.");
            return "No story generated"; // Return early if content is invalid
        }

        // Check the Cloudflare API token
        consola.info("Checking Cloudflare API token...");
        const apiToken = process.env.CLOUDFLARE_API_KEY;
        if (!apiToken) {
            consola.error("❌ Cloudflare API Token is not set in environment variables!");
            throw new Error("Cloudflare API Token not configured");
        }

        // Build the prompt text for telling a story
        // We pass only the first 50 characters for demonstration
        const promptText = `Tell me a short, engaging story about the following text: "${text.slice(0, 50)}..."`;

        // Prepare the API request payload
        const payload = {
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant tasked with telling a creative story based on the user's text. Avoid using emojis in your response."
                },
                {
                    role: "user",
                    content: promptText
                }
            ],
            max_tokens: 200, // Adjust based on how long you want the story
            temperature: 0.7  // Higher temperature for more creativity
        };

        // Log the request payload
        consola.info("📦 Request payload:", payload);

        // Construct the API call, wrapped in a retry function
        const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-2-7b-chat-fp16`;
        const apiCall = async () => {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Cloudflare API error: ${response.statusText}`);
            }
            return await response.json();
        };

        // Retry the API call (3 attempts, 1 second between each)
        const result = await retryFunction(apiCall, 3, 1000);
        consola.info(`📡 Cloudflare API response: ${JSON.stringify(result, null, 2)}`);

        // Extract the story text from the response
        const story = result?.result?.response?.trim() || "No story generated";

        if (!story || story === "No story generated") {
            consola.error("❌ No story was generated by the Cloudflare API.");
            return "No story generated";
        }

        // Remove non-ASCII characters (e.g., emojis)
        const cleanedStory = story.replace(/[^\x00-\x7F]/g, "").trim();

        if (!cleanedStory) {
            consola.error("❌ No valid story generated.");
            return "No story generated";
        }

        consola.info("✅ Story generated successfully");
        return cleanedStory;

    } catch (error) {
        consola.error(`❌ Error in generating story: ${error.message}`);
        throw error;
    }
};
