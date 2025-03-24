import express from "express";
import multer from "multer";
import { VideoShortsController } from "../controllers/videoShortsController.js";

const router = express.Router();
const upload = multer(); 

router.post("/", upload.single("video"), VideoShortsController);

export default router;
