import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getDashboardStats,
    getDashboardData
} from '../controllers/DashboardController.js';
import { 
  getComprehensiveDashboard, 
  getRealTimeMetrics, 
  getTrendsData, 
  getRecentActivity 
} from '../controllers/EnhancedDashboardController.js';

const router = express.Router();

// All dashboard routes use auth context - clinic ID comes from authenticated user
router.get('/stats', requireAuth, getDashboardStats);    // Gets dashboard stats from user's clinic
router.get('/', requireAuth, getDashboardData);          // Gets dashboard data from user's clinic

// Enhanced dashboard routes
router.get('/comprehensive', requireAuth, getComprehensiveDashboard);
router.get('/real-time', requireAuth, getRealTimeMetrics);
router.get('/trends', requireAuth, getTrendsData);
router.get('/activity', requireAuth, getRecentActivity);

export default router; 