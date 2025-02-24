import express from "express";
import { generateVideoFromJob } from "../controllers/subtitleStylesController.js"; // Import the controller

const router = express.Router();

// Route for generating video from the job data
router.post("/generate-video", generateVideoFromJob);

export default router;
