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
  if (model === "stable-diffusion-xl-lightning") {
    return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/bytedance/stable-diffusion-xl-lightning`;
  }
  if (model === "dreamshaper-8-lcm") {
    return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/lykon/dreamshaper-8-lcm`;
  }
  if (model === "leonardo-lucid-origin") {
    return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/leonardo/lucid-origin`;
  }
  if (model === "leonardo-phoenix-1.0") {
    return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/leonardo/phoenix-1.0`;
  }
  if (model === "flux-dev") {
    return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-dev`;
  }
  return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
}

async function fetchImageWithRetry(payload, model = "flux-1-schnell", maxRetries = 3, delayMs = 1000, axiosConfig = {}, options = {}) {
  const quiet = !!options.quiet;
  const log = (...args) => { if (!quiet) console.log(...args); };
  
  log("[fetchImageWithRetry] Starting fetch with model:", model);
  log("[fetchImageWithRetry] Max retries:", maxRetries);

  const API_KEY = process.env.CLOUDFLARE_API_KEY;
  if (!API_KEY) {
    console.error("[fetchImageWithRetry] ERROR: API_KEY is missing!");
    throw new Error("Cloudflare API key is not configured");
  }

  const API_URL = getEndpoint(model);
  log("[fetchImageWithRetry] Endpoint URL:", API_URL);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(`[fetchImageWithRetry] Attempt ${attempt}/${maxRetries} for model ${model}`);
    try {
      log("[fetchImageWithRetry] Making API request");
      const requestStartTime = Date.now();
      
      const response = await axios.post(API_URL, payload, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        ...axiosConfig,
      });
      
      const requestDuration = Date.now() - requestStartTime;
      log(`[fetchImageWithRetry] Request successful. Duration: ${requestDuration}ms`);
      log("[fetchImageWithRetry] Response status:", response.status);
      log("[fetchImageWithRetry] Response headers:", JSON.stringify(response.headers));
      
      // Log only a summary of the response data to avoid huge logs
      if (response.data && response.data.result && response.data.result.image) {
        log("[fetchImageWithRetry] Response includes image data. Base64 length:", 
          response.data.result.image.length);
      } else if (model === "stable-diffusion-xl-base-1.0" && response.data) {
        log("[fetchImageWithRetry] SDXL response received. Data size:", 
          response.data.length || "unknown");
      } else {
        log("[fetchImageWithRetry] Response structure:", 
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
      if (!quiet) console.error(`[fetchImageWithRetry] Attempt ${attempt} failed:`, error.message);
      
      // Log detailed error information
      if (error.response) {
        if (!quiet) {
          console.error("[fetchImageWithRetry] Error response status:", error.response.status);
          console.error("[fetchImageWithRetry] Error response headers:", JSON.stringify(error.response.headers));
          console.error("[fetchImageWithRetry] Error response data:", JSON.stringify(error.response.data));
        }
      } else if (error.request) {
        if (!quiet) console.error("[fetchImageWithRetry] No response received. Request:", error.request);
      } else {
        if (!quiet) console.error("[fetchImageWithRetry] Error setting up request:", error.message);
      }
      
      if (error.config && !quiet) {
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
      
      log(`[fetchImageWithRetry] Waiting ${delayMs}ms before retry...`);
      await delay(delayMs);
    }
  }
}

export async function generateImageFromPrompt(prompt, videoStylePrompt = null, model = "flux-1-schnell", sdxlParams = {}) {
  const quiet = !!sdxlParams.quiet;
  const log = (...args) => { if (!quiet) console.log(...args); };
  const logError = (...args) => { if (!quiet) console.error(...args); else console.error(...args); };
  log("\n[generateImageFromPrompt] Starting image generation");
  log("[generateImageFromPrompt] Prompt:", prompt);
  log("[generateImageFromPrompt] Model:", model);
  log("[generateImageFromPrompt] Style prompt:", videoStylePrompt);
  log("[generateImageFromPrompt] Parameters:", JSON.stringify(sdxlParams));
  
  try {
    let mainPrompt;
    if (typeof prompt === "string") {
      mainPrompt = prompt;
      log("[generateImageFromPrompt] Using string prompt");
    } else if (typeof prompt === "object") {
      mainPrompt = prompt.description ? prompt.description : Object.values(prompt).join(" ");
      log("[generateImageFromPrompt] Using object prompt, converted to:", mainPrompt);
    } else {
      logError("[generateImageFromPrompt] Invalid prompt type:", typeof prompt);
      throw new Error("Main prompt is not a valid string or object.");
    }

    let finalPrompt = combinePrompts(mainPrompt, videoStylePrompt);
    if (model === "stable-diffusion-xl-base-1.0") {
      finalPrompt = finalPrompt.replace(/AI_PROMPT_\d+/gi, "").trim();
    }
    log("[generateImageFromPrompt] Final prompt:", finalPrompt);

    let payload = { 
      prompt: finalPrompt,
      negative_prompt: sdxlParams.negative_prompt || ""
    };
    if (model === "stable-diffusion-xl-base-1.0") {
      payload.height = sdxlParams.height || 1024;
      payload.width = sdxlParams.width || 1024;
      payload.num_steps = sdxlParams.num_steps || 20;
      payload.guidance = sdxlParams.guidance || 7.5;
      payload.seed = sdxlParams.seed || Math.floor(Math.random() * 1000000);
      payload.negative_prompt = sdxlParams.negative_prompt || "deformed, ugly, disfigured, low quality, blurry, watermark, text, writing";
    } else if (model === "stable-diffusion-xl-lightning") {
      payload.height = sdxlParams.height || 1024;
      payload.width = sdxlParams.width || 1024;
      payload.num_steps = sdxlParams.num_steps || 20;
      payload.guidance = sdxlParams.guidance || 7.5;
      payload.seed = sdxlParams.seed || Math.floor(Math.random() * 1000000);
      payload.negative_prompt = sdxlParams.negative_prompt || "deformed, ugly, disfigured, low quality, blurry, watermark, text, writing";
    } else if (model === "dreamshaper-8-lcm") {
      payload.height = sdxlParams.height || 1024;
      payload.width = sdxlParams.width || 1024;
      payload.num_steps = sdxlParams.num_steps || 20;
      payload.guidance = sdxlParams.guidance || 7.5;
      payload.seed = sdxlParams.seed || Math.floor(Math.random() * 1000000);
      payload.negative_prompt = sdxlParams.negative_prompt || "deformed, ugly, disfigured, low quality, blurry, watermark, text, writing, cartoon, anime";
    } else if (model === "leonardo-lucid-origin") {
      payload.width = sdxlParams.width || 1120;
      payload.height = sdxlParams.height || 1120;
      payload.num_steps = sdxlParams.num_steps || 40;
      payload.guidance = sdxlParams.guidance || 4.5;
      payload.seed = sdxlParams.seed || Math.floor(Math.random() * 1000000);
      payload.negative_prompt = sdxlParams.negative_prompt || "deformed, ugly, disfigured, low quality, blurry, watermark, text, writing";
    } else if (model === "leonardo-phoenix-1.0") {
      payload.width = sdxlParams.width || 1024;
      payload.height = sdxlParams.height || 1024;
      payload.num_steps = sdxlParams.num_steps || 50;
      payload.guidance = sdxlParams.guidance || 2;
      payload.seed = sdxlParams.seed || Math.floor(Math.random() * 1000000);
      payload.negative_prompt = sdxlParams.negative_prompt || "deformed, ugly, disfigured, low quality, blurry, watermark, text, writing";
    } else if (model === "flux-dev") {
      payload.width = sdxlParams.width || 512;
      payload.height = sdxlParams.height || 512;
      payload.num_steps = sdxlParams.num_steps || 8;
      payload.guidance = sdxlParams.guidance || 3.5;
      payload.seed = sdxlParams.seed || Math.floor(Math.random() * 1000000);
    }
    // Log the payload sent to the API
    log("[generateImageFromPrompt] Payload for API:", JSON.stringify(payload));
    log("[generateImageFromPrompt] Calling Cloudflare API endpoint:", getEndpoint(model));

    // Log API key (first few characters only for security)
    const apiKey = process.env.CLOUDFLARE_API_KEY;
    log("[generateImageFromPrompt] API Key available:", apiKey ? `Yes (starts with ${apiKey.substring(0, 3)}...)` : "No");
    log("[generateImageFromPrompt] Account ID available:", process.env.CLOUDFLARE_ACCOUNT_ID ? "Yes" : "No");

      try {
        // SDXL models and DreamShaper 8 LCM need arraybuffer response type for binary PNG data
        // Leonardo models and Flux models return JSON with base64 data
        const binaryModels = ["stable-diffusion-xl-base-1.0", "stable-diffusion-xl-lightning", "dreamshaper-8-lcm"];
        const leonardoModels = ["leonardo-lucid-origin", "leonardo-phoenix-1.0"];
        const axiosConfig = binaryModels.includes(model) ? { responseType: 'arraybuffer' } : {};
        const response = await fetchImageWithRetry(payload, model, 3, 1000, axiosConfig, {quiet});
        log("[generateImageFromPrompt] API response received");
        
        let imageBuffer;
        if (binaryModels.includes(model)) {
          log("[generateImageFromPrompt] Processing binary response (SDXL/DreamShaper)");
          imageBuffer = Buffer.from(response.data);
        } else if (leonardoModels.includes(model)) {
          log("[generateImageFromPrompt] Processing Leonardo JSON response");
          if (!(response.data && response.data.result && response.data.result.image)) {
            logError("[generateImageFromPrompt] Invalid Leonardo response structure:", JSON.stringify(response.data));
            throw new Error("No image data received from Leonardo API.");
          }
          imageBuffer = Buffer.from(response.data.result.image, "base64");
        } else {
          log("[generateImageFromPrompt] Processing Flux response");
          if (!(response.data && response.data.result && response.data.result.image)) {
            logError("[generateImageFromPrompt] Invalid response structure:", JSON.stringify(response.data));
            throw new Error("No image data received.");
          }
          imageBuffer = Buffer.from(response.data.result.image, "base64");
        }
      log("[generateImageFromPrompt] Image buffer created. Size:", imageBuffer.length);

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const tempDir = path.join(__dirname, "../temp_video");
      const folderPath = path.join(tempDir, "generated_images");

      log("[generateImageFromPrompt] Creating directory (if needed):", folderPath);
        mkdirSync(folderPath, { recursive: true });
        const randomFileName = crypto.randomBytes(15).toString("hex");
        // SDXL models and DreamShaper 8 LCM return PNG format, Leonardo and Flux models return JPG
        const pngModels = ["stable-diffusion-xl-base-1.0", "stable-diffusion-xl-lightning", "dreamshaper-8-lcm"];
        const extension = pngModels.includes(model) ? ".png" : ".jpg";
        const filePath = path.join(folderPath, `${randomFileName}${extension}`);
        log("[generateImageFromPrompt] Will save image to:", filePath);

      writeFileSync(filePath, imageBuffer);
      log("[generateImageFromPrompt] Image saved successfully");

      return {
        success: true,
        filePath: filePath,
        buffer: imageBuffer
      };
    } catch (apiError) {
      if (!quiet) console.error("[generateImageFromPrompt] API call error:", apiError);
      throw new Error("API call failed: " + apiError.message);
    }
  } catch (error) {
    if (!quiet) console.error("[generateImageFromPrompt] Error generating image:", error.message);
    if (error.response) {
      if (!quiet) {
        console.error("[generateImageFromPrompt] Response error data:", JSON.stringify(error.response.data));
        console.error("[generateImageFromPrompt] Response status:", error.response.status);
      }
    }
    throw error;
  }
}
