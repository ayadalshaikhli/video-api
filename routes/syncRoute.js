// routes/syncRoute.js
import express from "express";
import { syncProjects } from "../controllers/syncController.js";

const router = express.Router();

// You can use POST (or GET) for syncing; POST is more appropriate for operations that change data.
router.post("/sync", async (req, res) => {
    try {
        const result = await syncProjects();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: "Failed to sync projects" });
    }
});

export default router;
