import express from "express";
import multer from "multer";
import {
  VideoCaptionController,
  VideoSubmissionController,
  PythonSubmissionController
} from "../controllers/videoToCaptionController.js";

const router = express.Router();
const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("Multer file filter - file:", file);
    console.log("File mimetype:", file.mimetype);
    console.log("File originalname:", file.originalname);
    
    // Accept video files or files from React Native (which often come as application/octet-stream)
    if (file.mimetype.startsWith('video/') || 
        file.mimetype === 'application/octet-stream' ||
        file.originalname.match(/\.(mp4|mov|avi|mkv|webm|flv|wmv)$/i)) {
      cb(null, true);
    } else {
      console.log("File rejected - not a video file");
      cb(new Error('Only video files are allowed'), false);
    }
  }
}); 

// Add logging middleware
router.use((req, res, next) => {
  console.log(`[VideoCaption Route] ${req.method} ${req.path}`);
  console.log("Headers:", req.headers);
  console.log("Raw body available:", !!req.body);
  console.log("Files available:", !!req.files);
  console.log("File available:", !!req.file);
  next();
});

// Add error handling middleware for multer
router.post("/", (req, res, next) => {
  console.log("[Multer] Starting file upload processing...");
  console.log("[Multer] Request content-type:", req.headers['content-type']);
  console.log("[Multer] Request content-length:", req.headers['content-length']);
  
  upload.single("video")(req, res, (err) => {
    if (err) {
      console.error("[Multer] Error occurred:", err);
      console.error("[Multer] Error type:", err.constructor.name);
      console.error("[Multer] Error code:", err.code);
      return res.status(400).json({ 
        success: false, 
        message: `File upload error: ${err.message}`,
        error: err.message 
      });
    }
    console.log("[Multer] File upload completed successfully");
    console.log("[Multer] File received:", !!req.file);
    console.log("[Multer] Body received:", Object.keys(req.body || {}));
    next();
  });
}, VideoCaptionController);
router.post("/submission", (req, res, next) => {
  upload.single("video")(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ 
        success: false, 
        message: `File upload error: ${err.message}`,
        error: err.message 
      });
    }
    next();
  });
}, VideoSubmissionController);

router.post("/python-submition", upload.single("video"), PythonSubmissionController);

export default router;
