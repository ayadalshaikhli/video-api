import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getDashboardStats,
    getDashboardData
} from '../controllers/DashboardController.js';

const router = express.Router();

// All dashboard routes use auth context - clinic ID comes from authenticated user
router.get('/stats', requireAuth, getDashboardStats);    // Gets dashboard stats from user's clinic
router.get('/', requireAuth, getDashboardData);          // Gets dashboard data from user's clinic

export default router; 