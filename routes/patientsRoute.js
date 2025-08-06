import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getPatients,
    getPatient,
    createPatient,
    updatePatient,
    deletePatient,
    searchPatients
} from '../controllers/PatientsController.js';

const router = express.Router();

// All routes use auth context - clinic ID comes from authenticated user
router.get('/', requireAuth, getPatients);                    // Gets patients from user's clinic
router.get('/search', requireAuth, searchPatients);           // Search patients in user's clinic
router.get('/:id', requireAuth, getPatient);                  // Get specific patient (if owned by user's clinic)
router.post('/', requireAuth, createPatient);                 // Create patient in user's clinic
router.put('/:id', requireAuth, updatePatient);               // Update patient (if owned by user's clinic)
router.delete('/:id', requireAuth, deletePatient);            // Delete patient (if owned by user's clinic)

export default router; 