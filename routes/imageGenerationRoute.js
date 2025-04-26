import express from 'express';
import { generateImage, getUserImages, deleteImage } from '../controllers/imageGenerationController.js';
const router = express.Router();

// Generate an image from text prompt
router.post('/generate', generateImage);

// Get all images for a user
router.get('/user-images', getUserImages);

// Delete an image
router.delete('/:id', deleteImage);

export default router;
