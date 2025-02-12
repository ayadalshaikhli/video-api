// routes/uploadRoute.js
import express from "express";
import multer from "multer";
import uploadController from "../controllers/uploadController.js";

const router = express.Router();

// Configure Multer to use memory storage with a 25 MB file size limit
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// The field name must match the one from the client (e.g., "file")
router.post("/", upload.single("file"), async (req, res, next) => {
  console.log("[UploadRoute] POST /api/upload - Received request");

  if (req.file) {
    console.log(
      `[UploadRoute] Received file: ${req.file.originalname} (Size: ${req.file.size} bytes)`
    );
  } else {
    console.warn("[UploadRoute] No file received in the request!");
  }

  // Call the uploadController and log the result or error
  try {
    const result = await uploadController(req, res);
  } catch (error) {
    console.error("[UploadRoute] uploadController encountered an error:", error);
    next(error);
  }
});

export default router;
