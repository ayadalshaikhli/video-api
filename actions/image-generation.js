import { writeFileSync, mkdirSync } from "fs";
import axios from "axios";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

// Utility: Delay execution
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Combine the main prompt and video style prompt.
// If videoStylePrompt is an array, join its elements.
// If it's a string, concatenate it.
// If it's an object, join its values.
function combinePrompts(mainPrompt, videoStylePrompt) {
  if (!videoStylePrompt) return mainPrompt;
  if (Array.isArray(videoStylePrompt)) {
    return videoStylePrompt.join(" ") + " " + mainPrompt;
  } else if (typeof videoStylePrompt === "string") {
    return mainPrompt + " " + videoStylePrompt;
  } else if (typeof videoStylePrompt === "object") {
    return Object.values(videoStylePrompt).join(" ") + " " + mainPrompt;
  }
  return mainPrompt;
}

// Select the API endpoint based on the selected model.
function getEndpoint(model) {
  if (model === "stable-diffusion-xl-base-1.0") {
    return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`;
  }
  return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
}

// Retry helper WITHOUT NSFW handling.
async function fetchImageWithRetry(payload, model = "flux-1-schnell", maxRetries = 3, delayMs = 1000, axiosConfig = {}) {
  const API_KEY = process.env.CLOUDFLARE_API_KEY;
  const API_URL = getEndpoint(model);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.info(`Attempt ${attempt} using ${model}.`);
      const response = await axios.post(API_URL, payload, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        ...axiosConfig,
      });
      return response;
    } catch (error) {
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        throw error;
      }
      await delay(delayMs);
    }
  }
}

// Main function: generateImageFromPrompt.
// Accepts a prompt (string or object), an optional videoStylePrompt,
// an optional model (default "flux-1-schnell"), and optional sdxlParams.
export async function generateImageFromPrompt(prompt, videoStylePrompt = null, model = "flux-1-schnell", sdxlParams = {}) {
  try {
    let mainPrompt;
    if (typeof prompt === "string") {
      mainPrompt = prompt;
    } else if (typeof prompt === "object") {
      mainPrompt = prompt.description ? prompt.description : Object.values(prompt).join(" ");
    } else {
      throw new Error("Main prompt is not a valid string or object.");
    }

    let finalPrompt = combinePrompts(mainPrompt, videoStylePrompt);
    if (model === "stable-diffusion-xl-base-1.0") {
      finalPrompt = finalPrompt.replace(/AI_PROMPT_\d+/gi, "").trim();
    }
    console.info("Final prompt set.");

    // Build payload with a default negative prompt.
    let payload = { 
      prompt: finalPrompt,
      negative_prompt: sdxlParams.negative_prompt || ""
    };
    if (model === "stable-diffusion-xl-base-1.0") {
      payload.height = sdxlParams.height || 512;
      payload.width = sdxlParams.width || 512;
      payload.num_steps = sdxlParams.num_steps || 20;
      payload.guidance = sdxlParams.guidance || 7.5;
      payload.seed = sdxlParams.seed || 12345;
    }

    const response = await fetchImageWithRetry(payload, model, 3, 1000);
    
    let imageBuffer;
    if (model === "stable-diffusion-xl-base-1.0") {
      imageBuffer = Buffer.from(response.data);
    } else {
      if (!(response.data && response.data.result && response.data.result.image)) {
        throw new Error("No image data received.");
      }
      imageBuffer = Buffer.from(response.data.result.image, "base64");
    }
    console.info("Image data received.");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const tempDir = path.join(__dirname, "../temp_video");
    const folderPath = path.join(tempDir, "generated_images");

    mkdirSync(folderPath, { recursive: true });
    const randomFileName = crypto.randomBytes(15).toString("hex");
    const filePath = path.join(folderPath, `${randomFileName}.jpg`);

    writeFileSync(filePath, imageBuffer);
    console.info("Image saved.");

    return { image: filePath };
  } catch (error) {
    console.error("Error generating image:", error.message);
    throw new Error("Error generating image: " + error.message);
  }
}
