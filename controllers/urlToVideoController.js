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
import { whisperAudio } from '../actions/whisper.js';  // Import the whisper function
import fetch from 'node-fetch';  // For calling the Python endpoint
import dotenv from 'dotenv';     // To load environment variables

dotenv.config(); // Load .env file

// Escape special characters in subtitle text for FFmpeg
const escapeText = (text) => {
  return text
    .replace(/[\\']/g, '') // Remove quotes and backslashes
    .replace(/[^a-zA-Z0-9\s.,!?-]/g, '') // Only keep basic characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

// Controller for processing URL to video
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

    const audioUrl = speechResult.audioUrl;  // Get audio URL

    // Use Whisper to transcribe the audio
    const transcriptionResult = await whisperAudio(audioUrl);

    if (!transcriptionResult.success || !transcriptionResult.text) {
      return res.status(500).json({ success: false, message: "Failed to transcribe audio." });
    }

    // Create subtitles (SRT format)
    const transcriptionText = transcriptionResult.text;  // Transcribed text from Whisper
    const subtitles = createSrtFromTranscription(transcriptionText, transcriptionResult.words, 4);  // Create SRT file

    const summarizedContentChunks = summarizedContent.split(". ");
    let imageResults = [];
    const imageDuration = 5;

    // Generate images from summarized chunks
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

    // Save audio file directly to buffer
    const audioBuffer = await fetchAudio(audioUrl);

    // Create image list file dynamically
    const imageListPath = path.join(tempDir, 'images.txt');
    let imageListContent = '';
    for (const imageBuffer of imageResults) {
      const imagePath = path.join(tempDir, `image_${Math.random().toString(36).substring(2)}.jpg`);
      fs.writeFileSync(imagePath, Buffer.from(imageBuffer, 'base64'));
      imageListContent += `file '${imagePath.replace(/\\/g, '/')}'\n`;
      imageListContent += `duration ${imageDuration}\n`;
    }
    fs.writeFileSync(imageListPath, imageListContent);

    const videoPath = path.join(tempDir, 'output_video.mp4');
    const subtitlePath = path.join(tempDir, 'subtitles.srt');
    fs.writeFileSync(subtitlePath, subtitles);

    // Step 5: Send Data to Python for Video Processing
    const pythonResponse = await fetch(`${process.env.PYTHON_ENDPOINT}/create-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioUrl,         // Send the audio file URL
        images: imageResults,    // Send images in base64 or URL
        transcription: transcriptionText // Send transcription text
      })
    });

    const pythonData = await pythonResponse.json();

    if (!pythonResponse.ok) {
      throw new Error(pythonData.error || "Error generating video in Python.");
    }

    // Clean up temporary files
    fs.unlinkSync(imageListPath);
    fs.unlinkSync(subtitlePath);

    return res.json({
      success: true,
      message: 'Content successfully processed and video created!',
      data: {
        videoUrl: pythonData.video_url,  // Return the final video URL from Python
      },
    });

  } catch (error) {
    console.error("Error in processing:", error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`,
    });
  }
};

// Helper function to create an SRT file from the transcription text
const createSrtFromTranscription = (transcriptionText, words, maxDuration = 4) => {
  let srt = '';
  let currentStartTime = 0;
  let currentEndTime = 0;
  let currentText = '';
  let subtitleIndex = 1;

  // Iterate over words in transcription
  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Update the end time as the end time of the current word
    currentEndTime = word.end;

    // Add the word to the current subtitle chunk
    currentText += word.word + ' ';

    // If the duration exceeds the max duration, create a new subtitle
    if (currentEndTime - currentStartTime >= maxDuration || i === words.length - 1) {
      srt += `${subtitleIndex}\n`;
      srt += `${formatTime(currentStartTime)} --> ${formatTime(currentEndTime)}\n`;
      srt += `${currentText.trim()}\n\n`;

      // Update the start time and reset the current text for the next subtitle
      currentStartTime = currentEndTime;
      currentText = '';
      subtitleIndex++;
    }
  }

  return srt;
};

// Helper function to format time in HH:MM:SS format
const formatTime = (seconds) => {
  const date = new Date(seconds * 1000);
  return date.toISOString().substr(11, 8).replace('.', ',');  // Adjusting for proper SRT format (comma instead of period)
};

// Function to fetch audio from URL
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
