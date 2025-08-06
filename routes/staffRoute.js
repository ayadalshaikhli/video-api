import express from 'express';
import StaffController from '../controllers/StaffController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Staff management routes
router.get('/', requireAuth, StaffController.getStaff);

// Invitation management routes (must come before /:id routes)
router.get('/invitations', requireAuth, StaffController.getInvitations);
router.delete('/invitations/:id', requireAuth, StaffController.deleteInvitation);

// Invitation code routes
router.post('/invite', requireAuth, StaffController.inviteStaff);
router.post('/invite/generate-code', requireAuth, StaffController.generateInvitationCode);
router.get('/invite/validate-code/:code', StaffController.validateInvitationCode);
router.post('/invite/use-code', StaffController.useInvitationCode);

// Staff member routes (must come after specific routes)
router.get('/:id', requireAuth, StaffController.getStaffMember);
router.post('/:id/approve', requireAuth, StaffController.approveStaff);
router.post('/:id/reject', requireAuth, StaffController.rejectStaff);
router.put('/:id/role', requireAuth, StaffController.updateStaffRole);
router.put('/:id/deactivate', requireAuth, StaffController.deactivateStaff);

// Staff schedule routes
router.get('/schedules', requireAuth, StaffController.getStaffSchedules);
router.get('/:id/schedule', requireAuth, StaffController.getStaffSchedule);
router.post('/:id/schedule', requireAuth, StaffController.createStaffSchedule);
router.put('/schedules/:scheduleId', requireAuth, StaffController.updateStaffSchedule);

// Time off routes
router.get('/time-off', requireAuth, StaffController.getTimeOffRequests);
router.post('/:id/time-off', requireAuth, StaffController.requestTimeOff);
router.put('/time-off/:timeOffId/approve', requireAuth, StaffController.approveTimeOff);
router.put('/time-off/:timeOffId/reject', requireAuth, StaffController.rejectTimeOff);

export default router; 