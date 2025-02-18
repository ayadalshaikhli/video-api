/***************************************************
 * UrlToVideoController.js
 ****************************************************/
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { scrapeContent } from "../actions/scrape.js";
import { summarizeText } from "../actions/summarize.js";
import { generateSpeechAndSave } from "../actions/text-to-audio.js";
import { getUserFromSession } from "../utils/session.js";
import { generateImageFromPrompt } from "../actions/image-generation.js";
import { whisperAudio } from "../actions/whisper.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

// Set ffmpeg path from the npm package ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegStatic);

// --------------------------------------------------
// 1) FETCH AUDIO HELPER
// --------------------------------------------------
async function fetchAudio(audioUrl) {
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }
    const arrayBuf = await response.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch (error) {
    console.error("Error fetching audio:", error);
    throw new Error(`Error fetching audio: ${error.message}`);
  }
}

// --------------------------------------------------
// 2) HELPER TO CLEAN BASE64 STRING
// --------------------------------------------------
function cleanBase64(base64String) {
  if (base64String.startsWith("data:")) {
    return base64String.split(",")[1];
  }
  return base64String;
}

// --------------------------------------------------
// 3) SRT HELPER FUNCTIONS (OLD, word-by-word)
// --------------------------------------------------
function secondsToSrt(seconds) {
  const date = new Date(seconds * 1000);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const secs = date.getUTCSeconds().toString().padStart(2, "0");
  const ms = date.getUTCMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${secs},${ms}`;
}

function transcriptionToWordBySrtEntry(words) {
  let srt = "";
  let index = 1;

  words.forEach((word, i) => {
    const startTime = Math.max(0, word.start - 0.05);
    const endTime = word.end + 0.05;

    const prevWords = words.slice(Math.max(0, i - 2), i).map((w) => w.word);
    const currentWord = word.word;
    const nextWords = words.slice(i + 1, i + 3).map((w) => w.word);

    const displayText = [...prevWords, `<b>${currentWord}</b>`, ...nextWords]
      .join(" ")
      .trim();

    srt += `${index}\n`;
    srt += `${secondsToSrt(startTime)} --> ${secondsToSrt(endTime)}\n`;
    srt += `${displayText}\n\n`;

    index++;
  });

  return srt;
}

// --------------------------------------------------
// 4) NEW HELPER: CONVERT VTT TO SRT
// --------------------------------------------------
/**
 * Converts VTT content into SRT format.
 * The VTT from Cloudflare Whisper already groups spoken phrases.
 */
function convertVttToSrt(vtt) {
  // Split by double-newlines to get blocks and ignore header lines (like "WEBVTT")
  const blocks = vtt.split(/\r?\n\r?\n/).filter(
    (block) => block.trim() && !block.startsWith("WEBVTT")
  );
  let srt = "";
  let index = 1;

  blocks.forEach((block) => {
    const lines = block.split(/\r?\n/);
    if (lines.length >= 2) {
      const timeLine = lines[0].trim();
      const text = lines.slice(1).join("\n");
      const match = timeLine.match(/([\d.]+)\s*-->\s*([\d.]+)/);
      if (match) {
        const start = convertTimestamp(match[1]);
        const end = convertTimestamp(match[2]);
        srt += index + "\n" + start + " --> " + end + "\n" + text + "\n\n";
        index++;
      }
    }
  });
  return srt;
}

/**
 * Converts a timestamp (in seconds as string) to SRT format "HH:MM:SS,mmm"
 */
function convertTimestamp(timeString) {
  const seconds = parseFloat(timeString);
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss},${ms}`;
}

// --------------------------------------------------
// 5) HELPER TO GET AUDIO DURATION
// --------------------------------------------------
async function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

// --------------------------------------------------
// 6) MAIN CONTROLLER
// --------------------------------------------------
export const UrlToVideoController = async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    const { url } = req.body;
    if (!url) {
      return res
        .status(400)
        .json({ success: false, message: "URL is required." });
    }

    // (A) SCRAPE & SUMMARIZE
    const content = await scrapeContent(url);
    const summarizedContent = await summarizeText(content);
    if (!summarizedContent || summarizedContent === "No summary generated") {
      console.error("❌ No valid summary was generated.");
      return res.status(500).json({
        success: false,
        message: "Failed to generate a valid summary.",
      });
    }

    // (B) GENERATE TTS AUDIO
    const voiceId = 9;
    const languageIsoCode = "en-us";
    const speechResult = await generateSpeechAndSave({
      prompt: summarizedContent,
      voiceId,
      languageIsoCode,
      userOverride: user,
    });
    const audioUrl = speechResult.audioUrl;

    // (C) WHISPER TRANSCRIPTION
    const transcriptionResult = await whisperAudio(audioUrl);
    if (
      !transcriptionResult.success ||
      !transcriptionResult.text ||
      !transcriptionResult.vtt
    ) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to transcribe audio." });
    }
    console.log("Transcribed text:", transcriptionResult.text);

    // (D) CREATE SRT FILE FROM VTT (instead of word-by-word)
    const srtContent = convertVttToSrt(transcriptionResult.vtt);
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const tempDir = path.join(__dirname, "../temp_video");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log("Temporary directory created:", tempDir);
    }
    const subtitlePath = path.join(tempDir, "subtitles.srt");
    fs.writeFileSync(subtitlePath, srtContent);
    console.log("SRT file created at:", subtitlePath);

    // (E) GENERATE IMAGES (using pre-saved images from generated_images folder)
    const summarizedContentChunks = summarizedContent.split(". ");
    let imagePaths = [];
    for (const chunk of summarizedContentChunks) {
      const imageResult = await generateImageFromPrompt(chunk);
      console.log(`Image generated at: ${imageResult.image}`);
      imagePaths.push(imageResult.image);
    }

    // (F) FETCH AND SAVE AUDIO LOCALLY
    const audioBuffer = await fetchAudio(audioUrl);
    const audioPath = path.join(tempDir, "speech_audio.mp3");
    fs.writeFileSync(audioPath, audioBuffer);
    console.log("Audio saved to:", audioPath);

    // (G) GET AUDIO DURATION
    const audioDuration = await getAudioDuration(audioPath);
    console.log("Audio duration:", audioDuration, "seconds");

    // (H) CREATE images.txt FILE FOR CONCAT, matching audio duration
    const imageListPath = path.join(tempDir, "images.txt");
    const numberOfImages = imagePaths.length;
    // For the concat demuxer, the last image does not contribute to duration.
    // So if there is more than one image, compute duration per image as:
    //   audioDuration / (numberOfImages - 1)
    // Otherwise, if only one image, use full duration.
    const durationPerImage =
      numberOfImages > 1 ? audioDuration / (numberOfImages - 1) : audioDuration;
    let imageListContent = "";
    imagePaths.forEach((imgPath, index) => {
      const formattedPath = imgPath.replace(/\\/g, "/");
      imageListContent += `file '${formattedPath}'\n`;
      // Add duration only for non-last images
      if (index !== imagePaths.length - 1) {
        imageListContent += `duration ${durationPerImage}\n`;
      }
    });
    // Repeat the last image as required by the concat demuxer
    if (numberOfImages > 0) {
      const lastImagePath = imagePaths[numberOfImages - 1].replace(/\\/g, "/");
      imageListContent += `file '${lastImagePath}'\n`;
    }
    fs.writeFileSync(imageListPath, imageListContent);
    console.log("Created images list file at:", imageListPath);

    // (I) CREATE VIDEO VIA TWO PASSES

    const slideshowPath = path.join(tempDir, "slideshow.mp4");
    const finalVideoPath = path.join(tempDir, "output_video.mp4");

    // ----- PASS 1: Create slideshow from images -----
    let slideshowStderr = "";
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(imageListPath)
        .inputFormat("concat")
        .inputOptions(["-safe", "0", "-vsync", "vfr"])
        // Let the concat demuxer use durations from the file list
        .outputOptions([
          "-pix_fmt", "yuv420p",
          "-loglevel", "verbose",
        ])
        .on("stderr", (line) => {
          console.log("FFmpeg (slideshow) stderr:", line);
          slideshowStderr += line + "\n";
        })
        .on("error", (err) => {
          console.error("Error in slideshow pass:", err);
          reject(new Error(`Slideshow error:\n${slideshowStderr}\n${err.message}`));
        })
        .on("end", () => {
          console.log("Slideshow video created at:", slideshowPath);
          resolve(true);
        })
        .save(slideshowPath);
    });

    // ----- PASS 2: Add audio + burn in subtitles -----
    const fontsDir = path.resolve(__dirname, "../fonts");
    const formattedSubtitlePath = subtitlePath
      .replace(/\\/g, "/")
      .replace(/^([A-Z]):/, "$1\\:");
    const formattedFontsDir = fontsDir
      .replace(/\\/g, "/")
      .replace(/^([A-Z]):/, "$1\\:");
    const subtitlesFilter = `subtitles='${formattedSubtitlePath}:fontsdir=${formattedFontsDir}:force_style=Fontname=Roboto,FontSize=30,MarginV=70,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,Bold=1'`;
    
    // Chain an fps filter (forcing 30fps) with the subtitles filter
    const vfFilter = `fps=30,${subtitlesFilter}`;
    
    let mergeStderr = "";
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(slideshowPath)
        .input(audioPath)
        .audioCodec("aac")
        .videoCodec("libx264")
        .outputOptions([
          "-vf", vfFilter,
          // Force the final duration to match the audio duration
          "-t", audioDuration.toString(),
          "-y",
          "-loglevel", "verbose"
        ])
        .on("stderr", (line) => {
          console.log("FFmpeg (merge) stderr:", line);
          mergeStderr += line + "\n";
        })
        .on("error", (err) => {
          console.error("Error in merge pass:", err);
          reject(new Error(`Merge error:\n${mergeStderr}\n${err.message}`));
        })
        .on("end", () => {
          console.log("Final video created at:", finalVideoPath);
          resolve(true);
        })
        .save(finalVideoPath);
    });

    return res.json({
      success: true,
      message:
        "Video created successfully with synced audio and continuously updated captions!",
      data: { videoUrl: finalVideoPath },
    });
  } catch (error) {
    console.error("Error in processing:", error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`,
    });
  }
};
