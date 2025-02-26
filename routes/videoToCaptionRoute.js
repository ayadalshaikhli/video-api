// routes/videoToCaptionRoute.js
import express from "express";
import multer from "multer";
import { VideoCaptionController } from "../controllers/videoToCaptionController.js";

const router = express.Router();
const upload = multer(); // Using memory storage; adjust as needed

// This route handles both transcription and export depending on the action.
router.post("/", upload.single("video"), VideoCaptionController);

export default router;
