// routes/textToSpeechRoute.js
import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import {
    UrlToVideoController,
} from "../controllers/urlToVideoController.js";


const router = express.Router();

// Existing routes
router.post("/", UrlToVideoController);

export default router;
