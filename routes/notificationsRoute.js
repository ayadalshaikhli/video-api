import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getNotifications,
    markNotificationRead,
    getAppointmentReminders,
    createAppointmentReminder,
    markAllNotificationsAsRead,
    deleteNotification,
    getNotificationCount
} from '../controllers/NotificationsController.js';

const router = express.Router();

// All routes use auth context - clinic ID comes from authenticated user
router.get('/', requireAuth, getNotifications);              // Gets notifications from user's clinic
router.get('/count', requireAuth, getNotificationCount);     // Gets unread notification count
router.put('/:notificationId/read', requireAuth, markNotificationRead); // Marks notification as read (if owned by user's clinic)
router.get('/reminders', requireAuth, getAppointmentReminders); // Gets appointment reminders from user's clinic
router.post('/reminders', requireAuth, createAppointmentReminder); // Creates appointment reminder in user's clinic
router.post('/read-all', requireAuth, markAllNotificationsAsRead); // Marks all notifications as read for user's clinic
router.delete('/:notificationId', requireAuth, deleteNotification); // Deletes notification (if owned by user's clinic)

export default router; 