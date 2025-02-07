// routes/generate.js
import express from "express";
import multer from "multer";
import { generateProject } from "../controllers/generateController.js";
import { apiKeyAuth } from "../middleware/apiKeyAuth.js";

const router = express.Router();
const upload = multer(); // use memory storage (or configure disk storage if needed)

router.post("/", apiKeyAuth, upload.single("file"), generateProject);

export default router;
