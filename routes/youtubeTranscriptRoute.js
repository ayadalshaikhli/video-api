// routes/youtubeTranscriptRoute.js
import express from "express";
import { YouTubeTranscriptController } from "../controllers/youtubeTranscriptController.js";

const router = express.Router();

// POST /api/youtube-transcript - Extract transcript from YouTube video
router.post("/", YouTubeTranscriptController);

export default router;
