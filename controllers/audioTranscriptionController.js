import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { whisperAudio } from "../actions/whisper.js";
import { geminiSummarize } from "../actions/gemini-summarize.js";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

function createJobTempDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirnameCurrent = dirname(__filename);
  const baseTempDir = path.join(__dirnameCurrent, "../temp_audio");
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

export const AudioTranscriptionController = async (req, res) => {
  const { baseTempDir, jobTempDir } = createJobTempDir();
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Audio file required." });
    }
    const audioPath = path.join(jobTempDir, req.file.originalname);
    fs.writeFileSync(audioPath, req.file.buffer);
    console.log("Audio saved to:", audioPath);
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
    const combinedTranscription = transcriptionResults.map((result) => result.text).join(" ");
    const combinedWords = transcriptionResults.reduce((acc, curr) => {
      if (curr.words && curr.words.length > 0) {
        return acc.concat(curr.words);
      }
      return acc;
    }, []);
    const summaryResult = await geminiSummarize(combinedTranscription);
    if (!summaryResult.success) {
      return res.status(500).json({ success: false, message: "Summarization failed.", error: summaryResult.error });
    }
    // Calculate actual duration from the last word's end time
    const actualDuration = combinedWords.length > 0 
      ? Math.max(...combinedWords.map(word => word.end || 0))
      : transcriptionResults.reduce((total, result) => total + (result.duration || 0), 0);

    return res.json({
      success: true,
      summary: summaryResult.summary,
      message: "Transcription and summarization completed successfully.",
      text: combinedTranscription,
      words: combinedWords,
      duration: actualDuration
    });
  } catch (err) {
    console.error("Error in AudioTranscriptionController:", err);
    return res.status(500).json({ success: false, message: `Error: ${err.message}` });
  } finally {
    if (fs.existsSync(jobTempDir)) {
      fs.rmSync(jobTempDir, { recursive: true, force: true });
      console.log("Job temporary files removed.");
    }
  }
};
