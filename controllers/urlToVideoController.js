import ffmpeg from "fluent-ffmpeg";
import { scrapeContent } from "../actions/scrape.js";
import { summarizeText } from "../actions/summarize.js";
import { generateSpeechAndSave } from "../actions/text-to-audio.js";
import { getUserFromSession } from "../utils/session.js";
import { generateImageFromPrompt } from "../actions/image-generation.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const escapeText = (text) => {
  return text
    .replace(/[\\']/g, '') // Remove quotes and backslashes
    .replace(/[^a-zA-Z0-9\s.,!?-]/g, '') // Only keep basic characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

export const UrlToVideoController = async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, message: "URL is required." });
    }

    const content = await scrapeContent(url);
    const summarizedContent = await summarizeText(content);

    if (!summarizedContent || summarizedContent === "No summary generated") {
      console.error("❌ No valid summary was generated.");
      return res.status(500).json({
        success: false,
        message: "Failed to generate a valid summary.",
      });
    }

    const voiceId = 9;
    const languageIsoCode = "en-us";

    const speechResult = await generateSpeechAndSave({
      prompt: summarizedContent,
      voiceId,
      languageIsoCode,
      userOverride: user,
    });

    const summarizedContentChunks = summarizedContent.split(". ");
    let imageResults = [];
    const imageDuration = 5;

    for (const chunk of summarizedContentChunks) {
      const imageResult = await generateImageFromPrompt(chunk);
      imageResults.push(imageResult.image);
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const tempDir = path.join(__dirname, '../temp_video');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save audio file
    const audioPath = path.join(tempDir, 'audio.mp3');
    fs.writeFileSync(audioPath, await fetchAudio(speechResult.audioUrl));

    // Create image list file
    const imageListPath = path.join(tempDir, 'images.txt');
    let imageListContent = '';
    for (const imagePath of imageResults) {
      imageListContent += `file '${imagePath}'\n`;
      imageListContent += `duration ${imageDuration}\n`;
    }
    imageListContent += `file '${imageResults[imageResults.length - 1]}'\n`;
    fs.writeFileSync(imageListPath, imageListContent);

    const videoPath = path.join(tempDir, 'output_video.mp4');

    return new Promise((resolve, reject) => {
      // Split the text into smaller chunks that FFmpeg can handle
      const maxCharsPerLine = 100;
      const textChunks = [];
      let currentChunk = '';

      summarizedContent.split(' ').forEach(word => {
        if ((currentChunk + ' ' + word).length <= maxCharsPerLine) {
          currentChunk += (currentChunk ? ' ' : '') + word;
        } else {
          if (currentChunk) textChunks.push(currentChunk);
          currentChunk = word;
        }
      });
      if (currentChunk) textChunks.push(currentChunk);

      // Create text overlay for each chunk
      const textOverlays = textChunks.map((chunk, index) => {
        const yPosition = 50 + (index * 30); // Stack text vertically
        return `drawtext=text='${escapeText(chunk)}':x=(w-text_w)/2:y=${yPosition}:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5`;
      });

      // Add the final "Thank you" message
      textOverlays.push(`drawtext=text='Thank you for watching!':x=(w-text_w)/2:y=(h-th)/2:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.5:enable='gte(t,${imageDuration-1})'`);

      ffmpeg()
        .input(imageListPath)
        .inputOptions(['-f concat', '-safe 0'])
        .input(audioPath)
        .outputOptions([
          `-vf "${textOverlays.join(',')}"`,
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-r 30',
          '-shortest'
        ])
        .on('start', (command) => {
          console.log('FFmpeg command:', command);
        })
        .on('end', () => {
          console.log('Video created successfully!');
          // Clean up temporary files
          fs.unlinkSync(imageListPath);
          fs.unlinkSync(audioPath);

          resolve(res.json({
            success: true,
            message: 'Content successfully processed and video created!',
            data: {
              videoUrl: `/videos/output_video.mp4`,
            },
          }));
        })
        .on('error', (err) => {
          console.error('Error in creating video:', err);
          reject(res.status(500).json({
            success: false,
            message: `Error in creating video: ${err.message}`,
          }));
        })
        .save(videoPath);
    });

  } catch (error) {
    console.error("Error in processing:", error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`,
    });
  }
};

const fetchAudio = async (audioUrl) => {
  try {
    const response = await fetch(audioUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error('Error fetching audio:', error);
    throw new Error(`Error fetching audio: ${error.message}`);
  }
};