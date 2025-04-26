import { imageGenerations } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from "../lib/auth/session.js";
import { db } from '../lib/db/drizzle.js';
import { generateImageFromPrompt } from '../actions/image-generation.js';
import { uploadImageFile } from '../actions/cloudflare.js';
import fs from 'fs';

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

// Generate image using Cloudflare API
export const generateImage = async (req, res, next) => {
  console.log("\n=========== IMAGE GENERATION PROCESS STARTED ===========");
  console.log("[generateImage] Request received:", req.method, req.originalUrl);
  console.log("[generateImage] Request headers:", JSON.stringify(req.headers));
  console.log("[generateImage] Request body:", JSON.stringify(req.body));
  
  try {
    // Extract user from request similar to other controllers
    console.log("[generateImage] Step 1: Authenticating user...");
    const user = await getUserFromRequest(req);
    console.log("[generateImage] User extracted:", JSON.stringify(user));
    const userId = user.id;
    console.log("[generateImage] User ID:", userId);

    const { prompt, style, aspectRatio } = req.body;
    console.log("[generateImage] Input parameters:");
    console.log("  - Prompt:", prompt);
    console.log("  - Style:", style);
    console.log("  - Aspect Ratio:", aspectRatio);

    if (!prompt) {
      console.log("[generateImage] Error: Prompt is required");
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log("[generateImage] Step 2: Preparing generation parameters...");
    // Step 1: Prepare generation parameters based on style
    const generationParameters = prepareGenerationParameters(style, aspectRatio);
    console.log("[generateImage] Generation parameters:", JSON.stringify(generationParameters));
    
    console.log("[generateImage] Step 3: Calling Cloudflare AI for image generation...");
    // Step 2: Call Cloudflare API to generate image using the real implementation
    console.log("[generateImage] Selected model:", style === "realistic" ? "stable-diffusion-xl-base-1.0" : "flux-1-schnell");
    
    try {
      const result = await generateImageFromPrompt(
        prompt, 
        null, 
        style === "realistic" ? "stable-diffusion-xl-base-1.0" : "flux-1-schnell", 
        generationParameters
      );
      
      console.log("[generateImage] Image generation result received");
      console.log("[generateImage] Result object:", JSON.stringify(result));
      console.log("[generateImage] Image path:", result?.image);
      
      if (!result || !result.image) {
        console.log("[generateImage] Error: Failed to generate image - No result or image path");
        return res.status(500).json({ error: 'Failed to generate image' });
      }
      
      console.log("[generateImage] Step 4: Reading generated image file from disk...");
      // Step 3: Upload the generated image file to Cloudflare R2
      try {
        const fileStats = fs.statSync(result.image);
        console.log("[generateImage] Image file exists. Size:", fileStats.size, "bytes");
      } catch (err) {
        console.error("[generateImage] Error checking image file:", err);
        return res.status(500).json({ error: 'Generated image file does not exist or cannot be accessed' });
      }
      
      let fileBuffer;
      try {
        fileBuffer = fs.readFileSync(result.image);
        console.log("[generateImage] Successfully read image file. Buffer size:", fileBuffer.length);
      } catch (err) {
        console.error("[generateImage] Error reading image file:", err);
        return res.status(500).json({ error: 'Failed to read generated image file' });
      }
      
      const imageFile = {
        buffer: fileBuffer,
        originalname: `${uuidv4()}.jpg`,
        mimetype: "image/jpeg"
      };
      console.log("[generateImage] Image file object prepared with name:", imageFile.originalname);
      
      console.log("[generateImage] Step 5: Uploading image to Cloudflare R2...");
      let uploadResult;
      try {
        uploadResult = await uploadImageFile(imageFile);
        console.log("[generateImage] Upload result:", JSON.stringify(uploadResult));
      } catch (uploadErr) {
        console.error("[generateImage] Error uploading to R2:", uploadErr);
        return res.status(500).json({ error: 'Failed to upload image to storage', details: uploadErr.message });
      }
      
      if (!uploadResult || !uploadResult.publicUrl) {
        console.log("[generateImage] Error: Upload succeeded but no public URL returned");
        return res.status(500).json({ error: 'Failed to get public URL for uploaded image' });
      }
      
      console.log("[generateImage] Step 6: Saving image record to database...");
      console.log("[generateImage] Public URL:", uploadResult.publicUrl);
      
      // Step 4: Save image record to database
      let newImage;
      try {
        newImage = await db.insert(imageGenerations).values({
          userId,
          prompt,
          model: style || 'default',
          imageUrl: uploadResult.publicUrl,
          generationDuration: 0, // We don't track this in the real implementation
          costCredits: 1, // Adjust based on your credit system
          status: 'completed',
          generationParameters: generationParameters,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        console.log("[generateImage] Database insert successful. Image ID:", newImage[0]?.id);
      } catch (dbErr) {
        console.error("[generateImage] Database error:", dbErr);
        return res.status(500).json({ error: 'Failed to save image record to database', details: dbErr.message });
      }
      
      console.log("[generateImage] Step 7: Cleaning up temporary files...");
      // Clean up the temporary file
      try {
        fs.unlinkSync(result.image);
        console.log("[generateImage] Temporary file deleted successfully");
      } catch (error) {
        console.error('[generateImage] Error deleting temporary image file:', error);
        // Continue despite cleanup error
      }
      
      console.log("[generateImage] Image generation process completed successfully!");
      console.log("=========== IMAGE GENERATION PROCESS COMPLETED ===========\n");
      
      return res.status(201).json({
        success: true,
        message: 'Image generated successfully',
        image: newImage[0]
      });
    } catch (genError) {
      console.error("[generateImage] Error during image generation:", genError);
      return res.status(500).json({ 
        error: 'Failed to generate image with Cloudflare AI',
        details: genError.message
      });
    }
  } catch (error) {
    console.error('[generateImage] Unhandled error:', error);
    console.log("=========== IMAGE GENERATION PROCESS FAILED ===========\n");
    return res.status(500).json({ 
      error: 'Something went wrong while generating the image',
      details: error.message
    });
  }
};

// Get all images for a user
export const getUserImages = async (req, res, next) => {
  try {
    // Extract user from request similar to other controllers
    const user = await getUserFromRequest(req);
    console.log("[getUserImages] User extracted:", user);
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
    console.error('Error fetching user images:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch user images',
      details: error.message
    });
  }
};

// Delete an image
export const deleteImage = async (req, res, next) => {
  try {
    // Extract user from request similar to other controllers
    const user = await getUserFromRequest(req);
    console.log("[deleteImage] User extracted:", user);
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
    console.error('Error deleting image:', error);
    return res.status(500).json({ 
      error: 'Failed to delete image',
      details: error.message
    });
  }
};

// Helper functions
function prepareGenerationParameters(style, aspectRatio) {
  // Define parameters based on the style and aspect ratio
  const params = {
    style: style || 'photorealistic',
    aspectRatio: aspectRatio || '1:1'
  };
  
  // Set width and height based on aspect ratio
  let width = 512;
  let height = 512;
  
  if (aspectRatio === "4:3") {
    width = 640;
    height = 480;
  } else if (aspectRatio === "16:9") {
    width = 640;
    height = 360;
  }
  
  // Add SDXL specific parameters
  return {
    ...params,
    width,
    height,
    num_steps: 20,
    guidance: 7.5,
    negative_prompt: "deformed, ugly, disfigured, low quality, blurry, watermark"
  };
}
