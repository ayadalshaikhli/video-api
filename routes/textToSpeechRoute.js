// routes/textToSpeechRoute.js
import express from "express";
import multer from "multer";
import { generateSpeechController, uploadVoiceController } from "../controllers/textToSpeechController.js";

// Use multer with memory storage and set a file size limit of 5MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB in bytes
});

const router = express.Router();

// Endpoint to generate speech.
// If a cloned voice file (e.g. from a mic recording) is provided, it should be sent with the field name "clonedVoiceFile".
router.post("/", upload.single("clonedVoiceFile"), generateSpeechController);

// Endpoint to upload a voice sample for saving (file field name "file").
router.post("/uploadVoice", upload.single("file"), uploadVoiceController);

export default router;
