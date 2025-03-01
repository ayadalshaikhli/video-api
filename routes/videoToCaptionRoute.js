// routes/videoToCaptionRoute.js
import express from "express";
import multer from "multer";
import {
  VideoCaptionController,
  VideoSubmissionController,
  PythonSubmissionController
} from "../controllers/videoToCaptionController.js";

const router = express.Router();
const upload = multer(); // Using memory storage; adjust as needed

// Existing endpoints
router.post("/", upload.single("video"), VideoCaptionController);
router.post("/submition", upload.single("video"), VideoSubmissionController);

// New endpoint to forward submission to the Python endpoint
router.post("/python-submition", upload.single("video"), PythonSubmissionController);

export default router;
