// controllers/convertController.js

import { spawn } from "child_process";

export const convertYoutubeToMp3 = async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) {
        return res.status(400).json({ error: "Missing videoUrl query parameter" });
    }

    // Set response headers to prompt download
    res.setHeader("Content-Disposition", 'attachment; filename="audio.mp3"');
    res.setHeader("Content-Type", "audio/mpeg");

    try {
        // Spawn the yt-dlp process:
        // - "-o", "-" tells yt-dlp to output to stdout.
        // - "--extract-audio" extracts only the audio.
        // - "--audio-format", "mp3" converts it to MP3.
        const ytDlp = spawn("yt-dlp", [
            videoUrl,
            "-o", "-", // Output to stdout
            "--extract-audio",
            "--audio-format", "mp3"
        ]);

        // Pipe the output stream directly to the response.
        ytDlp.stdout.pipe(res);

        // Log any errors from yt-dlp's stderr.
        ytDlp.stderr.on("data", (data) => {
            console.error("yt-dlp error:", data.toString());
        });

        // Listen for process exit and handle errors if necessary.
        ytDlp.on("close", (code) => {
            if (code !== 0) {
                console.error(`yt-dlp process exited with code ${code}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Conversion failed" });
                }
            }
        });
    } catch (error) {
        console.error("[Error]", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
