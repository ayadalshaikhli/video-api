import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getAnalytics
} from '../controllers/AnalyticsController.js';

const router = express.Router();

// All routes use auth context - clinic ID comes from authenticated user
router.get('/', requireAuth, getAnalytics);  // Gets analytics data from user's clinic

export default router; 