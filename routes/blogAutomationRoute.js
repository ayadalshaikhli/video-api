import express from 'express';
import { 
  scheduleBlogAutomation,
  runManualBlogGeneration,
  getBlogGenerationStatus,
  updateScheduleSettings
} from '../controllers/blogAutomationController.js';

const router = express.Router();

// Schedule settings and status endpoints
router.post('/schedule', scheduleBlogAutomation);
router.get('/status', getBlogGenerationStatus);
router.put('/settings', updateScheduleSettings);

// Manual trigger for testing
router.post('/generate-now', runManualBlogGeneration);

export default router;