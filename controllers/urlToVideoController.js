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
    const imageDuration = 5; // Duration each image should show (in seconds)
    let currentTime = 0; // Track the current time for the chunks
    let overlayTextContent = ''; // Store the content for text overlay

    for (const [index, chunk] of summarizedContentChunks.entries()) {
      const imageResult = await generateImageFromPrompt(chunk);
      imageResults.push(imageResult.image);

      // Calculate the start and end times for the chunk (based on image duration)
      const startTime = currentTime;
      const endTime = currentTime + imageDuration;

      // Update the current time for the next chunk
      currentTime = endTime;

      // Prepare the overlay text (this is what will appear over the video)
      overlayTextContent += `\n#${index + 1} - Text: "${chunk}" Duration: [${startTime}s to ${endTime}s]\n`;
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

    // Create a temporary text file listing all images (for FFmpeg concat demuxer)
    const imageListPath = path.join(tempDir, 'images.txt');
    let imageListContent = '';
    for (const imagePath of imageResults) {
      imageListContent += `file '${imagePath}'\n`;
      imageListContent += `duration ${imageDuration}\n`;
    }
    imageListContent += `file '${imageResults[imageResults.length - 1]}'\n`;
    fs.writeFileSync(imageListPath, imageListContent);

    const videoPath = path.join(tempDir, 'output_video.mp4');

    // Create new FFmpeg command to generate video with text overlay
    return new Promise((resolve, reject) => {
      const ffmpegCommand = ffmpeg();

      // Add the images (using concat demuxer)
      ffmpegCommand.input(imageListPath).inputOptions(['-f concat', '-safe 0']);

      // Add audio
      ffmpegCommand.input(audioPath);

      // Use drawtext filter to add dynamic text overlay
      summarizedContentChunks.forEach((chunk, index) => {
        const startTime = index * imageDuration;
        const endTime = (index + 1) * imageDuration;

        // Overlay text on video (adjust position, font, size, etc.)
        ffmpegCommand.outputOptions([
          `-vf "drawtext=text='${chunk.replace(/'/g, "\\'")}':enable='between(t,${startTime},${endTime})':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2"`,
        ]);
      });

      // Final output options for video encoding
      ffmpegCommand.outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-r 30',
        '-shortest', // End when the shorter input ends (audio or images)
      ]);

      ffmpegCommand.on('end', () => {
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
