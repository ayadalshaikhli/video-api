import { imageGenerations } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from "../lib/auth/session.js";
import { db } from '../lib/db/drizzle.js';
import { generateImageFromPrompt } from '../actions/image-generation.js';
import axios from 'axios';
import { uploadImageFile } from '../actions/cloudflare.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Helper function to extract user from request (supports both cookie and token-based auth)
async function getUserFromRequest(req) {
  console.log("[getUserFromRequest] Starting user extraction...");
  
  // Try cookie-based auth first
  const sessionCookie = req.cookies?.session;
  
  // Try token-based auth if no cookie
  const authHeader = req.headers?.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;
    
  console.log("[getUserFromRequest] Session cookie:", sessionCookie);
  console.log("[getUserFromRequest] Auth token:", token ? "Present" : "Not present");
  
  if (!sessionCookie && !token) {
    console.error("[getUserFromRequest] No authentication provided.");
    throw new Error("Not authenticated (no session cookie or token)");
  }
  
  let payload;
  try {
    // Try to verify either the cookie or the token
    if (sessionCookie) {
      payload = await verifyToken(sessionCookie);
    } else if (token) {
      payload = await verifyToken(token);
    }
    
    console.log("[getUserFromRequest] Token verified. Payload:", payload);
  } catch (err) {
    console.error("[getUserFromRequest] Token verification failed:", err);
    throw new Error("Invalid session token");
  }
  
  const user = payload?.user;
  if (!user || !user.id) {
    console.error("[getUserFromRequest] Invalid session payload. User data:", user);
    throw new Error("Invalid session payload");
  }
  
  console.log("[getUserFromRequest] Extracted user:", user);
  return user;
}

// Available models for text-to-image generation
const AVAILABLE_MODELS = {
  "leonardo-lucid-origin": {
    name: "Leonardo Lucid Origin",
    description: "Most adaptable and prompt-responsive model with sharp graphic design and stunning full-HD renders",
    maxSteps: 40,
    defaultGuidance: 4.5,
    endpoint: "@cf/leonardo/lucid-origin",
    defaultWidth: 1120,
    defaultHeight: 1120
  },
  "leonardo-phoenix-1.0": {
    name: "Leonardo Phoenix 1.0",
    description: "Exceptional prompt adherence and coherent text generation with high-quality outputs",
    maxSteps: 50,
    defaultGuidance: 2,
    endpoint: "@cf/leonardo/phoenix-1.0",
    defaultWidth: 1024,
    defaultHeight: 1024,
    supportsNegativePrompt: true
  },
  "flux-1-schnell": {
    name: "Flux 1 Schnell",
    description: "Fast, high-quality image generation with 12B parameters",
    maxSteps: 8,
    defaultGuidance: 3.5,
    endpoint: "@cf/black-forest-labs/flux-1-schnell",
    defaultWidth: 512,
    defaultHeight: 512,
    responseType: "json" // Returns JSON with base64 image
  },
  "stable-diffusion-xl-base-1.0": {
    name: "Stable Diffusion XL",
    description: "Diffusion-based text-to-image generative model by Stability AI",
    maxSteps: 20,
    defaultGuidance: 7.5,
    endpoint: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    defaultWidth: 1024,
    defaultHeight: 1024,
    supportsNegativePrompt: true
  },
  "stable-diffusion-xl-lightning": {
    name: "Stable Diffusion XL Lightning",
    description: "Lightning-fast text-to-image generation with high-quality 1024px images",
    maxSteps: 20,
    defaultGuidance: 7.5,
    endpoint: "@cf/bytedance/stable-diffusion-xl-lightning",
    defaultWidth: 1024,
    defaultHeight: 1024,
    supportsNegativePrompt: true
  },
  "dreamshaper-8-lcm": {
    name: "DreamShaper 8 LCM",
    description: "Fine-tuned for photorealism without sacrificing creative range",
    maxSteps: 20,
    defaultGuidance: 7.5,
    endpoint: "@cf/lykon/dreamshaper-8-lcm",
    defaultWidth: 1024,
    defaultHeight: 1024,
    supportsNegativePrompt: true
  },
  "flux-dev": {
    name: "Flux Dev",
    description: "Development version with latest features",
    maxSteps: 8,
    defaultGuidance: 3.5,
    endpoint: "@cf/black-forest-labs/flux-dev",
    defaultWidth: 512,
    defaultHeight: 512,
    responseType: "json" // Returns JSON with base64 image
  }
};

// Helper function to generate image using Flux models
async function generateFluxImage(prompt, parameters) {
  const API_KEY = process.env.CLOUDFLARE_API_KEY;
  const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  
  if (!API_KEY || !ACCOUNT_ID) {
    throw new Error("Cloudflare API credentials not configured");
  }
  
  const modelInfo = AVAILABLE_MODELS[parameters.model] || AVAILABLE_MODELS["flux-1-schnell"];
  const API_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${modelInfo.endpoint}`;
  
  const payload = {
    prompt: prompt,
    steps: parameters.steps || 4,
    seed: parameters.seed || Math.floor(Math.random() * 1000000)
  };
  
  console.log("[generateFluxImage] API URL:", API_URL);
  console.log("[generateFluxImage] Payload:", JSON.stringify(payload));
  
  try {
    const response = await axios.post(API_URL, payload, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      }
      // No responseType - expect JSON response
    });
    
    console.log("[generateFluxImage] Response received, status:", response.status);
    console.log("[generateFluxImage] Response data type:", typeof response.data);
    console.log("[generateFluxImage] Response data keys:", Object.keys(response.data || {}));
    
    // Check if response has image data
    if (!response.data || !response.data.result || !response.data.result.image) {
      console.error("[generateFluxImage] No image data in response:", response.data);
      throw new Error("No image data received from Flux API");
    }
    
    // Flux API returns base64 image data in result.image field
    const base64Image = response.data.result.image;
    console.log("[generateFluxImage] Base64 image length:", base64Image.length);
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Image, 'base64');
    console.log("[generateFluxImage] Image buffer size:", imageBuffer.length, "bytes");
    
    // Create a temporary file
    const tempDir = path.join(process.cwd(), "temp_video", "generated_images");
    fs.mkdirSync(tempDir, { recursive: true });
    
    const randomFileName = crypto.randomBytes(15).toString("hex");
    const filePath = path.join(tempDir, `${randomFileName}.jpg`);
    
    // Write the image buffer to file
    fs.writeFileSync(filePath, imageBuffer);
    console.log("[generateFluxImage] Image saved to:", filePath);
    
    return {
      success: true,
      filePath: filePath,
      buffer: imageBuffer
    };
    
  } catch (error) {
    console.error("[generateFluxImage] Error:", error.message);
    if (error.response) {
      console.error("[generateFluxImage] Response status:", error.response.status);
      console.error("[generateFluxImage] Response data:", error.response.data);
    }
    throw error;
  }
}

// Helper function to clean prompt for Leonardo API
function cleanPromptForLeonardo(prompt) {
  // Remove LoRA references and other unsupported parameters
  let cleanedPrompt = prompt
    .replace(/<lora:[^>]+>/gi, '') // Remove LoRA references
    .replace(/<[^>]+>/g, '') // Remove any other angle bracket tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Remove NSFW content that Leonardo API filters
  const nsfwTerms = [
    'breasts', 'nude', 'naked', 'nsfw', 'explicit', 'sexual', 'porn', 'adult',
    'bikini', 'lingerie', 'underwear', 'intimate', 'sensual', 'erotic',
    'topless', 'bottomless', 'exposed', 'revealing', 'provocative'
  ];
  
  // Create regex pattern to match NSFW terms (case insensitive)
  const nsfwPattern = new RegExp(`\\b(${nsfwTerms.join('|')})\\b`, 'gi');
  cleanedPrompt = cleanedPrompt.replace(nsfwPattern, '');
  
  // Clean up any double spaces that might have been created
  cleanedPrompt = cleanedPrompt.replace(/\s+/g, ' ').trim();
  
  console.log("[cleanPromptForLeonardo] Original prompt length:", prompt.length);
  console.log("[cleanPromptForLeonardo] Cleaned prompt length:", cleanedPrompt.length);
  console.log("[cleanPromptForLeonardo] Cleaned prompt:", cleanedPrompt);
  
  return cleanedPrompt;
}

// Helper function to generate image using Leonardo model
async function generateLeonardoImage(prompt, parameters) {
  console.log("[generateLeonardoImage] Starting Leonardo image generation");
  console.log("[generateLeonardoImage] Original prompt:", prompt);
  console.log("[generateLeonardoImage] Parameters:", JSON.stringify(parameters));
  
  // Clean the prompt for Leonardo API
  const cleanedPrompt = cleanPromptForLeonardo(prompt);
  
  const API_KEY = process.env.CLOUDFLARE_API_KEY;
  const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  
  if (!API_KEY || !ACCOUNT_ID) {
    throw new Error("Cloudflare API credentials not configured");
  }
  
  const modelInfo = AVAILABLE_MODELS[parameters.model] || AVAILABLE_MODELS["leonardo-lucid-origin"];
  const API_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${modelInfo.endpoint}`;
  
  const payload = {
    prompt: cleanedPrompt,
    guidance: parameters.guidance || modelInfo.defaultGuidance,
    width: parameters.width || modelInfo.defaultWidth,
    height: parameters.height || modelInfo.defaultHeight,
    num_steps: parameters.num_steps || Math.min(modelInfo.maxSteps, 25),
    seed: parameters.seed || Math.floor(Math.random() * 1000000)
  };

  // Add negative prompt for Phoenix 1.0 if supported
  if (modelInfo.supportsNegativePrompt && parameters.negative_prompt) {
    payload.negative_prompt = parameters.negative_prompt;
  }
  
  console.log("[generateLeonardoImage] API URL:", API_URL);
  console.log("[generateLeonardoImage] Payload:", JSON.stringify(payload));
  
  try {
    // Try JSON response first to see the structure
    let response;
    try {
      response = await axios.post(API_URL, payload, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
        // No responseType - expect JSON
      });
      
      console.log("[generateLeonardoImage] JSON response received");
      console.log("[generateLeonardoImage] Response data:", response.data);
      
      // Check if it's a JSON response with base64 data
      if (response.data && response.data.result && response.data.result.image) {
        console.log("[generateLeonardoImage] Found base64 image in JSON response");
        const base64Image = response.data.result.image;
        const imageBuffer = Buffer.from(base64Image, 'base64');
        
        // Create a temporary file
        const tempDir = path.join(process.cwd(), "temp_video", "generated_images");
        fs.mkdirSync(tempDir, { recursive: true });
        
        const randomFileName = crypto.randomBytes(15).toString("hex");
        const filePath = path.join(tempDir, `${randomFileName}.jpg`);
        
        // Write the image buffer to file
        fs.writeFileSync(filePath, imageBuffer);
        
        console.log("[generateLeonardoImage] Image saved to:", filePath);
        
        return {
          success: true,
          filePath: filePath,
          buffer: imageBuffer
        };
      }
    } catch (jsonError) {
      console.log("[generateLeonardoImage] JSON response failed, trying binary response");
    }
    
    // If JSON failed, try binary response
    response = await axios.post(API_URL, payload, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      responseType: 'arraybuffer' // Expect binary image data
    });
    
    console.log("[generateLeonardoImage] Binary response received, status:", response.status);
    console.log("[generateLeonardoImage] Response data type:", typeof response.data);
    console.log("[generateLeonardoImage] Response data length:", response.data.length);
    console.log("[generateLeonardoImage] Model:", parameters.model);
    console.log("[generateLeonardoImage] First 100 bytes of response:", response.data.slice(0, 100));
    
    // Check if response has image data
    if (!response.data || response.data.length === 0) {
      console.error("[generateLeonardoImage] No image data in response");
      throw new Error("No image data received from Leonardo API");
    }
    
    // Leonardo API returns raw binary image data
    const imageBuffer = Buffer.from(response.data);
    console.log("[generateLeonardoImage] Image buffer size:", imageBuffer.length, "bytes");
    
    // Create a temporary file
    const tempDir = path.join(process.cwd(), "temp_video", "generated_images");
    fs.mkdirSync(tempDir, { recursive: true });
    
    const randomFileName = crypto.randomBytes(15).toString("hex");
    const filePath = path.join(tempDir, `${randomFileName}.jpg`);
    
    // Write the image buffer to file
    fs.writeFileSync(filePath, imageBuffer);
    
    console.log("[generateLeonardoImage] Image saved to:", filePath);
    
    return {
      success: true,
      filePath: filePath,
      buffer: imageBuffer
    };
    
  } catch (error) {
    console.error("[generateLeonardoImage] Error:", error.message);
    if (error.response) {
      console.error("[generateLeonardoImage] Response status:", error.response.status);
      console.error("[generateLeonardoImage] Response data:", error.response.data);
      
      // Try to decode the error message
      try {
        const errorData = JSON.parse(Buffer.from(error.response.data).toString());
        console.error("[generateLeonardoImage] Decoded error:", JSON.stringify(errorData, null, 2));
      } catch (parseError) {
        console.error("[generateLeonardoImage] Could not parse error response");
      }
    }
    throw error;
  }
}

// Generate image using specified model
export const generateTextToImage = async (req, res, next) => {
  console.log("\n=========== TEXT TO IMAGE GENERATION PROCESS STARTED ===========");
  console.log("[generateTextToImage] Request received:", req.method, req.originalUrl);
  console.log("[generateTextToImage] Request headers:", JSON.stringify(req.headers));
  console.log("[generateTextToImage] Request body:", JSON.stringify(req.body));
  
  try {
    // Extract user from request
    console.log("[generateTextToImage] Step 1: Authenticating user...");
    const user = await getUserFromRequest(req);
    console.log("[generateTextToImage] User extracted:", JSON.stringify(user));
    const userId = user.id;
    console.log("[generateTextToImage] User ID:", userId);

    const { prompt, style, aspectRatio, model } = req.body;
    console.log("[generateTextToImage] Input parameters:");
    console.log("  - Prompt:", prompt);
    console.log("  - Style:", style);
    console.log("  - Aspect Ratio:", aspectRatio);
    console.log("  - Model:", model);

    if (!prompt) {
      console.log("[generateTextToImage] Error: Prompt is required");
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Validate model
    const selectedModel = model || "leonardo-lucid-origin";
    if (!AVAILABLE_MODELS[selectedModel]) {
      console.log("[generateTextToImage] Error: Invalid model selected");
      return res.status(400).json({ 
        error: 'Invalid model selected',
        availableModels: Object.keys(AVAILABLE_MODELS)
      });
    }

    console.log("[generateTextToImage] Step 2: Preparing generation parameters...");
    // Prepare generation parameters based on model, style, and aspect ratio
    const generationParameters = prepareTextToImageParameters(selectedModel, style, aspectRatio);
    console.log("[generateTextToImage] Generation parameters:", JSON.stringify(generationParameters));
    
    console.log("[generateTextToImage] Step 3: Calling AI service for image generation...");
    console.log("[generateTextToImage] Selected model:", selectedModel);
    
    try {
      let result;
      
      if (selectedModel === "leonardo-lucid-origin" || selectedModel === "leonardo-phoenix-1.0") {
        // Use Leonardo-specific API call
        result = await generateLeonardoImage(prompt, generationParameters);
      } else if (selectedModel === "flux-1-schnell" || selectedModel === "flux-dev") {
        // Use Flux-specific API call
        result = await generateFluxImage(prompt, generationParameters);
      } else if (selectedModel === "stable-diffusion-xl-base-1.0" || selectedModel === "stable-diffusion-xl-lightning" || selectedModel === "dreamshaper-8-lcm") {
        // Use existing generateImageFromPrompt for SDXL models and DreamShaper (returns binary PNG)
        result = await generateImageFromPrompt(
          prompt, 
          null, 
          selectedModel, 
          generationParameters
        );
      } else {
        // Use existing generateImageFromPrompt for other models
        result = await generateImageFromPrompt(
          prompt, 
          null, 
          selectedModel, 
          generationParameters
        );
      }
      
      console.log("[generateTextToImage] Image generation result received");
      console.log("[generateTextToImage] Result object:", JSON.stringify(result));
      console.log("[generateTextToImage] Image path:", result?.image || result?.filePath);
      
      // Handle different result structures from different models
      const imagePath = result?.image || result?.filePath;
      if (!result || !imagePath) {
        console.log("[generateTextToImage] Error: Failed to generate image - No result or image path");
        return res.status(500).json({ error: 'Failed to generate image' });
      }
      
      console.log("[generateTextToImage] Step 4: Reading generated image file from disk...");
      // Read the generated image file
      try {
        const fileStats = fs.statSync(imagePath);
        console.log("[generateTextToImage] Image file exists. Size:", fileStats.size, "bytes");
      } catch (err) {
        console.error("[generateTextToImage] Error checking image file:", err);
        return res.status(500).json({ error: 'Generated image file does not exist or cannot be accessed' });
      }
      
      let fileBuffer;
      try {
        fileBuffer = fs.readFileSync(imagePath);
        console.log("[generateTextToImage] Successfully read image file. Buffer size:", fileBuffer.length);
      } catch (err) {
        console.error("[generateTextToImage] Error reading image file:", err);
        return res.status(500).json({ error: 'Failed to read generated image file' });
      }
      
      const imageFile = {
        buffer: fileBuffer,
        originalname: `${uuidv4()}.jpg`,
        mimetype: "image/jpeg"
      };
      console.log("[generateTextToImage] Image file object prepared with name:", imageFile.originalname);
      
      console.log("[generateTextToImage] Step 5: Uploading image to Cloudflare R2...");
      let uploadResult;
      try {
        uploadResult = await uploadImageFile(imageFile);
        console.log("[generateTextToImage] Upload result:", JSON.stringify(uploadResult));
      } catch (uploadErr) {
        console.error("[generateTextToImage] Error uploading to R2:", uploadErr);
        return res.status(500).json({ error: 'Failed to upload image to storage', details: uploadErr.message });
      }
      
      if (!uploadResult || !uploadResult.publicUrl) {
        console.log("[generateTextToImage] Error: Upload succeeded but no public URL returned");
        return res.status(500).json({ error: 'Failed to get public URL for uploaded image' });
      }
      
      console.log("[generateTextToImage] Step 6: Saving image record to database...");
      console.log("[generateTextToImage] Public URL:", uploadResult.publicUrl);
      
      // Save image record to database
      let newImage;
      try {
        newImage = await db.insert(imageGenerations).values({
          userId,
          prompt,
          model: selectedModel,
          imageUrl: uploadResult.publicUrl,
          generationDuration: 0, // We don't track this in the real implementation
          costCredits: 1, // Adjust based on your credit system
          status: 'completed',
          generationParameters: generationParameters,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        console.log("[generateTextToImage] Database insert successful. Image ID:", newImage[0]?.id);
      } catch (dbErr) {
        console.error("[generateTextToImage] Database error:", dbErr);
        return res.status(500).json({ error: 'Failed to save image record to database', details: dbErr.message });
      }
      
      console.log("[generateTextToImage] Step 7: Cleaning up temporary files...");
      // Clean up the temporary file
      try {
        fs.unlinkSync(imagePath);
        console.log("[generateTextToImage] Temporary file deleted successfully");
      } catch (error) {
        console.error('[generateTextToImage] Error deleting temporary image file:', error);
        // Continue despite cleanup error
      }
      
      console.log("[generateTextToImage] Text to image generation process completed successfully!");
      console.log("=========== TEXT TO IMAGE GENERATION PROCESS COMPLETED ===========\n");
      
      return res.status(201).json({
        success: true,
        message: 'Image generated successfully',
        image: newImage[0],
        model: selectedModel,
        modelInfo: AVAILABLE_MODELS[selectedModel]
      });
    } catch (genError) {
      console.error("[generateTextToImage] Error during image generation:", genError);
      return res.status(500).json({ 
        error: 'Failed to generate image with AI service',
        details: genError.message
      });
    }
  } catch (error) {
    console.error('[generateTextToImage] Unhandled error:', error);
    console.log("=========== TEXT TO IMAGE GENERATION PROCESS FAILED ===========\n");
    return res.status(500).json({ 
      error: 'Something went wrong while generating the image',
      details: error.message
    });
  }
};

// Get available models
export const getAvailableModels = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      models: AVAILABLE_MODELS
    });
  } catch (error) {
    console.error('Error fetching available models:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch available models',
      details: error.message
    });
  }
};

// Get all images for a user
export const getUserTextToImageHistory = async (req, res, next) => {
  try {
    // Extract user from request
    const user = await getUserFromRequest(req);
    console.log("[getUserTextToImageHistory] User extracted:", user);
    const userId = user.id;
    
    const images = await db.select()
      .from(imageGenerations)
      .where(eq(imageGenerations.userId, userId))
      .orderBy(imageGenerations.createdAt);
    
    return res.status(200).json({
      success: true,
      images
    });
    
  } catch (error) {
    console.error('Error fetching user text-to-image history:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch user image history',
      details: error.message
    });
  }
};

// Delete an image
export const deleteTextToImage = async (req, res, next) => {
  try {
    // Extract user from request
    const user = await getUserFromRequest(req);
    console.log("[deleteTextToImage] User extracted:", user);
    const userId = user.id;
    
    const imageId = req.params.id;
    
    const image = await db.select()
      .from(imageGenerations)
      .where(eq(imageGenerations.id, imageId))
      .limit(1);
      
    if (!image || !image[0]) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    if (image[0].userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this image' });
    }
    
    await db.delete(imageGenerations)
      .where(eq(imageGenerations.id, imageId));
    
    // Optional: Also delete from storage here
    
    return res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting text-to-image:', error);
    return res.status(500).json({ 
      error: 'Failed to delete image',
      details: error.message
    });
  }
};

// Helper functions
function prepareTextToImageParameters(model, style, aspectRatio) {
  const modelInfo = AVAILABLE_MODELS[model];
  
  // Define parameters based on the model, style and aspect ratio
  const params = {
    style: style || 'photorealistic',
    aspectRatio: aspectRatio || '1:1',
    model: model
  };
  
  // Set width and height based on aspect ratio and model defaults
  let width = modelInfo.defaultWidth;
  let height = modelInfo.defaultHeight;
  
  if (aspectRatio === "4:3") {
    if (model === "leonardo-lucid-origin") {
      width = 1120;
      height = 840;
    } else {
      width = 640;
      height = 480;
    }
  } else if (aspectRatio === "16:9") {
    if (model === "leonardo-lucid-origin") {
      width = 1120;
      height = 630;
    } else {
      width = 640;
      height = 360;
    }
  } else if (aspectRatio === "3:4") {
    if (model === "leonardo-lucid-origin") {
      width = 840;
      height = 1120;
    } else {
      width = 480;
      height = 640;
    }
  }
  
  // Add model-specific parameters
  const baseParams = {
    ...params,
    width,
    height,
    guidance: modelInfo.defaultGuidance
  };

  // Model-specific parameter handling
  if (model === "leonardo-lucid-origin") {
    return {
      ...baseParams,
      num_steps: Math.min(modelInfo.maxSteps, 20), // Cap at 20 for performance
      seed: Math.floor(Math.random() * 1000000) // Random seed for variety
    };
  } else if (model === "leonardo-phoenix-1.0") {
    return {
      ...baseParams,
      num_steps: Math.min(modelInfo.maxSteps, 25), // Cap at 25 for performance
      seed: Math.floor(Math.random() * 1000000), // Random seed for variety
      negative_prompt: "deformed, ugly, disfigured, low quality, blurry, watermark, text, writing"
    };
  } else if (model === "stable-diffusion-xl-base-1.0") {
    return {
      ...baseParams,
      num_steps: Math.min(modelInfo.maxSteps, 20), // Cap at 20 for performance
      seed: Math.floor(Math.random() * 1000000), // Random seed for variety
      negative_prompt: "deformed, ugly, disfigured, low quality, blurry, watermark, text, writing"
    };
  } else if (model === "stable-diffusion-xl-lightning") {
    return {
      ...baseParams,
      num_steps: Math.min(modelInfo.maxSteps, 20), // Cap at 20 for performance
      seed: Math.floor(Math.random() * 1000000), // Random seed for variety
      negative_prompt: "deformed, ugly, disfigured, low quality, blurry, watermark, text, writing"
    };
  } else if (model === "dreamshaper-8-lcm") {
    return {
      ...baseParams,
      num_steps: Math.min(modelInfo.maxSteps, 20), // Cap at 20 for performance
      seed: Math.floor(Math.random() * 1000000), // Random seed for variety
      negative_prompt: "deformed, ugly, disfigured, low quality, blurry, watermark, text, writing, cartoon, anime"
    };
  } else if (model === "flux-1-schnell" || model === "flux-dev") {
    // Flux models
    return {
      ...baseParams,
      steps: Math.min(modelInfo.maxSteps, 4), // Cap at 4 for performance
      seed: Math.floor(Math.random() * 1000000) // Random seed for variety
    };
  } else {
    // Other models
    return {
      ...baseParams,
      steps: modelInfo.maxSteps
    };
  }
}
