import fetch from 'node-fetch';
import { consola } from 'consola';
import { retryFunction } from '../utils/utils.js';  // Import retry function from utils

export const summarizeText = async (text) => {
    try {
        // Log the incoming content
        consola.info("Text received for summarization:", text.slice(100, 200)); // Log the first 100 chars

        if (!text || text.trim().length === 0) {
            consola.error("❌ The text provided is empty or invalid.");
            return "No summary generated"; // Return early if content is invalid
        }

        // Log the environment variable to ensure it's available
        consola.info("Checking Cloudflare API token...");

        const apiToken = process.env.CLOUDFLARE_API_KEY;
        if (!apiToken) {
            consola.error("❌ Cloudflare API Token is not set in environment variables!");
            throw new Error("Cloudflare API Token not configured");
        }

        // Log the input text to be sent to the model (limited to the first 100 characters for debugging)
        consola.info(`🚀 Sending request to Cloudflare with the following text: ${text.slice(100, 200)}...`);

        const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-2-7b-chat-fp16`;

        // Modify the system message to ensure no emojis are used
        const promptText = `Did you know that ${text.slice(0, 50)}?`;

        // Prepare the API request payload
        const payload = {
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant tasked with summarizing and rephrasing articles in a way that starts with a conversational tone. Begin with phrases like 'Did you know that' or 'Here's an interesting fact' to make the summary sound like a story. Avoid using emojis in the response."
                },
                {
                    role: "user",
                    content: promptText
                }
            ],
            max_tokens: 200, // Adjust based on expected length of summary
            temperature: 0.5
        };

        // Log the request payload
        consola.info("📦 Request payload:", payload);

        // Wrap the API call in retry logic
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

        // Retry the API call with 3 attempts and 1000ms delay between retries
        const result = await retryFunction(apiCall, 3, 1000); // 3 retries, initial delay of 1000ms
        console.log("results", result);
        // Log the raw response for debugging
        consola.info(`📡 Cloudflare API response: ${JSON.stringify(result, null, 2)}`);

        // Check the structure of the response
        const summary = result?.result?.response?.trim() || "No summary generated";  // Check for 'result.result.response'

        // If the summary is missing or undefined, return a fallback message
        if (!summary || summary === "No summary generated") {
            consola.error("❌ No summary was generated by the Cloudflare API.");
            return "No summary generated";
        }

        // Clean the summary result to remove emojis or extra spaces
        const cleanedSummary = summary.replace(/[^\x00-\x7F]/g, "").trim(); // Remove non-ASCII characters (emojis, etc.)

        if (!cleanedSummary) {
            consola.error("❌ No valid summary generated.");
            return "No summary generated";
        }

        consola.info("✅ Summary generated successfully");
        return cleanedSummary;

    } catch (error) {
        consola.error(`❌ Error in summarizing text: ${error.message}`);
        throw error;
    }
};
