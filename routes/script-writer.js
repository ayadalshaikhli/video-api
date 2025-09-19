import express from "express";
import { generateScript, enhanceScript } from "../controllers/scriptWriterController.js";

const router = express.Router();

// Generate new script
router.post("/generate", generateScript);

// Enhance existing script with additional context
router.post("/enhance", enhanceScript);

export default router;
