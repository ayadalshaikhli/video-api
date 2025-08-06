import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from '../controllers/DepartmentsController.js';

const router = express.Router();

// Department routes - all require authentication
router.get('/', requireAuth, getDepartments);                    // Get all departments for user's clinic
router.post('/', requireAuth, createDepartment);                 // Create new department
router.put('/:id', requireAuth, updateDepartment);               // Update department
router.delete('/:id', requireAuth, deleteDepartment);            // Delete department

export default router; 