import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

import { scrapeContent } from "../actions/scrape.js";
import { summarizeText } from "../actions/summarize.js";
import { generateSpeechAndSave } from "../actions/text-to-audio.js";
import { getUserFromSession } from "../utils/session.js";
import { generateImageFromPrompt } from "../actions/image-generation.js";
import { whisperAudio } from "../actions/whisper.js";
import { uploadVideoFile } from "../actions/cloudflare.js";
import { fetchVideoStylesByIds, fetchVoicesByIds } from "../data/media-styles.js";
import { generateImagePrompts } from "../actions/image-prompter.js";
import { vttToAss, getAssStyleInfoFromCaptionId } from "../utils/subtitleUtiles.js";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegStatic);

// This function returns default SDXL parameters if none are provided in the style record.
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
  return { ...defaultParams, ...styleRecord.sdxlParams };
}

async function fetchAudio(audioUrl) {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }
  const arrayBuf = await response.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(parseFloat(metadata.format.duration));
    });
  });
}

export const UrlToVideoController = async (req, res) => {
  console.log("Request body:", req.body);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const baseTempDir = path.join(__dirname, "../temp_video");
  const generatedImagesDir = path.join(__dirname, "../generated_images");
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
      return res.status(400).json({
        success: false,
        message: "Either URL or text input is required.",
      });
    }

    let finalScript;
    if (text && text.trim().length > 0) {
      finalScript = text;
      console.log("Using provided text as script.");
    } else {
      const content = await scrapeContent(url);
      const summary = await summarizeText(content);
      if (!summary || summary === "No summary generated") {
        console.error("No valid summary was generated.");
        return res
          .status(500)
          .json({ success: false, message: "Failed to generate a valid summary." });
      }
      finalScript = summary;
    }

    // Decide style based on captionId using your utility.
    // (This variable is used only to log the chosen style; the subtitle utility is later used.)
    let chosenStyle = "DefaultStyle";
    switch (captionId?.toString()) {
      case "1":
        chosenStyle = "YoutuberStyle";
        break;
      case "2":
        chosenStyle = "SupremeStyle";
        break;
      case "3":
        chosenStyle = "NeonStyle";
        break;
      case "4":
        chosenStyle = "GlitchStyle";
        break;
      case "5":
        chosenStyle = "FireStyle";
        break;
      case "6":
        chosenStyle = "FuturisticStyle";
        break;
      default:
        chosenStyle = "DefaultStyle";
    }
    console.log("Chosen style:", chosenStyle);

    // Voice selection
    let voiceRecord = null;
    if (voiceId) {
      const voiceResults = await fetchVoicesByIds([voiceId]);
      if (voiceResults.length > 0) {
        voiceRecord = voiceResults[0];
      }
    }
    const finalVoiceId = voiceRecord ? parseInt(voiceRecord.id, 10) : 9;

    // Generate TTS
    const speechResult = await generateSpeechAndSave({
      prompt: finalScript,
      voiceId: finalVoiceId,
      languageIsoCode: "en-us",
      userOverride: user,
    });
    const audioUrl = speechResult.audioUrl;

    // Transcribe with Whisper
    const transcriptionResult = await whisperAudio(audioUrl);
    if (
      !transcriptionResult.success ||
      !transcriptionResult.text ||
      !transcriptionResult.vtt
    ) {
      return res.status(500).json({ success: false, message: "Failed to transcribe audio." });
    }
    console.log("Transcribed text:", transcriptionResult.text);

    // Download audio
    const audioBuffer = await fetchAudio(audioUrl);
    const audioPath = path.join(jobTempDir, "speech_audio.mp3");
    fs.writeFileSync(audioPath, audioBuffer);

    // Get audio duration
    const audioDuration = await getAudioDuration(audioPath);
    console.log("Audio duration:", audioDuration, "seconds");

    // Decide number of images
    const numImages = Math.max(1, Math.round(audioDuration / 6.5));
    console.log("Number of images to generate:", numImages);

    // Fetch video style guidelines if available
    let videoStyleRecord = null;
    if (videoStyleId) {
      const vsResults = await fetchVideoStylesByIds([videoStyleId]);
      if (vsResults.length > 0) {
        videoStyleRecord = vsResults[0];
      }
    }
    let videoStyleGuidelines = "";
    if (videoStyleRecord && videoStyleRecord.prompts) {
      videoStyleGuidelines = Array.isArray(videoStyleRecord.prompts)
        ? videoStyleRecord.prompts.join(" ")
        : videoStyleRecord.prompts;
    }

    // Get SDXL parameters (or use default)
    const sdxlParams = videoStyleRecord
      ? getSdxlParams(videoStyleRecord)
      : {
          model: "flux-1-schnell",
          negative_prompt: "",
          height: 512,
          width: 512,
          num_steps: 20,
          guidance: 7.5,
          seed: 0,
        };

    // Generate image prompts via LLM
    const imagePrompts = await generateImagePrompts(
      transcriptionResult.text,
      videoStyleGuidelines,
      numImages
    );
    console.log("LLM generated image prompts:", imagePrompts);

    // Fetch images based on prompts
    const imagePaths = [];
    for (const prompt of imagePrompts) {
      const imgRes = await generateImageFromPrompt(
        prompt,
        videoStyleGuidelines,
        sdxlParams.model,
        sdxlParams
      );
      imagePaths.push(imgRes.image);
    }
    console.log("Total images generated:", imagePaths.length);

    // Create slideshow from images
    const imageListPath = path.join(jobTempDir, "images.txt");
    let imageListContent = "";
    const durationPerImage = audioDuration / imagePaths.length;
    imagePaths.forEach((imagePath) => {
      const formatted = imagePath.replace(/\\/g, "/");
      imageListContent += `file '${formatted}'\n`;
      imageListContent += `duration ${durationPerImage}\n`;
    });
    if (imagePaths.length > 0) {
      const lastImage = imagePaths[imagePaths.length - 1].replace(/\\/g, "/");
      imageListContent += `file '${lastImage}'\n`;
    }
    fs.writeFileSync(imageListPath, imageListContent);

    const slideshowPath = path.join(jobTempDir, "slideshow.mp4");
    await new Promise((resolve, reject) => {
      let stderr = "";
      ffmpeg()
        .input(imageListPath)
        .inputFormat("concat")
        .inputOptions(["-safe", "0", "-vsync", "vfr"])
        .outputOptions(["-pix_fmt", "yuv420p", "-loglevel", "verbose"])
        .on("stderr", (line) => (stderr += line + "\n"))
        .on("error", (err) =>
          reject(new Error(`Slideshow error:\n${stderr}\n${err.message}`))
        )
        .on("end", () => resolve(true))
        .save(slideshowPath);
    });

    // Create subtitles using your subtitle utility.
    const styleInfo = getAssStyleInfoFromCaptionId(captionId);
    const assPath = path.join(jobTempDir, "subtitles.ass");
    const assContent = vttToAss(transcriptionResult.vtt, styleInfo);
    fs.writeFileSync(assPath, assContent, "utf8");

    // Merge final video
    const finalVideoPath = path.join(jobTempDir, "output_video.mp4");
    const fontsDir = path.resolve(__dirname, "../fonts");
    const formattedAssPath = assPath.replace(/\\/g, "/").replace(/^([A-Z]):/, "$1\\:");
    const formattedFontsDir = fontsDir.replace(/\\/g, "/").replace(/^([A-Z]):/, "$1\\:");
    // Removed the :fontprovider=auto option to avoid FFmpeg error.
    const subtitlesFilter = `subtitles='${formattedAssPath}:fontsdir=${formattedFontsDir}'`;
    const vfFilter = `fps=30,${subtitlesFilter}`;

    await new Promise((resolve, reject) => {
      let stderr = "";
      ffmpeg()
        .input(slideshowPath)
        .input(audioPath)
        .audioCodec("aac")
        .videoCodec("libx264")
        .outputOptions([
          "-vf", vfFilter,
          "-t", audioDuration.toString(),
          "-y",
          "-loglevel", "verbose",
        ])
        .on("stderr", (line) => (stderr += line + "\n"))
        .on("error", (err) =>
          reject(new Error(`Merge error:\n${stderr}\n${err.message}`))
        )
        .on("end", () => resolve(true))
        .save(finalVideoPath);
    });

    // Upload final video
    const videoFile = {
      buffer: fs.readFileSync(finalVideoPath),
      originalname: "output_video.mp4",
      mimetype: "video/mp4",
    };
    const uploadResult = await uploadVideoFile(videoFile);

    return res.json({
      success: true,
      message: "Video created, uploaded, and temporary files removed successfully!",
      data: { videoUrl: uploadResult.publicUrl },
    });
  } catch (err) {
    console.error("Error in processing:", err);
    return res.status(500).json({ success: false, message: `Error: ${err.message}` });
  } finally {
    if (fs.existsSync(jobTempDir)) {
      fs.rmSync(jobTempDir, { recursive: true, force: true });
      console.log("Job temporary files removed in finally block.");
    }
    if (fs.existsSync(generatedImagesDir)) {
      fs.rmSync(generatedImagesDir, { recursive: true, force: true });
      console.log("Generated images folder removed in finally block.");
    }
    if (fs.existsSync("../temp_video")) {
      fs.rmSync("../temp_video", { recursive: true, force: true });
      console.log("Temp_video folder removed in finally block.");
    }
  }
};
