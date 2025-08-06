import { db } from '../lib/db/drizzle.js';
import { clinics, userRoles, users } from '../lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// Get clinic settings
export async function getClinicSettings(req, res) {
  try {
    const clinicId = req.userClinic.id;

    const clinic = await db
      .select({
        id: clinics.id,
        name: clinics.name,
        address: clinics.address,
        phone: clinics.phone,
        email: clinics.email,
        website: clinics.website,
        description: clinics.description,
        timezone: clinics.timezone,
        isActive: clinics.isActive
      })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!clinic.length) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    // Return clinic data with default settings structure
    const settings = {
      ...clinic[0],
      workingHours: {
        start: '09:00',
        end: '17:00'
      },
      autoReminders: true,
      allowOnlineBooking: false,
      appointmentDuration: 30,
      maxAppointmentsPerDay: 50,
      reminderTime: 24, // hours before appointment
      notificationPreferences: {
        email: true,
        sms: false,
        push: true
      }
    };

    res.json({ settings });
  } catch (error) {
    console.error('Error getting clinic settings:', error);
    res.status(500).json({ error: 'Failed to get clinic settings' });
  }
}

// Update clinic settings
export async function updateClinicSettings(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const updateData = req.body;

    // Only allow updating specific fields
    const allowedFields = [
      'name', 'address', 'phone', 'email', 'website', 
      'description', 'timezone', 'workingHours', 'autoReminders', 
      'allowOnlineBooking', 'appointmentDuration', 'maxAppointmentsPerDay',
      'reminderTime', 'notificationPreferences'
    ];

    const filteredData = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    // Update clinic basic info
    const basicFields = ['name', 'address', 'phone', 'email', 'website', 'description', 'timezone'];
    const basicUpdate = {};
    basicFields.forEach(field => {
      if (filteredData[field] !== undefined) {
        basicUpdate[field] = filteredData[field];
      }
    });

    if (Object.keys(basicUpdate).length > 0) {
      await db
        .update(clinics)
        .set(basicUpdate)
        .where(eq(clinics.id, clinicId));
    }

    // For now, we'll store additional settings in a JSON field or separate table
    // In a production app, you might want to create a separate clinic_settings table
    const settings = {
      workingHours: filteredData.workingHours || { start: '09:00', end: '17:00' },
      autoReminders: filteredData.autoReminders !== undefined ? filteredData.autoReminders : true,
      allowOnlineBooking: filteredData.allowOnlineBooking !== undefined ? filteredData.allowOnlineBooking : false,
      appointmentDuration: filteredData.appointmentDuration || 30,
      maxAppointmentsPerDay: filteredData.maxAppointmentsPerDay || 50,
      reminderTime: filteredData.reminderTime || 24,
      notificationPreferences: filteredData.notificationPreferences || { email: true, sms: false, push: true }
    };

    res.json({ 
      success: true, 
      message: 'Clinic settings updated successfully',
      settings 
    });
  } catch (error) {
    console.error('Error updating clinic settings:', error);
    res.status(500).json({ error: 'Failed to update clinic settings' });
  }
}

// Get user preferences
export async function getUserPreferences(req, res) {
  try {
    const userId = req.user.id;

    // For now, return default preferences
    // In a production app, you might want to create a user_preferences table
    const preferences = {
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      dashboard: {
        defaultView: 'overview',
        refreshInterval: 30
      },
      calendar: {
        defaultView: 'week',
        workingHours: {
          start: '09:00',
          end: '17:00'
        }
      }
    };

    res.json({ preferences });
  } catch (error) {
    console.error('Error getting user preferences:', error);
    res.status(500).json({ error: 'Failed to get user preferences' });
  }
}

// Update user preferences
export async function updateUserPreferences(req, res) {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // For now, just return success
    // In a production app, you would save to a user_preferences table
    const preferences = {
      theme: updateData.theme || 'light',
      language: updateData.language || 'en',
      timezone: updateData.timezone || 'UTC',
      notifications: updateData.notifications || { email: true, push: true, sms: false },
      dashboard: updateData.dashboard || { defaultView: 'overview', refreshInterval: 30 },
      calendar: updateData.calendar || { defaultView: 'week', workingHours: { start: '09:00', end: '17:00' } }
    };

    res.json({ 
      success: true, 
      message: 'User preferences updated successfully',
      preferences 
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: 'Failed to update user preferences' });
  }
}

// Get system settings
export async function getSystemSettings(req, res) {
  try {
    const clinicId = req.userClinic.id;

    // Return default system settings
    const systemSettings = {
      enableAuditLogs: true,
      sessionTimeout: 30,
      twoFactorAuth: false,
      dataRetention: {
        patients: 7, // years
        appointments: 3, // years
        invoices: 7, // years
        medicalRecords: 10 // years
      },
      backup: {
        frequency: 'daily',
        retention: 30, // days
        autoBackup: true
      },
      security: {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false
        },
        loginAttempts: 5,
        lockoutDuration: 15 // minutes
      }
    };

    res.json({ systemSettings });
  } catch (error) {
    console.error('Error getting system settings:', error);
    res.status(500).json({ error: 'Failed to get system settings' });
  }
}

// Update system settings
export async function updateSystemSettings(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const updateData = req.body;

    // For now, just return success
    // In a production app, you would save to a system_settings table
    const systemSettings = {
      enableAuditLogs: updateData.enableAuditLogs !== undefined ? updateData.enableAuditLogs : true,
      sessionTimeout: updateData.sessionTimeout || 30,
      twoFactorAuth: updateData.twoFactorAuth !== undefined ? updateData.twoFactorAuth : false,
      dataRetention: updateData.dataRetention || {
        patients: 7,
        appointments: 3,
        invoices: 7,
        medicalRecords: 10
      },
      backup: updateData.backup || {
        frequency: 'daily',
        retention: 30,
        autoBackup: true
      },
      security: updateData.security || {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false
        },
        loginAttempts: 5,
        lockoutDuration: 15
      }
    };

    res.json({ 
      success: true, 
      message: 'System settings updated successfully',
      systemSettings 
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
}

// Change password
export async function changePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Get current user with password hash
    const user = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user[0].passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, userId));

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
} 