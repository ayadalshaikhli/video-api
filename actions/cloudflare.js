import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Buffer } from 'buffer';
import crypto from 'crypto';
import { consola } from 'consola';
import { retryFunction } from '../utils/utils.js';
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_ACCESS_KEY_SECRET,
  },
  forcePathStyle: false,
});

function getFileBuffer(file) {
  // If file.buffer exists (e.g. from multer), use it; otherwise, fallback
  if (file.buffer) {
    return file.buffer;
  }
  // Fallback for other environments that have arrayBuffer (if needed)
  return Buffer.from(file.arrayBuffer());
}

function getOriginalName(file) {
  return file.originalname || file.name;
}

function getContentType(file) {
  return file.mimetype || file.type || "application/octet-stream";
}

export async function uploadFileAction(file) {
  if (!file) {
    throw new Error("No file provided");
  }

  const fileBuffer = getFileBuffer(file);
  const originalName = getOriginalName(file);
  const extMatch = originalName.match(/\.[0-9a-z]+$/i);
  const extension = extMatch ? extMatch[0] : "";
  const randomFileName = crypto.randomBytes(16).toString("hex");
  const key = `live/${randomFileName}${extension}`;

  const contentType = getContentType(file);

  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  const publicUrl = `${process.env.CLOUDFLARE_R2_DEV_ENDPOINT}/${key}`;

  return { key, publicUrl };
}

export async function uploadAudioFile(file) {
  if (!file) {
    throw new Error("No file provided");
  }

  const fileBuffer = getFileBuffer(file);
  const originalName = getOriginalName(file) || "audio.mp3";
  const extMatch = originalName.match(/\.[0-9a-z]+$/i);
  const extension = extMatch ? extMatch[0] : ".mp3";
  const randomFileName = crypto.randomBytes(16).toString("hex");

  const key = `audio/${randomFileName}${extension}`;
  const contentType = getContentType(file);

  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  // Retry the file upload in case of failure
  try {
    const result = await retryFunction(async () => {
      consola.info("Uploading file to Cloudflare R2...");
      await r2Client.send(command);
      consola.info("File uploaded successfully.");

      const publicUrl = `${process.env.CLOUDFLARE_R2_DEV_ENDPOINT}/${key}`;
      return { key, publicUrl };
    });

    return result;  // Return the result from retryFunction
  } catch (error) {
    consola.error(`❌ Failed to upload file after multiple attempts: ${error.message}`);
    throw error;
  }
}

export async function uploadVoiceFile(file) {
  if (!file) {
    throw new Error("No file provided");
  }

  const fileBuffer = getFileBuffer(file);
  const originalName = getOriginalName(file) || "voice.mp3";
  const extMatch = originalName.match(/\.[0-9a-z]+$/i);
  const extension = extMatch ? extMatch[0] : ".mp3";
  const randomFileName = crypto.randomBytes(16).toString("hex");
  const key = `voices/${randomFileName}${extension}`;
  const contentType = getContentType(file);

  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await r2Client.send(command);
  const publicUrl = `${process.env.CLOUDFLARE_R2_DEV_ENDPOINT}/${key}`;
  return { key, publicUrl };
}

export async function uploadImageFile(file) {
  if (!file) {
    throw new Error("No file provided");
  }

  const fileBuffer = getFileBuffer(file);
  const originalName = getOriginalName(file) || "image.jpg"; // Default to .jpg if no name
  const extMatch = originalName.match(/\.[0-9a-z]+$/i);
  const extension = extMatch ? extMatch[0] : ".jpg";
  const randomFileName = crypto.randomBytes(16).toString("hex");

  const key = `images/${randomFileName}${extension}`;
  const contentType = getContentType(file);

  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await r2Client.send(command);
  const publicUrl = `${process.env.CLOUDFLARE_R2_DEV_ENDPOINT}/${key}`;
  return { key, publicUrl };
}

export async function uploadVideoFile(file) {
  if (!file) {
    throw new Error("No file provided");
  }

  const fileBuffer = getFileBuffer(file);
  const originalName = getOriginalName(file) || "video.mp4";
  const extMatch = originalName.match(/\.[0-9a-z]+$/i);
  const extension = extMatch ? extMatch[0] : ".mp4";
  const randomFileName = crypto.randomBytes(16).toString("hex");
  const key = `video/${randomFileName}${extension}`;
  const contentType = getContentType(file);

  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  const publicUrl = `${process.env.CLOUDFLARE_R2_DEV_ENDPOINT}/${key}`;
  return { key, publicUrl };
}
