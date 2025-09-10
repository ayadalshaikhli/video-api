import express from 'express';
import { 
  generateTextToImage, 
  getAvailableModels, 
  getUserTextToImageHistory, 
  deleteTextToImage 
} from '../controllers/textToImageController.js';

const router = express.Router();

// Generate text-to-image
router.post('/generate', generateTextToImage);

// Get available models
router.get('/models', getAvailableModels);

// Get user's text-to-image history
router.get('/history', getUserTextToImageHistory);

// Delete a text-to-image
router.delete('/:id', deleteTextToImage);

export default router;
