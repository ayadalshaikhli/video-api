import express from "express";
import multer from "multer";
import {
  uploadController,
  step1Controller,
  step2Controller,
  step3Controller,
  step4Controller,
} from "../../controllers/app/videoController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize:25*1024*1024 } });
    
router.post("/upload", upload.single("file"), uploadController);
router.post("/step1", step1Controller);
router.post("/step2", step2Controller);
router.post("/step3", step3Controller);
router.post("/step4", step4Controller);

export default router;
