// routes/textToSpeechRoute.js
import express from "express";
import multer from "multer";
import { generateSpeechController, uploadVoiceController } from "../controllers/textToSpeechController.js";

// Use multer with memory storage.
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Endpoint to generate speech.
// If a cloned voice file (e.g. from a mic recording) is provided, it should be sent with the field name "clonedVoiceFile".
router.post("/", upload.single("clonedVoiceFile"), generateSpeechController);

// Endpoint to upload a voice sample for saving (file field name "file").
router.post("/uploadVoice", upload.single("file"), uploadVoiceController);

export default router;
