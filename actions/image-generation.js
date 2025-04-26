import { writeFileSync, mkdirSync } from "fs";
import axios from "axios";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Only combine if videoStylePrompt is a string or an array.
function combinePrompts(mainPrompt, videoStylePrompt) {
  if (!videoStylePrompt) return mainPrompt;
  if (typeof videoStylePrompt === "string") {
    return mainPrompt + " " + videoStylePrompt;
  }
  if (Array.isArray(videoStylePrompt)) {
    return mainPrompt + " " + videoStylePrompt.join(" ");
  }
  // If videoStylePrompt is an object, ignore it (or customize as needed)
  return mainPrompt;
}

function getEndpoint(model) {
  if (model === "stable-diffusion-xl-base-1.0") {
    return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`;
  }
  return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
}

async function fetchImageWithRetry(payload, model = "flux-1-schnell", maxRetries = 3, delayMs = 1000, axiosConfig = {}) {
  console.log("[fetchImageWithRetry] Starting fetch with model:", model);
  console.log("[fetchImageWithRetry] Max retries:", maxRetries);

  const API_KEY = process.env.CLOUDFLARE_API_KEY;
  if (!API_KEY) {
    console.error("[fetchImageWithRetry] ERROR: API_KEY is missing!");
    throw new Error("Cloudflare API key is not configured");
  }

  const API_URL = getEndpoint(model);
  console.log("[fetchImageWithRetry] Endpoint URL:", API_URL);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[fetchImageWithRetry] Attempt ${attempt}/${maxRetries} for model ${model}`);
    try {
      console.log("[fetchImageWithRetry] Making API request");
      const requestStartTime = Date.now();
      
      const response = await axios.post(API_URL, payload, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        ...axiosConfig,
      });
      
      const requestDuration = Date.now() - requestStartTime;
      console.log(`[fetchImageWithRetry] Request successful. Duration: ${requestDuration}ms`);
      console.log("[fetchImageWithRetry] Response status:", response.status);
      console.log("[fetchImageWithRetry] Response headers:", JSON.stringify(response.headers));
      
      // Log only a summary of the response data to avoid huge logs
      if (response.data && response.data.result && response.data.result.image) {
        console.log("[fetchImageWithRetry] Response includes image data. Base64 length:", 
          response.data.result.image.length);
      } else if (model === "stable-diffusion-xl-base-1.0" && response.data) {
        console.log("[fetchImageWithRetry] SDXL response received. Data size:", 
          response.data.length || "unknown");
      } else {
        console.log("[fetchImageWithRetry] Response structure:", 
          JSON.stringify(response.data, (key, value) => {
            // Truncate long values like base64 images
            if (typeof value === 'string' && value.length > 100) {
              return value.substring(0, 100) + '... [truncated]';
            }
            return value;
          }, 2));
      }
      
      return response;
    } catch (error) {
      console.error(`[fetchImageWithRetry] Attempt ${attempt} failed:`, error.message);
      
      // Log detailed error information
      if (error.response) {
        console.error("[fetchImageWithRetry] Error response status:", error.response.status);
        console.error("[fetchImageWithRetry] Error response headers:", JSON.stringify(error.response.headers));
        console.error("[fetchImageWithRetry] Error response data:", JSON.stringify(error.response.data));
      } else if (error.request) {
        console.error("[fetchImageWithRetry] No response received. Request:", error.request);
      } else {
        console.error("[fetchImageWithRetry] Error setting up request:", error.message);
      }
      
      if (error.config) {
        console.log("[fetchImageWithRetry] Request config:", JSON.stringify({
          url: error.config.url,
          method: error.config.method,
          headers: error.config.headers,
          // Don't log auth headers in full
          hasAuth: !!error.config.headers?.Authorization
        }));
      }
      
      if (attempt === maxRetries) {
        console.error("[fetchImageWithRetry] All retry attempts failed. Giving up.");
        throw error;
      }
      
      console.log(`[fetchImageWithRetry] Waiting ${delayMs}ms before retry...`);
      await delay(delayMs);
    }
  }
}

export async function generateImageFromPrompt(prompt, videoStylePrompt = null, model = "flux-1-schnell", sdxlParams = {}) {
  console.log("\n[generateImageFromPrompt] Starting image generation");
  console.log("[generateImageFromPrompt] Prompt:", prompt);
  console.log("[generateImageFromPrompt] Model:", model);
  console.log("[generateImageFromPrompt] Style prompt:", videoStylePrompt);
  console.log("[generateImageFromPrompt] Parameters:", JSON.stringify(sdxlParams));
  
  try {
    let mainPrompt;
    if (typeof prompt === "string") {
      mainPrompt = prompt;
      console.log("[generateImageFromPrompt] Using string prompt");
    } else if (typeof prompt === "object") {
      mainPrompt = prompt.description ? prompt.description : Object.values(prompt).join(" ");
      console.log("[generateImageFromPrompt] Using object prompt, converted to:", mainPrompt);
    } else {
      console.error("[generateImageFromPrompt] Invalid prompt type:", typeof prompt);
      throw new Error("Main prompt is not a valid string or object.");
    }

    let finalPrompt = combinePrompts(mainPrompt, videoStylePrompt);
    if (model === "stable-diffusion-xl-base-1.0") {
      finalPrompt = finalPrompt.replace(/AI_PROMPT_\d+/gi, "").trim();
    }
    console.log("[generateImageFromPrompt] Final prompt:", finalPrompt);

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
    // Log the payload sent to the API
    console.log("[generateImageFromPrompt] Payload for API:", JSON.stringify(payload));
    console.log("[generateImageFromPrompt] Calling Cloudflare API endpoint:", getEndpoint(model));

    // Log API key (first few characters only for security)
    const apiKey = process.env.CLOUDFLARE_API_KEY;
    console.log("[generateImageFromPrompt] API Key available:", apiKey ? `Yes (starts with ${apiKey.substring(0, 3)}...)` : "No");
    console.log("[generateImageFromPrompt] Account ID available:", process.env.CLOUDFLARE_ACCOUNT_ID ? "Yes" : "No");

    try {
      const response = await fetchImageWithRetry(payload, model, 3, 1000);
      console.log("[generateImageFromPrompt] API response received");
      
      let imageBuffer;
      if (model === "stable-diffusion-xl-base-1.0") {
        console.log("[generateImageFromPrompt] Processing SDXL response");
        imageBuffer = Buffer.from(response.data);
      } else {
        console.log("[generateImageFromPrompt] Processing Flux response");
        if (!(response.data && response.data.result && response.data.result.image)) {
          console.error("[generateImageFromPrompt] Invalid response structure:", JSON.stringify(response.data));
          throw new Error("No image data received.");
        }
        imageBuffer = Buffer.from(response.data.result.image, "base64");
      }
      console.log("[generateImageFromPrompt] Image buffer created. Size:", imageBuffer.length);

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const tempDir = path.join(__dirname, "../temp_video");
      const folderPath = path.join(tempDir, "generated_images");

      console.log("[generateImageFromPrompt] Creating directory (if needed):", folderPath);
      mkdirSync(folderPath, { recursive: true });
      const randomFileName = crypto.randomBytes(15).toString("hex");
      const filePath = path.join(folderPath, `${randomFileName}.jpg`);
      console.log("[generateImageFromPrompt] Will save image to:", filePath);

      writeFileSync(filePath, imageBuffer);
      console.log("[generateImageFromPrompt] Image saved successfully");

      return { image: filePath };
    } catch (apiError) {
      console.error("[generateImageFromPrompt] API call error:", apiError);
      throw new Error("API call failed: " + apiError.message);
    }
  } catch (error) {
    console.error("[generateImageFromPrompt] Error generating image:", error.message);
    if (error.response) {
      console.error("[generateImageFromPrompt] Response error data:", JSON.stringify(error.response.data));
      console.error("[generateImageFromPrompt] Response status:", error.response.status);
    }
    throw error;
  }
}
