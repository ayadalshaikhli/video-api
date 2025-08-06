import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getAppointments,
    getAppointment,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    completeAppointment,
    getDoctorSchedule,
    getAppointmentTypes,
    createAppointmentType,
    updateAppointmentType,
    deleteAppointmentType,
    getAppointmentType,
    updateOverdueAppointments
} from '../controllers/AppointmentsController.js';

const router = express.Router();

// All routes use auth context - clinic ID comes from authenticated user
router.get('/', requireAuth, getAppointments);                          // Gets appointments from user's clinic
router.get('/appointment-types', requireAuth, getAppointmentTypes);     // Gets appointment types from user's clinic
router.post('/appointment-types', requireAuth, createAppointmentType);  // Creates appointment type in user's clinic
router.get('/appointment-types/:appointmentTypeId', requireAuth, getAppointmentType);
router.put('/appointment-types/:appointmentTypeId', requireAuth, updateAppointmentType);
router.delete('/appointment-types/:appointmentTypeId', requireAuth, deleteAppointmentType);

// Doctor schedule (requires auth but uses doctorId from user's clinic)
router.get('/doctor/:doctorId/schedule', requireAuth, getDoctorSchedule);

// Individual appointment routes (clinic verification happens in controllers)
router.get('/:id', requireAuth, getAppointment);                        // Get specific appointment (if owned by user's clinic)
router.post('/', requireAuth, createAppointment);                       // Create appointment in user's clinic
router.put('/:id', requireAuth, updateAppointment);                     // Update appointment (if owned by user's clinic)
router.patch('/:id/cancel', requireAuth, cancelAppointment);            // Cancel appointment (if owned by user's clinic)
router.patch('/:id/complete', requireAuth, completeAppointment);        // Complete appointment (if owned by user's clinic)
router.post('/update-overdue', requireAuth, updateOverdueAppointments); // Auto-update overdue appointments

export default router; 