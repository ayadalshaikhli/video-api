import express from "express";
import { 
  createVideoComposition, 
  createVideoCompositionAsync,
  getVideoComposition, 
  renderFinalVideo,
  getVideoCompositionStatus,
  getUserVideos,
  debugDatabase,
  updateComposition,
  addSegment,
  updateSegmentCaption,
  verifyCaptionMatching,
  getCompositionById,
  updateCaptionsWithPreciseTiming
} from "../controllers/videoCompositionController.js";
import { getUserFromSession } from "../utils/session.js";

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

// Update video composition
router.put("/update/:id", updateComposition);

// Add new segment with TTS generation
router.post("/add-segment/:id", (req, res) => {
  req.io = req.app.locals.io;
  addSegment(req, res);
});

// Update individual segment caption
router.put("/update-segment-caption/:id", updateSegmentCaption);

// Render final video with customizations
router.post("/render-final/:id", renderFinalVideo);

// Get video composition status
router.get("/status/:id", getVideoCompositionStatus);

// Get user's videos
router.get("/user", getUserVideos);

// Debug endpoint
router.get("/debug", debugDatabase);

// Verify caption matching for a composition
router.post("/verify-caption-matching/:id", async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ 
        error: 'Not authenticated' 
      });
    }

    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Composition ID is required' });
    }

    // Get the composition
    const composition = await getCompositionById(id);
    
    if (!composition) {
      return res.status(404).json({ error: 'Composition not found' });
    }

    if (!composition.musicUrl || !composition.script) {
      return res.status(400).json({ 
        error: 'Composition must have audio and script for verification' 
      });
    }

    console.log('🎬 [Manual Verification] Starting verification for composition:', id);

    // Perform caption matching verification
    const verificationResult = await verifyCaptionMatching(
      composition.musicUrl,
      composition.script,
      composition.captions || []
    );

    res.json({
      success: true,
      verification: verificationResult,
      composition: {
        id: composition.id,
        script: composition.script,
        audioUrl: composition.musicUrl,
        existingCaptionsCount: composition.captions?.length || 0
      }
    });

  } catch (error) {
    console.error('Error verifying caption matching:', error);
    res.status(500).json({ 
      error: 'Failed to verify caption matching',
      details: error.message 
    });
  }
});

// Update captions with precise word-level timing
router.post("/update-captions/:id", updateCaptionsWithPreciseTiming);

export default router;