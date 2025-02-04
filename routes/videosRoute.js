// routes/videos.js
import express from "express";
import { streamVideo } from "../controllers/videoController.js";

const router = express.Router();

// Route to stream a video, e.g., GET /videos/sample.mp4
router.get("/:videoName", streamVideo);

export default router;
