import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { getAssStyleInfoFromCaptionId } from "../utils/subtitleUtiles.js"; // Assuming this utility is imported correctly

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); // Fix for __dirname in ES Modules

export const generateVideoFromJob = async (req, res) => {
  try {
    const { jobId, captionId } = req.body;

    // Define the directory for temporary files and job-specific data
    const baseTempDir = path.join(__dirname, "../temp_video");
    const jobTempDir = path.join(baseTempDir, `job-${jobId}`);

    // Paths to the necessary files (slideshow, speech audio, subtitles)
    const slideshowPath = path.join(jobTempDir, "slideshow.mp4");
    const speechAudioPath = path.join(jobTempDir, "speech_audio.mp3");
    const subtitlesPath = path.join(jobTempDir, "subtitles.ass");

    // Check if all the necessary files exist
    if (!fs.existsSync(slideshowPath) || !fs.existsSync(speechAudioPath) || !fs.existsSync(subtitlesPath)) {
      return res.status(400).json({ success: false, message: "One or more files are missing." });
    }

    // Get subtitle style information based on captionId
    const styleInfo = getAssStyleInfoFromCaptionId(captionId);

    // Final video path to save the output
    const finalVideoPath = path.join(jobTempDir, "final_output_video.mp4");
    const fontsDir = path.resolve(__dirname, "../fonts");

    // Correct path formatting for FFmpeg (on Windows, paths must be formatted correctly)
    const formattedAssPath = subtitlesPath.replace(/\\/g, "/").replace(/^([A-Z]):/, "$1\\:");
    const formattedFontsDir = fontsDir.replace(/\\/g, "/").replace(/^([A-Z]):/, "$1\\:");
    
    const subtitlesFilter = `subtitles='${formattedAssPath}:fontsdir=${formattedFontsDir}'`;
    const vfFilter = `fps=30,${subtitlesFilter}`;

    // Merge slideshow, speech audio, and subtitles using FFmpeg
    await new Promise((resolve, reject) => {
      let stderr = "";
      ffmpeg()
        .input(slideshowPath)
        .input(speechAudioPath)
        .audioCodec("aac")
        .videoCodec("libx264")
        .outputOptions([
          "-vf", vfFilter,         // Apply subtitle filter
          "-t", "00:00:30",        // Duration of the video, adjust if necessary
          "-y",                    // Overwrite output video if it exists
          "-loglevel", "verbose",   // Verbose logging
        ])
        .on("stderr", (line) => (stderr += line + "\n"))
        .on("error", (err) => reject(new Error(`Merge error:\n${stderr}\n${err.message}`)))
        .on("end", () => resolve(true))
        .save(finalVideoPath);     // Save the final video
    });

    // Return the generated video URL (or send the video file to the client)
    return res.json({
      success: true,
      message: "Video generated successfully!",
      data: { videoUrl: `/videos/${path.basename(finalVideoPath)}` },
    });
  } catch (err) {
    console.error("Error in generating video:", err);
    return res.status(500).json({ success: false, message: `Error: ${err.message}` });
  }
};
