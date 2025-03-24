import express from "express";
import multer from "multer";
import {
  VideoCaptionController,
  VideoSubmissionController,
  PythonSubmissionController
} from "../controllers/videoToCaptionController.js";

const router = express.Router();
const upload = multer(); 

router.post("/", upload.single("video"), VideoCaptionController);
router.post("/submition", upload.single("video"), VideoSubmissionController);

router.post("/python-submition", upload.single("video"), PythonSubmissionController);

export default router;
