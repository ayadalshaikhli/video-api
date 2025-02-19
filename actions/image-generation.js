import { writeFileSync, mkdirSync } from "fs";
import axios from "axios";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

// Utility: Delay execution
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry helper for the image-generation request
async function fetchImageWithRetry(payload, maxRetries = 3, delayMs = 1000, axiosConfig = {}) {
  const API_KEY = process.env.CLOUDFLARE_API_KEY;
  const API_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} to fetch image...`);
      const response = await axios.post(API_URL, payload, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        ...axiosConfig,
      });
      return response;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (error.response) {
        console.error("Full error response:", error.response.data);
        console.error("Error status:", error.response.status);
        console.error("Error headers:", error.response.headers);
      }
      if (attempt === maxRetries) {
        throw error;
      }
      await delay(delayMs);
    }
  }
}

// Generate image based on summarized chunks
export async function generateImageFromPrompt(prompt) {
  try {
    // Ensure we have a valid prompt string.
    if (typeof prompt !== "string") {
      if (prompt && prompt.text) {
        prompt = prompt.text; // If it's an object with 'text' property, use it
      } else {
        throw new Error("Prompt is not a valid string or an object with a 'text' property.");
      }
    }

    if (!prompt || prompt === "No valid prompt available") {
      throw new Error("Failed to provide a valid prompt.");
    }

    console.log("Prompt received: Proceeding with image generation.");

    // Construct the payload with the prompt as a plain string
    const payload = {
      prompt: prompt // Use the chunk directly as prompt
    };

    // Retry the API call for image generation
    const response = await fetchImageWithRetry(payload, 3, 1000);

    let base64Image, contentType;
    if (response.data && response.data.result && response.data.result.image) {
      base64Image = response.data.result.image;
      contentType = "image/jpeg";
    } else {
      console.error("No image data received:", response.data);
      throw new Error("No image data received: " + JSON.stringify(response.data));
    }

    console.log("Base64 image generated successfully.");
    const imageBuffer = Buffer.from(base64Image, "base64");

    // Get the current directory of this module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Set the temp_video folder as the base directory for generated images.
    // Adjust the path as needed (here we assume temp_video is one level up)
    const tempDir = path.join(__dirname, "../temp_video");
    const folderPath = path.join(tempDir, "generated_images");

    // Ensure the folder exists
    try {
      mkdirSync(folderPath, { recursive: true });
      console.log("Folder exists or created successfully:", folderPath);
    } catch (err) {
      console.error("Error creating directory:", err.message);
      throw new Error("Error creating directory: " + err.message);
    }

    // Create a random file name
    const randomFileName = crypto.randomBytes(15).toString("hex");
    console.log("Generated random file name:", randomFileName);

    // File path with extension
    const filePath = path.join(folderPath, `${randomFileName}.jpg`);

    // Save the image file locally
    writeFileSync(filePath, imageBuffer);
    console.log("Image saved successfully to:", filePath);

    // Return the file path
    return { image: filePath };
  } catch (error) {
    console.error("Error during image generation:", error.message);
    throw new Error("Error generating image: " + error.message);
  }
}
