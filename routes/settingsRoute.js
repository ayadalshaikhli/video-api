import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getClinicSettings,
    updateClinicSettings,
    getUserPreferences,
    updateUserPreferences,
    getSystemSettings,
    updateSystemSettings,
    changePassword
} from '../controllers/SettingsController.js';

const router = express.Router();

// All routes use auth context - clinic ID comes from authenticated user
router.get('/clinic', requireAuth, getClinicSettings);         // Gets clinic settings from user's clinic
router.put('/clinic', requireAuth, updateClinicSettings);      // Updates clinic settings for user's clinic

// User Preferences routes (user ID from auth context)
router.get('/user/preferences', requireAuth, getUserPreferences);    // Gets preferences for authenticated user
router.put('/user/preferences', requireAuth, updateUserPreferences); // Updates preferences for authenticated user

// System Settings routes (clinic ID from auth context)
router.get('/system', requireAuth, getSystemSettings);         // Gets system settings from user's clinic
router.put('/system', requireAuth, updateSystemSettings);      // Updates system settings for user's clinic

// Password change route
router.put('/change-password', requireAuth, changePassword);   // Change user password

export default router; 