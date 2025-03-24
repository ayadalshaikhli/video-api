// File: routes/audioRoute.js
import { Router } from "express";
import { fetchVoices, fetchUserAudios } from "../../controllers/app/audioController.js";

const router = Router();

// /api/audio/voices -> fetchVoices
router.get("/voices", fetchVoices);

// /api/audio/user-audios -> fetchUserAudios
router.get("/user-audios", fetchUserAudios);

export default router;
