// routes/audioTranscriptionRoute.js
import express from "express";
import multer from "multer";
import { AudioTranscriptionController } from "../controllers/audioTranscriptionController.js";

const router = express.Router();
const upload = multer(); // Using memory storage; adjust as needed

// Handle MP3 transcription and summarization at the base endpoint
router.post("/", upload.single("audio"), AudioTranscriptionController);

export default router;
