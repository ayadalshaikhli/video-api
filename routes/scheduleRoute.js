import express from 'express';
import ScheduleController from '../controllers/ScheduleController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Shift Types Routes
router.get('/shift-types', ScheduleController.getShiftTypes);
router.post('/shift-types', ScheduleController.createShiftType);
router.put('/shift-types/:id', ScheduleController.updateShiftType);
router.delete('/shift-types/:id', ScheduleController.deleteShiftType);

// Staff Schedules Routes
router.get('/staff-schedules', ScheduleController.getStaffSchedules);
router.post('/staff-schedules', ScheduleController.createStaffSchedule);
router.put('/staff-schedules/:id', ScheduleController.updateStaffSchedule);
router.delete('/staff-schedules/:id', ScheduleController.deleteStaffSchedule);

// Time Off Routes
router.get('/time-off', ScheduleController.getTimeOffRequests);
router.post('/time-off', ScheduleController.createTimeOffRequest);
router.put('/time-off/:id', ScheduleController.updateTimeOffRequest);

// Schedule Overrides Routes
router.get('/overrides', ScheduleController.getScheduleOverrides);
router.post('/overrides', ScheduleController.createScheduleOverride);

export default router; 