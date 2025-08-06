import express from 'express';
import VisitsController from '../controllers/VisitsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET /visits - Get all visits with filters
router.get('/', VisitsController.getVisits);

// POST /visits - Create new visit
router.post('/', VisitsController.createVisit);

// GET /visits/:id - Get specific visit
router.get('/:id', VisitsController.getVisit);

// PUT /visits/:id - Update visit
router.put('/:id', VisitsController.updateVisit);

// PATCH /visits/:id - Patch visit (for status updates)
router.patch('/:id', VisitsController.patchVisit);

export default router; 