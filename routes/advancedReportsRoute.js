import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getStaffPerformanceReport,
  getPatientAnalyticsReport,
  getFinancialDeepDiveReport,
  getOperationalEfficiencyReport,
  getActivityLogsReport,
  getSystemHealthReport
} from '../controllers/AdvancedReportsController.js';
import { addSampleData } from '../utils/sampleData.js';
import { createActivityTables } from '../lib/db/createActivityTables.js';

const router = express.Router();

// Simple admin-only guard
function adminOnly(req, res, next) {
  if (req?.userRole?.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin access required' });
}

// Staff Performance Reports
router.get('/staff-performance', requireAuth, getStaffPerformanceReport);

// Patient Analytics Reports
router.get('/patient-analytics', requireAuth, getPatientAnalyticsReport);

// Financial Deep Dive Reports
router.get('/financial-deep-dive', requireAuth, getFinancialDeepDiveReport);

// Operational Efficiency Reports
router.get('/operational-efficiency', requireAuth, getOperationalEfficiencyReport);

// Activity Logs Reports
router.get('/activity-logs', requireAuth, getActivityLogsReport);

// System Health Reports
router.get('/system-health', requireAuth, getSystemHealthReport);

// Test endpoint to add sample data
router.post('/add-sample-data', requireAuth, adminOnly, async (req, res) => {
  try {
    await addSampleData(req.userClinic.id);
    res.json({ message: 'Sample data added successfully' });
  } catch (error) {
    console.error('Error adding sample data:', error);
    res.status(500).json({ error: 'Failed to add sample data' });
  }
});

// Create activity tables endpoint
router.post('/create-tables', requireAuth, adminOnly, async (req, res) => {
  try {
    await createActivityTables();
    res.json({ message: 'Activity tables created successfully' });
  } catch (error) {
    console.error('Error creating tables:', error);
    res.status(500).json({ error: 'Failed to create tables' });
  }
});

export default router; 