// utils/getMp3Duration.js
import { parseBuffer } from "music-metadata";
import fs from "fs/promises";

export const getMp3Duration = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  const metadata = await parseBuffer(buffer, { mimeType: "audio/mpeg" });
  const seconds = metadata.format.duration;
  return Math.round((seconds / 60) * 100) / 100;
};
