import express from 'express';
import {
    connectYouTubeController,
    youtubeCallbackController,
    uploadToYouTubeController,
    getYouTubeChannelsController,
    disconnectYouTubeController
} from '../controllers/youtubeController.js';

const router = express.Router();

// YouTube OAuth routes
router.get('/connect', connectYouTubeController);
router.get('/callback', youtubeCallbackController);

// YouTube channel management
router.get('/channels', getYouTubeChannelsController);
router.delete('/channels/:channelId', disconnectYouTubeController);

// YouTube upload
router.post('/upload', uploadToYouTubeController);

export default router;
