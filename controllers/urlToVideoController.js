import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { scrapeContent } from "../actions/scrape.js";
import { summarizeText } from "../actions/summarize.js";
import { generateSpeechAndSave } from "../actions/text-to-audio.js";
import { getUserFromSession } from "../utils/session.js";
import { generateImageFromPrompt } from "../actions/image-generation.js";
import { whisperAudio } from "../actions/whisper.js";
import { uploadVideoFile } from "../actions/cloudflare.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Import DB functions for video styles and voices.
import { fetchVideoStylesByIds, fetchVoicesByIds } from "../data/media-styles.js";
// Import the LLM image prompter.
import { generateImagePrompts } from "../actions/image-prompter.js";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegStatic);

// Helper to get SDXL parameters from video style record.
function getSdxlParams(styleRecord) {
  const defaultParams = {
    model: "flux-1-schnell",
    negative_prompt: "",
    height: 512,
    width: 512,
    num_steps: 20,
    guidance: 7.5,
    seed: 0,
  };
  if (!styleRecord || !styleRecord.sdxlParams) return defaultParams;
  return {
    ...defaultParams,
    ...styleRecord.sdxlParams,
  };
}

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

function secondsToSrt(seconds) {
  const date = new Date(seconds * 1000);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const secs = date.getUTCSeconds().toString().padStart(2, "0");
  const ms = date.getUTCMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${secs},${ms}`;
}

function convertTimestamp(timeString) {
  const seconds = parseFloat(timeString);
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss},${ms}`;
}

function convertVttToSrt(vtt) {
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

async function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(parseFloat(metadata.format.duration));
      }
    });
  });
}

export const UrlToVideoController = async (req, res) => {
  console.log("Request body:", req.body);

  // Base directories for temporary files and generated images.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const baseTempDir = path.join(__dirname, "../temp_video");
  const generatedImagesDir = path.join(__dirname, "../generated_images");

  // Create a unique temporary directory for this job.
  const jobTempDir = path.join(
    baseTempDir,
    `job-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  );
  if (!fs.existsSync(jobTempDir)) {
    fs.mkdirSync(jobTempDir, { recursive: true });
    console.log("Job temporary directory created:", jobTempDir);
  }

  try {
    const user = await getUserFromSession(req);
    const { url, text, projectTitle, captionId, videoStyleId, voiceId } = req.body;

    if (!url && !text) {
      return res.status(400).json({ success: false, message: "Either URL or text input is required." });
    }

    // Determine final script.
    let finalScript;
    if (text && text.trim().length > 0) {
      finalScript = text;
      console.log("Using provided text as script.");
    } else {
      const content = await scrapeContent(url);
      const summary = await summarizeText(content);
      if (!summary || summary === "No summary generated") {
        console.error("❌ No valid summary was generated.");
        return res.status(500).json({ success: false, message: "Failed to generate a valid summary." });
      }
      finalScript = summary;
    }

    // Set forced subtitle style based on captionId.
    let forcedSubtitleStyle;
    switch (captionId?.toString()) {
      case "1":
        forcedSubtitleStyle = "FontName=Roboto,FontSize=30,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&HAA000000&,BorderStyle=3,Outline=1,Shadow=1";
        break;
      case "2":
        forcedSubtitleStyle = "FontName=Impact,FontSize=36,PrimaryColour=&H00F2FF76&,OutlineColour=&H00000000&,BackColour=&HAAFF0000&,BorderStyle=3,Outline=2,Shadow=1";
        break;
      case "3":
        forcedSubtitleStyle = "FontName=Arial,FontSize=32,PrimaryColour=&H00F2FF76&,OutlineColour=&H00000000&,BackColour=&HAA000000&,BorderStyle=3,Outline=1,Shadow=1";
        break;
      default:
        forcedSubtitleStyle = "FontName=Roboto,FontSize=30,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&HAA000000&,BorderStyle=3,Outline=1,Shadow=1";
    }
    console.log("Forced subtitle style:", forcedSubtitleStyle);

    // Fetch video style and voice details.
    let videoStyleRecord = null;
    if (videoStyleId) {
      const videoStyleResults = await fetchVideoStylesByIds([videoStyleId]);
      if (videoStyleResults.length > 0) {
        videoStyleRecord = videoStyleResults[0];
      }
    }
    let voiceRecord = null;
    if (voiceId) {
      const voiceResults = await fetchVoicesByIds([voiceId]);
      if (voiceResults.length > 0) {
        voiceRecord = voiceResults[0];
      }
    }
    const finalVoiceId = voiceRecord ? parseInt(voiceRecord.id, 10) : 9;
    const languageIsoCode = "en-us";

    // Generate speech (audio).
    const speechResult = await generateSpeechAndSave({
      prompt: finalScript,
      voiceId: finalVoiceId,
      languageIsoCode,
      userOverride: user,
    });
    const audioUrl = speechResult.audioUrl;

    // Transcribe audio.
    const transcriptionResult = await whisperAudio(audioUrl);
    if (!transcriptionResult.success || !transcriptionResult.text || !transcriptionResult.vtt) {
      return res.status(500).json({ success: false, message: "Failed to transcribe audio." });
    }
    console.log("Transcribed text:", transcriptionResult.text);
    const srtContent = convertVttToSrt(transcriptionResult.vtt);
    const subtitlePath = path.join(jobTempDir, "subtitles.srt");
    fs.writeFileSync(subtitlePath, srtContent);
    console.log("SRT file created at:", subtitlePath);

    // Save audio locally and calculate duration.
    const audioBuffer = await fetchAudio(audioUrl);
    const audioPath = path.join(jobTempDir, "speech_audio.mp3");
    fs.writeFileSync(audioPath, audioBuffer);
    console.log("Audio saved to:", audioPath);
    const audioDuration = await getAudioDuration(audioPath);
    console.log("Audio duration:", audioDuration, "seconds");

    // Decide number of images to generate.
    const numImages = Math.max(1, Math.round(audioDuration / 6.5));
    console.log("Number of images to generate:", numImages);

    // Build video style guidelines from the style record.
    let videoStyleGuidelines = "";
    if (videoStyleRecord && videoStyleRecord.prompts) {
      if (Array.isArray(videoStyleRecord.prompts)) {
        videoStyleGuidelines = videoStyleRecord.prompts.join(" ");
      } else {
        videoStyleGuidelines = videoStyleRecord.prompts;
      }
    }
    console.log("Video style guidelines:", videoStyleGuidelines);

    // Retrieve advanced SDXL parameters from video style record.
    const sdxlParams = videoStyleRecord ? getSdxlParams(videoStyleRecord) : {
      model: "flux-1-schnell",
      negative_prompt: "",
      height: 512,
      width: 512,
      num_steps: 20,
      guidance: 7.5,
      seed: 0,
    };
    console.log("SDXL Params:", sdxlParams);

    // Generate image prompts via LLM.
    const imagePrompts = await generateImagePrompts(transcriptionResult.text, videoStyleGuidelines, numImages);
    console.log("LLM generated image prompts:", imagePrompts);

    // Generate images for each prompt.
    let imagePaths = [];
    for (const prompt of imagePrompts) {
      const imageResult = await generateImageFromPrompt(prompt, videoStyleGuidelines, sdxlParams.model, sdxlParams);
      console.log(`Image generated at: ${imageResult.image}`);
      imagePaths.push(imageResult.image);
    }
    console.log("Total images generated:", imagePaths.length);

    // Create FFmpeg images list file.
    const imageListPath = path.join(jobTempDir, "images.txt");
    let imageListContent = "";
    const durationPerImage = audioDuration / imagePaths.length;
    imagePaths.forEach((imgPath) => {
      const formattedPath = imgPath.replace(/\\/g, "/");
      imageListContent += `file '${formattedPath}'\n`;
      imageListContent += `duration ${durationPerImage}\n`;
    });
    const lastImagePath = imagePaths[imagePaths.length - 1].replace(/\\/g, "/");
    imageListContent += `file '${lastImagePath}'\n`;
    fs.writeFileSync(imageListPath, imageListContent);
    console.log("Created images list file at:", imageListPath);

    // Create slideshow video.
    const slideshowPath = path.join(jobTempDir, "slideshow.mp4");
    const finalVideoPath = path.join(jobTempDir, "output_video.mp4");
    let slideshowStderr = "";
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(imageListPath)
        .inputFormat("concat")
        .inputOptions(["-safe", "0", "-vsync", "vfr"])
        .outputOptions(["-pix_fmt", "yuv420p", "-loglevel", "verbose"])
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

    // Prepare subtitle filter.
    const fontsDir = path.resolve(__dirname, "../fonts");
    const formattedSubtitlePath = subtitlePath.replace(/\\/g, "/").replace(/^([A-Z]):/, "$1\\:");
    const formattedFontsDir = fontsDir.replace(/\\/g, "/").replace(/^([A-Z]):/, "$1\\:");
    const subtitlesFilter = `subtitles='${formattedSubtitlePath}:fontsdir=${formattedFontsDir}:force_style=${forcedSubtitleStyle}'`;
    const vfFilter = `fps=30,${subtitlesFilter}`;

    let mergeStderr = "";
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(slideshowPath)
        .input(audioPath)
        .audioCodec("aac")
        .videoCodec("libx264")
        .outputOptions([
          "-vf",
          vfFilter,
          "-t",
          audioDuration.toString(),
          "-y",
          "-loglevel",
          "verbose"
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

    const videoFile = {
      buffer: fs.readFileSync(finalVideoPath),
      originalname: "output_video.mp4",
      mimetype: "video/mp4"
    };
    const uploadResult = await uploadVideoFile(videoFile);
    console.log("Video uploaded. Public URL:", uploadResult.publicUrl);

    return res.json({
      success: true,
      message: "Video created, uploaded, and temporary files removed successfully!",
      data: { videoUrl: uploadResult.publicUrl }
    });
  } catch (error) {
    console.error("Error in processing:", error);
    return res.status(500).json({ success: false, message: `Error: ${error.message}` });
  } finally {
    // Remove job temporary directory.
    if (fs.existsSync(jobTempDir)) {
      fs.rmSync(jobTempDir, { recursive: true, force: true });
      console.log("Job temporary files removed in finally block.");
    }
    // Remove the generated_images folder.
    if (fs.existsSync(generatedImagesDir)) {
      fs.rmSync(generatedImagesDir, { recursive: true, force: true });
      console.log("Generated images folder removed in finally block.");
    }
    if (fs.existsSync('../temp_video')) {
      fs.rmSync('../temp_video', { recursive: true, force: true });
      console.log("Generated images folder removed in finally block.");
    }
  }
};
