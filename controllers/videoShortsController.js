import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { whisperAudio } from "../actions/whisper.js";
import { geminiExtractSections } from "../actions/gemini-summarize.js";
import { uploadVideoFile } from "../actions/cloudflare.js";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

function createJobTempDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirnameCurrent = dirname(__filename);
  const baseTempDir = path.join(__dirnameCurrent, "../temp_video");
  const jobTempDir = path.join(
    baseTempDir,
    `job-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  );
  if (!fs.existsSync(jobTempDir)) {
    fs.mkdirSync(jobTempDir, { recursive: true });
    console.log("Job temporary directory created:", jobTempDir);
  }
  return { baseTempDir, jobTempDir };
}

function extractAudio(videoPath, outputAudioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .output(outputAudioPath)
      .on("end", () => {
        console.log("Audio extraction completed:", outputAudioPath);
        resolve();
      })
      .on("error", (err) => reject(err))
      .run();
  });
}

function splitAudio(filePath, chunkDurationInSeconds, outputDir) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      const chunks = [];
      let startTime = 0;
      let chunkIndex = 0;
      while (startTime < duration) {
        const outputFilePath = path.join(outputDir, `chunk-${chunkIndex}.mp3`);
        chunks.push({ start: startTime, file: outputFilePath });
        startTime += chunkDurationInSeconds;
        chunkIndex++;
      }
      const processChunk = (chunk) =>
        new Promise((res, rej) => {
          ffmpeg(filePath)
            .setStartTime(chunk.start)
            .duration(chunkDurationInSeconds)
            .output(chunk.file)
            .on("end", () => res())
            .on("error", (error) => rej(error))
            .run();
        });
      Promise.all(chunks.map(processChunk))
        .then(() => resolve(chunks))
        .catch(reject);
    });
  });
}

function sanitizeCaption(caption) {
  return caption.replace(/'/g, "").replace(/[\r\n]+/g, " ");
}

function cutVideoSegment(videoPath, startTime, duration, caption, outputFilePath) {
  return new Promise((resolve, reject) => {
    const sanitizedCaption = sanitizeCaption(caption);
    ffmpeg(videoPath)
      .setStartTime(startTime)
      .duration(duration)
      .videoFilters({
        filter: "drawtext",
        options: {
          text: sanitizedCaption,
          fontcolor: "white",
          fontsize: 48, // Increased font size
          x: "(w-text_w)/2",
          y: "h-(text_h*2)"
        }
      })
      .output(outputFilePath)
      .on("stderr", (stderrLine) => {
        console.error("ffmpeg stderr:", stderrLine);
      })
      .on("end", () => {
        console.log(`Video segment created: ${outputFilePath}`);
        resolve();
      })
      .on("error", (err) => {
        console.error("ffmpeg error:", err);
        reject(err);
      })
      .run();
  });
}

export const VideoShortsController = async (req, res) => {
  const { baseTempDir, jobTempDir } = createJobTempDir();
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Video file required." });
    }
    const videoPath = path.join(jobTempDir, req.file.originalname);
    fs.writeFileSync(videoPath, req.file.buffer);
    console.log("Video saved to:", videoPath);
    const audioPath = path.join(jobTempDir, "extracted_audio.mp3");
    await extractAudio(videoPath, audioPath);
    const chunkDuration = 60;
    const chunks = await splitAudio(audioPath, chunkDuration, jobTempDir);
    console.log("Audio split into chunks:", chunks);
    const transcriptionResults = await Promise.all(
      chunks.map(async (chunk) => {
        const audioBuffer = fs.readFileSync(chunk.file);
        const audioDataUri = `data:audio/mp3;base64,${audioBuffer.toString("base64")}`;
        return whisperAudio(audioDataUri);
      })
    );
    const combinedTranscription = transcriptionResults
      .map((result) => result.text)
      .join(" ");
    console.log("Combined transcription:", combinedTranscription);
    const summaryResult = await geminiExtractSections(combinedTranscription);
    if (!summaryResult.success || !summaryResult.sections) {
      return res.status(500).json({
        success: false,
        message: "Summarization failed or did not return sections.",
        error: summaryResult.error || "No sections provided."
      });
    }
    const segmentUrls = [];
    for (const [i, section] of summaryResult.sections.entries()) {
      const segmentDuration = section.end - section.start;
      const segmentFileName = `short_${i}.mp4`;
      const segmentPath = path.join(jobTempDir, segmentFileName);
      await cutVideoSegment(videoPath, section.start, segmentDuration, section.caption, segmentPath);
      const uploadResult = await uploadVideoFile({
        buffer: fs.readFileSync(segmentPath),
        originalname: segmentFileName,
        mimetype: "video/mp4"
      });
      segmentUrls.push(uploadResult.publicUrl);
    }
    return res.json({
      success: true,
      segments: segmentUrls,
      message: "Video processing completed successfully."
    });
  } catch (err) {
    console.error("Error in VideoShortsController:", err);
    return res.status(500).json({ success: false, message: `Error: ${err.message}` });
  } finally {
    // if (fs.existsSync(jobTempDir)) {
    //   fs.rmSync(jobTempDir, { recursive: true, force: true });
    //   console.log("Job temporary files removed.");
    // }
  }
};