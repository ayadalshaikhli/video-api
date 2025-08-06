import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getClinicDetails,
  updateClinic
} from '../controllers/ClinicsController.js';

const router = express.Router();

// Clinic routes - all require authentication
router.get('/', requireAuth, getClinicDetails);           // Get clinic details for authenticated user
router.put('/', requireAuth, updateClinic);               // Update clinic for authenticated user

export default router; 