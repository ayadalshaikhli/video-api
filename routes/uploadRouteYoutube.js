import express from "express";
import { uploadVideo, upload } from "../controllers/uploadYoutubeController.js";

const router = express.Router();

router.post("/", upload, uploadVideo);

export default router;
