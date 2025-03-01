// routes/videoToCaptionRoute.js
import express from "express";
import multer from "multer";
import { VideoCaptionController, VideoSubmissionController } from "../controllers/videoToCaptionController.js";

const router = express.Router();
const upload = multer(); // Using memory storage; adjust as needed

// Handle transcription/export at the base endpoint
router.post("/", upload.single("video"), VideoCaptionController);

// Handle final submission (with user modifications) at /submition
router.post("/submition", upload.single("video"), VideoSubmissionController);

export default router;
