import express from "express";
import multer from "multer";
import { VideoShortsController } from "../controllers/videoShortsController.js";

const router = express.Router();
const upload = multer(); // Using memory storage; adjust as needed

// POST route to handle full video upload and processing
router.post("/", upload.single("video"), VideoShortsController);

export default router;
