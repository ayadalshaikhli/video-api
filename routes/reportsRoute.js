import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getReports,
    exportReport,
    testData
} from '../controllers/ReportsController.js';

const router = express.Router();

// All routes use auth context - clinic ID comes from authenticated user
router.get('/', requireAuth, getReports);        // Gets reports data from user's clinic
router.get('/export', requireAuth, exportReport); // Export report in various formats
router.get('/test', requireAuth, testData);      // Test endpoint to check all data

export default router; 