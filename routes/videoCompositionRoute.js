import express from "express";
import { 
  createVideoComposition, 
  createVideoCompositionAsync,
  getVideoComposition, 
  renderFinalVideo,
  getVideoCompositionStatus,
  getUserVideos,
  debugDatabase
} from "../controllers/videoCompositionController.js";

const router = express.Router();

// Create a new video composition
router.post("/create", createVideoComposition);

// Create a new video composition with async processing
router.post("/create-async", (req, res) => {
  // Get io instance from app locals (we'll set this in index.js)
  const io = req.app.locals.io;
  createVideoCompositionAsync(req, res, io);
});

// Get video composition by ID
router.get("/get/:id", getVideoComposition);

// Render final video with customizations
router.post("/render-final/:id", renderFinalVideo);

// Get video composition status
router.get("/status/:id", getVideoCompositionStatus);

// Get user's videos
router.get("/user", getUserVideos);

// Debug endpoint
router.get("/debug", debugDatabase);

export default router;