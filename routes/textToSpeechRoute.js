// routes/textToSpeechRoute.js
import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import {
    generateSpeechController,
    uploadVoiceController,
    convertYouTubeController,
    convertYoutubeAndTranscribeController,
    convert30SecYouTubeController
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

router.post("/convertYouTube", convertYouTubeController);
router.post("/convert30SecYoutube", convert30SecYouTubeController);
router.post("/convertYoutubeAndTranscribe", convertYoutubeAndTranscribeController);

export default router;
