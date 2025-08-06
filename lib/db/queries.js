// lib/db/queries.js
import { desc, and, eq, isNull, sql, like, or } from "drizzle-orm";
import { db } from "./drizzle.js";
import { users, profiles, patients, appointments, appointmentTypes, clinics, userRoles } from "./schema.js";
import { verifyToken } from "../auth/session.js";

/**
 * Extracts the user from the session cookie.
 * This version expects an Express request object, which must have been processed by cookie-parser.
 */
export async function getUser(req) {
  const sessionCookie = req.cookies.session;
  if (!sessionCookie) {
    return null;
  }

  let sessionData;
  try {
    sessionData = await verifyToken(sessionCookie);
  } catch (error) {
    console.error("Error verifying session token:", error);
    return null;
  }

  if (!sessionData || !sessionData.user || typeof sessionData.user.id !== "string") {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionData.user.id))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

/**
 * Get user with their profile information
 */
export async function getUserWithProfile(userId) {
  const result = await db
    .select({
      user: users,
      profile: profiles,
    })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

/**
 * Get all patients for a clinic
 */
export async function getPatients(clinicId, searchQuery = null, limit = 50, offset = 0) {
  let query = db
    .select()
    .from(patients)
    .where(eq(patients.clinicId, clinicId))
    .orderBy(desc(patients.createdAt))
    .limit(limit)
    .offset(offset);

  if (searchQuery) {
    const searchTerm = `%${searchQuery}%`;
    query = query.where(
      or(
        like(patients.firstName, searchTerm),
        like(patients.lastName, searchTerm),
        like(patients.email, searchTerm),
        like(patients.phone, searchTerm)
      )
    );
  }

  return await query;
}

/**
 * Get patient by ID with all related information
 */
export async function getPatientById(patientId) {
  const patient = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (patient.length === 0) {
    return null;
  }

  return patient[0];
}

/**
 * Get appointments for a clinic
 */
export async function getAppointments(clinicId, startDate = null, endDate = null, limit = 50, offset = 0) {
  let query = db
    .select({
      appointment: appointments,
      patient: patients,
      appointmentType: appointmentTypes,
    })
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(appointmentTypes, eq(appointments.appointmentTypeId, appointmentTypes.id))
    .where(eq(appointments.clinicId, clinicId))
    .orderBy(desc(appointments.startTime))
    .limit(limit)
    .offset(offset);

  if (startDate && endDate) {
    query = query.where(
      and(
        eq(appointments.clinicId, clinicId),
        sql`${appointments.startTime} >= ${startDate}`,
        sql`${appointments.startTime} <= ${endDate}`
      )
    );
  }

  return await query;
}

/**
 * Get appointments for a specific patient
 */
export async function getPatientAppointments(patientId, limit = 20, offset = 0) {
  return await db
    .select({
      appointment: appointments,
      appointmentType: appointmentTypes,
    })
    .from(appointments)
    .leftJoin(appointmentTypes, eq(appointments.appointmentTypeId, appointmentTypes.id))
    .where(eq(appointments.patientId, patientId))
    .orderBy(desc(appointments.startTime))
    .limit(limit)
    .offset(offset);
}

/**
 * Get clinic information by ID
 */
export async function getClinicById(clinicId) {
  const clinic = await db
    .select()
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  if (clinic.length === 0) {
    return null;
  }

  return clinic[0];
}

/**
 * Get user role in a clinic
 */
export async function getUserRole(userId, clinicId) {
  const role = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.clinicId, clinicId)))
    .limit(1);

  if (role.length === 0) {
    return null;
  }

  return role[0];
}

/**
 * Get appointment types for a clinic
 */
export async function getAppointmentTypes(clinicId) {
  return await db
    .select()
    .from(appointmentTypes)
    .where(eq(appointmentTypes.clinicId, clinicId))
    .orderBy(appointmentTypes.name);
}

/**
 * Check for appointment conflicts
 */
export async function checkAppointmentConflict(clinicId, doctorId, startTime, endTime, excludeAppointmentId = null) {
  let query = db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        sql`${appointments.startTime} < ${endTime}`,
        sql`${appointments.endTime} > ${startTime}`
      )
    );

  if (excludeAppointmentId) {
    query = query.where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        sql`${appointments.id} != ${excludeAppointmentId}`,
        sql`${appointments.startTime} < ${endTime}`,
        sql`${appointments.endTime} > ${startTime}`
      )
    );
  }

  const conflicts = await query;
  return conflicts.length > 0;
}