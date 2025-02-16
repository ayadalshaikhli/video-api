// routes/textToSpeechRoute.js
import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import {
    generateSpeechController,
    uploadVoiceController,
    convertYouTubeController
} from "../controllers/textToSpeechController.js";

// Use multer with memory storage and set a file size limit of 5MB.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB in bytes
});

const router = express.Router();

// Existing routes
router.post("/", upload.single("clonedVoiceFile"), generateSpeechController);
router.post("/uploadVoice", upload.single("file"), uploadVoiceController);

// NEW route: Convert a YouTube URL to MP3 (which triggers conversion and Cloudflare R2 upload)
router.post("/convertYouTube", convertYouTubeController);

export default router;
