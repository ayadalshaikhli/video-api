import { db } from '../lib/db/drizzle.js';
import { visits, patients, profiles, appointmentTypes, appointments } from '../lib/db/schema.js';
import { eq, and, gte, lte, desc, asc, like, or, sql, inArray } from 'drizzle-orm';

class VisitsController {
    // Get all visits with filters
    static async getVisits(req, res) {
        try {
            const clinicId = req.userClinic.id;
            const { 
                origin, 
                status, 
                from, 
                to, 
                page = 1, 
                limit = 10,
                search,
                providerId 
            } = req.query;

            const offset = (page - 1) * limit;
            
            // Build where conditions
            let whereConditions = [eq(visits.clinicId, clinicId)];
            
            if (origin) {
                whereConditions.push(eq(visits.origin, origin));
            }
            
            if (status) {
                if (status.includes(',')) {
                    // Handle comma-separated statuses (e.g., 'checked_in,in_progress')
                    const statusArray = status.split(',');
                    whereConditions.push(inArray(visits.status, statusArray));
                } else {
                    // Handle single status
                    whereConditions.push(eq(visits.status, status));
                }
            }
            
            if (from) {
                whereConditions.push(gte(visits.visitDate, new Date(from)));
            }
            
            if (to) {
                whereConditions.push(lte(visits.visitDate, new Date(to)));
            }
            
            if (providerId) {
                whereConditions.push(eq(visits.providerId, providerId));
            }

            // Add search functionality
            if (search) {
                whereConditions.push(
                    or(
                        like(patients.firstName, `%${search}%`),
                        like(patients.lastName, `%${search}%`),
                        like(visits.chiefComplaint, `%${search}%`)
                    )
                );
            }

            // Get visits with patient and provider info
            const visitsData = await db
                .select({
                    id: visits.id,
                    patientId: visits.patientId,
                    clinicId: visits.clinicId,
                    appointmentId: visits.appointmentId,
                    providerId: visits.providerId,
                    visitDate: visits.visitDate,
                    visitType: visits.visitType,
                    chiefComplaint: visits.chiefComplaint,
                    visitNotes: visits.visitNotes,
                    origin: visits.origin,
                    status: visits.status,
                    scheduledStart: visits.scheduledStart,
                    createdAt: visits.createdAt,
                    updatedAt: visits.updatedAt,
                    patient: {
                        id: patients.id,
                        firstName: patients.firstName,
                        lastName: patients.lastName,
                        email: patients.email,
                        phone: patients.phone,
                        dateOfBirth: patients.dateOfBirth,
                        gender: patients.gender
                    },
                    provider: {
                        id: profiles.id,
                        firstName: profiles.firstName,
                        lastName: profiles.lastName,
                        email: profiles.email
                    }
                })
                .from(visits)
                .leftJoin(patients, eq(visits.patientId, patients.id))
                .leftJoin(profiles, eq(visits.providerId, profiles.id))
                .where(and(...whereConditions))
                .orderBy(desc(visits.visitDate))
                .limit(limit)
                .offset(offset);

            // Get total count for pagination
            const totalCount = await db
                .select({ count: sql`count(*)` })
                .from(visits)
                .leftJoin(patients, eq(visits.patientId, patients.id))
                .where(and(...whereConditions))
                .then(result => parseInt(result[0].count));

            res.json({
                visits: visitsData,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                }
            });
        } catch (error) {
            console.error('Error getting visits:', error);
            res.status(500).json({ error: 'Failed to get visits' });
        }
    }

    // Get specific visit
    static async getVisit(req, res) {
        try {
            const { id } = req.params;
            const clinicId = req.userClinic.id;

            const visit = await db
                .select({
                    id: visits.id,
                    patientId: visits.patientId,
                    clinicId: visits.clinicId,
                    appointmentId: visits.appointmentId,
                    providerId: visits.providerId,
                    visitDate: visits.visitDate,
                    visitType: visits.visitType,
                    chiefComplaint: visits.chiefComplaint,
                    visitNotes: visits.visitNotes,
                    diagnosis: visits.diagnosis,
                    treatmentPlan: visits.treatmentPlan,
                    followUpInstructions: visits.followUpInstructions,
                    followUpDate: visits.followUpDate,
                    clinicalFindings: visits.clinicalFindings,
                    soapNotes: visits.soapNotes,
                    origin: visits.origin,
                    status: visits.status,
                    scheduledStart: visits.scheduledStart,
                    createdAt: visits.createdAt,
                    updatedAt: visits.updatedAt,
                    patient: {
                        id: patients.id,
                        firstName: patients.firstName,
                        lastName: patients.lastName,
                        email: patients.email,
                        phone: patients.phone,
                        dateOfBirth: patients.dateOfBirth,
                        gender: patients.gender,
                        allergies: patients.allergies,
                        medicalConditions: patients.medicalConditions
                    },
                    provider: {
                        id: profiles.id,
                        firstName: profiles.firstName,
                        lastName: profiles.lastName,
                        email: profiles.email
                    }
                })
                .from(visits)
                .leftJoin(patients, eq(visits.patientId, patients.id))
                .leftJoin(profiles, eq(visits.providerId, profiles.id))
                .where(and(
                    eq(visits.id, id),
                    eq(visits.clinicId, clinicId)
                ))
                .limit(1);

            if (!visit.length) {
                return res.status(404).json({ error: 'Visit not found' });
            }

            res.json({ visit: visit[0] });
        } catch (error) {
            console.error('Error getting visit:', error);
            res.status(500).json({ error: 'Failed to get visit' });
        }
    }

    // Create new visit
    static async createVisit(req, res) {
        try {
            const clinicId = req.userClinic.id;
            const userId = req.user.id;
            const {
                patientId,
                providerId,
                visitDate,
                visitType,
                chiefComplaint,
                origin = 'scheduled',
                status = 'scheduled',
                scheduledStart,
                appointmentId
            } = req.body;

            // Validate required fields
            if (!patientId || !providerId || !visitDate || !visitType) {
                return res.status(400).json({ 
                    error: 'Patient ID, provider ID, visit date, and visit type are required' 
                });
            }

            // Check for conflicts if it's a scheduled visit
            if (origin === 'scheduled' && scheduledStart) {
                const scheduledStartDate = new Date(scheduledStart);
                
                // Get the appointment type to determine duration
                const appointmentType = await db
                    .select()
                    .from(appointmentTypes)
                    .where(and(
                        eq(appointmentTypes.clinicId, clinicId),
                        eq(appointmentTypes.name, visitType)
                    ))
                    .limit(1);

                const durationMinutes = appointmentType.length > 0 ? appointmentType[0].durationMinutes : 30;
                const visitEndTime = new Date(scheduledStartDate.getTime() + durationMinutes * 60000);

                // Check for overlapping visits
                const conflictCheck = await db
                    .select({
                        id: visits.id,
                        scheduledStart: visits.scheduledStart,
                        visitType: visits.visitType,
                        patient: {
                            firstName: patients.firstName,
                            lastName: patients.lastName
                        }
                    })
                    .from(visits)
                    .leftJoin(patients, eq(visits.patientId, patients.id))
                    .where(and(
                        eq(visits.providerId, providerId),
                        eq(visits.clinicId, clinicId),
                        eq(visits.origin, 'scheduled'),
                        eq(visits.status, 'scheduled'),
                        // Check if the new visit overlaps with existing visits
                        sql`(
                            (${visits.scheduledStart} < ${visitEndTime.toISOString()}) AND 
                            (${visits.scheduledStart} + INTERVAL '30 minutes' > ${scheduledStartDate.toISOString()})
                        )`
                    ));

                if (conflictCheck.length > 0) {
                    const conflicts = conflictCheck.map(conflict => {
                        const conflictStart = new Date(conflict.scheduledStart);
                        const conflictEnd = new Date(conflictStart.getTime() + 30 * 60000); // Assuming 30 min default
                        return {
                            time: `${conflictStart.toLocaleTimeString()} - ${conflictEnd.toLocaleTimeString()}`,
                            patient: `${conflict.patient.firstName} ${conflict.patient.lastName}`,
                            type: conflict.visitType
                        };
                    });

                    return res.status(409).json({ 
                        error: 'Time slot conflict with existing scheduled visit',
                        conflicts: conflicts,
                        requestedTime: `${scheduledStartDate.toLocaleTimeString()} - ${visitEndTime.toLocaleTimeString()}`,
                        duration: durationMinutes
                    });
                }
            }

            // Create visit
            const [newVisit] = await db
                .insert(visits)
                .values({
                    patientId,
                    clinicId,
                    appointmentId,
                    providerId,
                    visitDate: new Date(visitDate),
                    visitType,
                    chiefComplaint,
                    origin,
                    status,
                    scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
                    createdBy: userId,
                    recordedBy: userId
                })
                .returning();

            res.status(201).json({ visit: newVisit });
        } catch (error) {
            console.error('Error creating visit:', error);
            res.status(500).json({ error: 'Failed to create visit' });
        }
    }

    // Update visit
    static async updateVisit(req, res) {
        try {
            const { id } = req.params;
            const clinicId = req.userClinic.id;
            const updates = req.body;

            // Verify visit belongs to clinic
            const existingVisit = await db
                .select()
                .from(visits)
                .where(and(
                    eq(visits.id, id),
                    eq(visits.clinicId, clinicId)
                ))
                .limit(1);

            if (!existingVisit.length) {
                return res.status(404).json({ error: 'Visit not found' });
            }

            // Update visit
            const [updatedVisit] = await db
                .update(visits)
                .set({
                    ...updates,
                    updatedAt: new Date()
                })
                .where(eq(visits.id, id))
                .returning();

            res.json({ visit: updatedVisit });
        } catch (error) {
            console.error('Error updating visit:', error);
            res.status(500).json({ error: 'Failed to update visit' });
        }
    }

    // Patch visit (for status updates)
    static async patchVisit(req, res) {
        try {
            const { id } = req.params;
            const clinicId = req.userClinic.id;
            const updates = req.body;

            // Verify visit belongs to clinic
            const existingVisit = await db
                .select()
                .from(visits)
                .where(and(
                    eq(visits.id, id),
                    eq(visits.clinicId, clinicId)
                ))
                .limit(1);

            if (!existingVisit.length) {
                return res.status(404).json({ error: 'Visit not found' });
            }

            // Update only provided fields
            const [updatedVisit] = await db
                .update(visits)
                .set({
                    ...updates,
                    updatedAt: new Date()
                })
                .where(eq(visits.id, id))
                .returning();

            res.json({ visit: updatedVisit });
        } catch (error) {
            console.error('Error patching visit:', error);
            res.status(500).json({ error: 'Failed to patch visit' });
        }
    }
}

export default VisitsController; 