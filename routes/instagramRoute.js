import express from "express";
import multer from "multer";
import { uploadMediaToInstagram, uploadCarouselToInstagram } from "../controllers/instagramController.js";

const router = express.Router();

// Multer storage for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");  // Ensure uploads/ folder exists
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});
const upload = multer({ storage });

// 📌 Route for Posting Image or Video
router.post("/upload", upload.single("file"), uploadMediaToInstagram);

// 📌 Route for Posting Carousel
router.post("/carousel", upload.array("files", 10), uploadCarouselToInstagram);

export default router;
