import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import { uploadVideoFile } from "../actions/cloudflare.js"; // your upload utility
import { whisperAudio } from "../actions/whisper.js"; // your whisperAudio function

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 * Helper to create a temporary directory for a job.
 */
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

/**
 * Helper to generate a very simple ASS subtitle file from caption segments.
 * Each segment should have text, startTime, and endTime (in seconds).
 */
function generateAssFromCaptions(segments, styling = {}) {
  const { selectedFont = "Arial", selectedColor = "&H00FFFFFF", fontSize = 24, projectTitle = "" } = styling;
  // Basic ASS header; adjust as needed.
  let assContent = `[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1280
PlayResY: 720
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${selectedFont},${fontSize},${selectedColor},0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  segments.forEach(seg => {
    // Helper to convert seconds to ASS time format (H:MM:SS.cs)
    const formatTime = (timeInSeconds) => {
      const hours = Math.floor(timeInSeconds / 3600);
      const minutes = Math.floor((timeInSeconds % 3600) / 60);
      const seconds = (timeInSeconds % 60).toFixed(2).padStart(5, "0");
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds}`;
    };
    const startTimeFormatted = formatTime(seg.startTime);
    const endTimeFormatted = formatTime(seg.endTime);
    assContent += `Dialogue: 0,${startTimeFormatted},${endTimeFormatted},Default,,0,0,0,,${seg.text}\n`;
  });
  return assContent;
}

/**
 * Main controller to handle both transcription and export actions.
 * Expects multipart/form-data with video file under field "video".
 * For transcription: body.action = "transcribe"
 * For export: body.action = "export" and body.editedCaptions (JSON string) plus styling fields.
 */
export const VideoCaptionController = async (req, res) => {
  const { baseTempDir, jobTempDir } = createJobTempDir();

  try {
    const action = req.body.action;
    if (action === "transcribe") {
      // === TRANSCRIBE BRANCH ===
      if (!req.file) {
        return res.status(400).json({ success: false, message: "Video file required." });
      }
      // Save the uploaded video file
      const videoPath = path.join(jobTempDir, req.file.originalname);
      fs.writeFileSync(videoPath, req.file.buffer);
      console.log("Video saved to:", videoPath);

      // Extract audio from the video using FFmpeg
      const audioPath = path.join(jobTempDir, "extracted_audio.mp3");
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .noVideo()
          .audioCodec("libmp3lame")
          .save(audioPath)
          .on("end", () => {
            console.log("Audio extracted to:", audioPath);
            resolve(true);
          })
          .on("error", (err) => {
            console.error("Error extracting audio:", err);
            reject(err);
          });
      });

      // Read the extracted audio file into a buffer
      const audioBuffer = fs.readFileSync(audioPath);
      // Convert the audio buffer to a data URI so that it's a valid URL
      const audioDataUri = `data:audio/mp3;base64,${audioBuffer.toString("base64")}`;

      // Call whisperAudio with the data URI
      const transcriptionResult = await whisperAudio(audioDataUri);
      if (!transcriptionResult.success) {
        return res.status(500).json({ success: false, message: "Transcription failed." });
      }
      console.log("Transcribed text:", transcriptionResult.text);

      // Optionally, process transcriptionResult.words to form caption segments.
      return res.json({
        success: true,
        transcription: transcriptionResult.text,
        segments: transcriptionResult.words && transcriptionResult.words.length > 0
          ? transcriptionResult.words
          : [],
        message: "Transcription completed successfully."
      });
    } else if (action === "export") {
      // === EXPORT BRANCH ===
      if (!req.file) {
        return res.status(400).json({ success: false, message: "Video file required for export." });
      }
      let editedCaptions;
      try {
        editedCaptions = JSON.parse(req.body.editedCaptions);
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid editedCaptions JSON." });
      }
      // Retrieve additional styling and title parameters.
      const { projectTitle, selectedFont, selectedColor, fontSize } = req.body;
      console.log("Exporting video with project title:", projectTitle);

      // Save the uploaded video file for export.
      const videoPath = path.join(jobTempDir, req.file.originalname);
      fs.writeFileSync(videoPath, req.file.buffer);
      console.log("Export video saved to:", videoPath);

      // Generate an ASS subtitle file from the edited captions.
      const assContent = generateAssFromCaptions(editedCaptions, { selectedFont, selectedColor, fontSize, projectTitle });
      const assPath = path.join(jobTempDir, "subtitles.ass");
      fs.writeFileSync(assPath, assContent, "utf8");
      console.log("ASS subtitle file created at:", assPath);

      // Merge the subtitles into the video using FFmpeg.
      const finalVideoPath = path.join(jobTempDir, "output_video.mp4");
      // Use FFmpeg's subtitles filter.
      const fontsDir = path.resolve(process.cwd(), "fonts"); // Adjust as needed.
      const formattedAssPath = assPath.replace(/\\/g, "/").replace(/^([A-Z]):/, "$1\\:");
      const formattedFontsDir = fontsDir.replace(/\\/g, "/").replace(/^([A-Z]):/, "$1\\:");
      const subtitlesFilter = `subtitles='${formattedAssPath}:fontsdir=${formattedFontsDir}'`;
      const vfFilter = `fps=30,${subtitlesFilter}`;

      await new Promise((resolve, reject) => {
        let stderr = "";
        ffmpeg()
          .input(videoPath)
          .audioCodec("copy")
          .videoCodec("libx264")
          .outputOptions([
            "-vf", vfFilter,
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
      console.log("Final video with captions created at:", finalVideoPath);

      // Upload final video using your uploadVideoFile utility.
      const videoFileObj = {
        buffer: fs.readFileSync(finalVideoPath),
        originalname: "output_video.mp4",
        mimetype: "video/mp4",
      };
      const uploadResult = await uploadVideoFile(videoFileObj);
      console.log("Uploaded final video. URL:", uploadResult.publicUrl);

      return res.json({
        success: true,
        message: "Video exported and uploaded successfully.",
        data: { videoUrl: uploadResult.publicUrl }
      });
    } else {
      return res.status(400).json({ success: false, message: "Invalid action specified." });
    }
  } catch (err) {
    console.error("Error in VideoCaptionController:", err);
    return res.status(500).json({ success: false, message: `Error: ${err.message}` });
  } finally {
    // Clean up temporary directories.
    if (fs.existsSync(jobTempDir)) {
      fs.rmSync(jobTempDir, { recursive: true, force: true });
      console.log("Job temporary files removed.");
    }
  }
};
