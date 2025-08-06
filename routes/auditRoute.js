import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAuditLogs
} from '../controllers/AuditController.js';

const router = express.Router();

// Audit routes - all require authentication
router.get('/logs', requireAuth, getAuditLogs);                    // Get audit logs for user's clinic

export default router; 