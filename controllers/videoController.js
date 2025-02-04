// controllers/videoController.js
import fs from "fs";
import path from "path";

export const streamVideo = (req, res) => {
  console.log("Streaming video...");
  const videoName = req.params.videoName;
  // Construct the absolute path to the video inside the "videos" folder
  const videoPath = path.join(process.cwd(), "videos", videoName);

  // Check if the video file exists
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send("Video not found");
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Parse the Range header (e.g., "bytes=32324-")
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    // Create a stream for the specified chunk of the video
    const fileStream = fs.createReadStream(videoPath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4" // change if using a different format
    });
    fileStream.pipe(res);
  } else {
    // No Range header present, stream the entire video
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4"
    });
    fs.createReadStream(videoPath).pipe(res);
  }
};
