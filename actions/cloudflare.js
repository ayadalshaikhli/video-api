import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Buffer } from 'buffer';
import crypto from 'crypto';

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
  const originalName = getOriginalName(file) || "audio.webm";
  const extMatch = originalName.match(/\.[0-9a-z]+$/i);
  const extension = extMatch ? extMatch[0] : ".webm";
  const randomFileName = crypto.randomBytes(16).toString("hex");

  const key = `audio/${randomFileName}${extension}`;
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

export async function uploadVoiceFile(file) {
  if (!file) {
    throw new Error("No file provided");
  }

  const fileBuffer = getFileBuffer(file);
  const originalName = getOriginalName(file) || "voice.webm";
  const extMatch = originalName.match(/\.[0-9a-z]+$/i);
  const extension = extMatch ? extMatch[0] : ".webm";
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
