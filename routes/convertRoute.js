// routes/convertRoute.js

import express from "express";
import { convertYoutubeToMp3 } from "../controllers/convertController.js";

const router = express.Router();


router.get("/", convertYoutubeToMp3);

export default router;
