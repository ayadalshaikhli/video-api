import { db } from '../lib/db/drizzle.js';
import { notifications, appointments, patients, userRoles } from '../lib/db/schema.js';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';

// Get notifications for the user's clinic
export async function getNotifications(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const userId = req.user.id;
    const { limit = 50, offset = 0, unreadOnly = false } = req.query;

    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.clinicId, clinicId))
      .orderBy(desc(notifications.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    if (unreadOnly === 'true') {
      query = query.where(eq(notifications.isRead, false));
    }

    const notificationsList = await query;

    res.json({ notifications: notificationsList });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
}

// Mark a notification as read
export async function markNotificationRead(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const { notificationId } = req.params;

    const result = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.clinicId, clinicId)
        )
      );

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(req, res) {
  try {
    const clinicId = req.userClinic.id;

    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.clinicId, clinicId),
          eq(notifications.isRead, false)
        )
      );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
}

// Delete a notification
export async function deleteNotification(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const { notificationId } = req.params;

    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.clinicId, clinicId)
        )
      );

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
}

// Get appointment reminders
export async function getAppointmentReminders(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const reminders = await db
      .select({
        id: appointments.id,
        patientName: patients.firstName + ' ' + patients.lastName,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        type: appointments.type
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          gte(appointments.startTime, targetDate),
          lte(appointments.startTime, nextDay),
          eq(appointments.status, 'scheduled')
        )
      )
      .orderBy(appointments.startTime);

    res.json({ reminders });
  } catch (error) {
    console.error('Error getting appointment reminders:', error);
    res.status(500).json({ error: 'Failed to get appointment reminders' });
  }
}

// Create appointment reminder
export async function createAppointmentReminder(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const { appointmentId, reminderTime, message } = req.body;

    // Verify appointment belongs to clinic
    const appointment = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.clinicId, clinicId)
        )
      )
      .limit(1);

    if (!appointment.length) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Create notification for the reminder
    const [notification] = await db
      .insert(notifications)
      .values({
        clinicId,
        type: 'appointment_reminder',
        title: 'Appointment Reminder',
        message: message || `Reminder for appointment at ${reminderTime}`,
        data: { appointmentId, reminderTime },
        isRead: false
      })
      .returning();

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error creating appointment reminder:', error);
    res.status(500).json({ error: 'Failed to create appointment reminder' });
  }
}

// Get notification count (unread)
export async function getNotificationCount(req, res) {
  try {
    const clinicId = req.userClinic.id;

    const result = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.clinicId, clinicId),
          eq(notifications.isRead, false)
        )
      );

    res.json({ count: result[0]?.count || 0 });
  } catch (error) {
    console.error('Error getting notification count:', error);
    res.status(500).json({ error: 'Failed to get notification count' });
  }
} 