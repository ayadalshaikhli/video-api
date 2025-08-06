import { db } from '../lib/db/drizzle.js';
import { appointments, patients, profiles, appointmentTypes, clinics } from '../lib/db/schema.js';
import { eq, and, gte, lte, desc, asc, ne } from 'drizzle-orm';
import { getSession } from '../lib/auth/session.js';
import { inArray } from 'drizzle-orm';

// Get appointments for a clinic with filtering
export const getAppointments = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
        const { 
            date, 
            startDate,
            endDate,
            status, 
            doctorId, 
            patientId, 
            page = 1, 
            limit = 10 
        } = req.query;

        console.log(`[Appointments] Getting appointments for clinic ${clinicId}, user ${req.user.id}`);

        let whereConditions = [eq(appointments.clinicId, clinicId)];

        // Add filters
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            
            whereConditions.push(
                gte(appointments.startTime, startOfDay),
                lte(appointments.startTime, endOfDay)
            );
        } else if (startDate && endDate) {
            const startOfRange = new Date(startDate);
            const endOfRange = new Date(endDate);
            endOfRange.setHours(23, 59, 59, 999);
            
            whereConditions.push(
                gte(appointments.startTime, startOfRange),
                lte(appointments.startTime, endOfRange)
            );
        }

        if (status) {
            whereConditions.push(eq(appointments.status, status));
        }

        if (doctorId) {
            whereConditions.push(eq(appointments.doctorId, doctorId));
        }

        if (patientId) {
            whereConditions.push(eq(appointments.patientId, patientId));
        }

        const offset = (page - 1) * limit;
        
        const appointmentsList = await db
            .select({
                id: appointments.id,
                startTime: appointments.startTime,
                endTime: appointments.endTime,
                status: appointments.status,
                title: appointments.title,
                reason: appointments.reason,
                notes: appointments.notes,
                createdAt: appointments.createdAt,
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                    email: patients.email,
                    phone: patients.phone,
                },
                doctor: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                },
                appointmentType: {
                    id: appointmentTypes.id,
                    name: appointmentTypes.name,
                    color: appointmentTypes.color,
                    durationMinutes: appointmentTypes.durationMinutes,
                }
            })
            .from(appointments)
            .leftJoin(patients, eq(appointments.patientId, patients.id))
            .leftJoin(profiles, eq(appointments.doctorId, profiles.id))
            .leftJoin(appointmentTypes, eq(appointments.appointmentTypeId, appointmentTypes.id))
            .where(and(...whereConditions))
            .orderBy(asc(appointments.startTime))
            .limit(parseInt(limit))
            .offset(offset);

        res.json({
            appointments: appointmentsList,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: appointmentsList.length
            }
        });

    } catch (error) {
        console.error('Get appointments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get single appointment
export const getAppointment = async (req, res) => {
    try {
        console.log('[getAppointment] Starting appointment fetch for ID:', req.params.id);
        
        const session = await getSession(req);
        if (!session) {
            console.log('[getAppointment] No session found');
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { id } = req.params;

        // Get user's clinic ID for access control
        const userClinicId = session.clinic?.id;
        console.log('[getAppointment] User clinic ID:', userClinicId);
        
        if (!userClinicId) {
            console.log('[getAppointment] No clinic access - user has no clinic');
            return res.status(403).json({ error: 'No clinic access' });
        }

        console.log('[getAppointment] Querying appointment with ID:', id, 'for clinic:', userClinicId);

        const [appointment] = await db
            .select({
                id: appointments.id,
                clinicId: appointments.clinicId,
                startTime: appointments.startTime,
                endTime: appointments.endTime,
                status: appointments.status,
                title: appointments.title,
                reason: appointments.reason,
                notes: appointments.notes,
                createdAt: appointments.createdAt,
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                    email: patients.email,
                    phone: patients.phone,
                    dateOfBirth: patients.dateOfBirth,
                    gender: patients.gender,
                },
                doctor: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                    email: profiles.email,
                },
                appointmentType: {
                    id: appointmentTypes.id,
                    name: appointmentTypes.name,
                    description: appointmentTypes.description,
                    color: appointmentTypes.color,
                    durationMinutes: appointmentTypes.durationMinutes,
                    defaultPrice: appointmentTypes.defaultPrice,
                }
            })
            .from(appointments)
            .leftJoin(patients, eq(appointments.patientId, patients.id))
            .leftJoin(profiles, eq(appointments.doctorId, profiles.id))
            .leftJoin(appointmentTypes, eq(appointments.appointmentTypeId, appointmentTypes.id))
            .where(and(
                eq(appointments.id, id),
                eq(appointments.clinicId, userClinicId)
            ))
            .limit(1);

        console.log('[getAppointment] Query result:', appointment ? 'Found' : 'Not found');

        if (!appointment) {
            console.log('[getAppointment] Appointment not found for ID:', id, 'in clinic:', userClinicId);
            return res.status(404).json({ error: 'Appointment not found' });
        }

        console.log('[getAppointment] Returning appointment data');
        res.json({ appointment });

    } catch (error) {
        console.error('[getAppointment] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create new appointment
export const createAppointment = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const {
            patientId,
            doctorId,
            appointmentTypeId,
            startTime,
            endTime,
            title,
            reason,
            notes
        } = req.body;

        // Get clinic ID from session
        const clinicId = session.clinic?.id;
        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic not found in session' });
        }

        if (!doctorId || !appointmentTypeId || !startTime || !endTime) {
            return res.status(400).json({ 
                error: 'Doctor ID, appointment type ID, start time, and end time are required' 
            });
        }

        // Check for scheduling conflicts
        const conflicts = await db
            .select()
            .from(appointments)
            .where(
                and(
                    eq(appointments.doctorId, doctorId),
                    eq(appointments.status, 'scheduled'),
                    // Check if the new appointment overlaps with existing ones
                    gte(appointments.endTime, new Date(startTime)),
                    lte(appointments.startTime, new Date(endTime))
                )
            );

        if (conflicts.length > 0) {
            return res.status(400).json({ error: 'Doctor has a scheduling conflict at this time' });
        }

        const [newAppointment] = await db
            .insert(appointments)
            .values({
                clinicId,
                patientId: patientId || null,
                doctorId,
                appointmentTypeId,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                title: title || null,
                reason: reason || null,
                notes: notes || null,
                status: 'scheduled',
                createdBy: session.user.id,
            })
            .returning();

        res.status(201).json({
            message: 'Appointment created successfully',
            appointment: newAppointment
        });

    } catch (error) {
        console.error('Create appointment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update appointment
export const updateAppointment = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { id } = req.params;
        const updates = req.body;
        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user

        // Remove fields that shouldn't be updated
        delete updates.id;
        delete updates.createdAt;
        delete updates.createdBy;
        delete updates.clinicId; // Don't allow changing clinic

        // First, verify the appointment belongs to the user's clinic
        const [existingAppointment] = await db
            .select()
            .from(appointments)
            .where(
                and(
                    eq(appointments.id, id),
                    eq(appointments.clinicId, clinicId)
                )
            )
            .limit(1);

        if (!existingAppointment) {
            return res.status(404).json({ error: 'Appointment not found or access denied' });
        }

        // If updating time, check for conflicts
        if (updates.startTime || updates.endTime || updates.doctorId) {
            const doctorId = updates.doctorId || existingAppointment.doctorId;
            const startTime = updates.startTime || existingAppointment.startTime;
            const endTime = updates.endTime || existingAppointment.endTime;

            // Check for scheduling conflicts (excluding current appointment)
            const conflicts = await db
                .select()
                .from(appointments)
                .where(
                    and(
                        eq(appointments.doctorId, doctorId),
                        eq(appointments.status, 'scheduled'),
                        gte(appointments.endTime, new Date(startTime)),
                        lte(appointments.startTime, new Date(endTime)),
                        ne(appointments.id, id) // Exclude current appointment from conflict check
                    )
                );

            if (conflicts.length > 0) {
                return res.status(400).json({ error: 'Doctor has a scheduling conflict at this time' });
            }
        }

        // Convert date strings to Date objects if needed
        if (updates.startTime) {
            updates.startTime = new Date(updates.startTime);
        }
        if (updates.endTime) {
            updates.endTime = new Date(updates.endTime);
        }
        if (updates.checkedInAt) {
            updates.checkedInAt = new Date(updates.checkedInAt);
        }

        const [updatedAppointment] = await db
            .update(appointments)
            .set({
                ...updates,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(appointments.id, id),
                    eq(appointments.clinicId, clinicId)
                )
            )
            .returning();

        if (!updatedAppointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json({
            message: 'Appointment updated successfully',
            appointment: updatedAppointment
        });

    } catch (error) {
        console.error('Update appointment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Cancel appointment
export const cancelAppointment = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { id } = req.params;
        const { reason } = req.body;

        const [updatedAppointment] = await db
            .update(appointments)
            .set({
                status: 'cancelled',
                notes: reason ? `Cancelled: ${reason}` : 'Cancelled',
                updatedAt: new Date(),
            })
            .where(eq(appointments.id, id))
            .returning();

        if (!updatedAppointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json({ message: 'Appointment cancelled successfully' });

    } catch (error) {
        console.error('Cancel appointment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Complete appointment
export const completeAppointment = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { id } = req.params;
        const { notes } = req.body;

        const [updatedAppointment] = await db
            .update(appointments)
            .set({
                status: 'completed',
                notes: notes || null,
                updatedAt: new Date(),
            })
            .where(eq(appointments.id, id))
            .returning();

        if (!updatedAppointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json({ 
            message: 'Appointment marked as completed',
            appointment: updatedAppointment
        });

    } catch (error) {
        console.error('Complete appointment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get doctor's schedule for a specific date
export const getDoctorSchedule = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { doctorId } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const schedule = await db
            .select({
                id: appointments.id,
                startTime: appointments.startTime,
                endTime: appointments.endTime,
                status: appointments.status,
                title: appointments.title,
                patient: {
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                },
                appointmentType: {
                    name: appointmentTypes.name,
                    color: appointmentTypes.color,
                }
            })
            .from(appointments)
            .leftJoin(patients, eq(appointments.patientId, patients.id))
            .leftJoin(appointmentTypes, eq(appointments.appointmentTypeId, appointmentTypes.id))
            .where(
                and(
                    eq(appointments.doctorId, doctorId),
                    gte(appointments.startTime, startOfDay),
                    lte(appointments.startTime, endOfDay)
                )
            )
            .orderBy(asc(appointments.startTime));

        res.json({ schedule });

    } catch (error) {
        console.error('Get doctor schedule error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get appointment types for a clinic
export const getAppointmentTypes = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user

        let appointmentTypesList = await db
            .select({
                id: appointmentTypes.id,
                name: appointmentTypes.name,
                description: appointmentTypes.description,
                durationMinutes: appointmentTypes.durationMinutes,
                color: appointmentTypes.color,
                defaultPrice: appointmentTypes.defaultPrice,
                isActive: appointmentTypes.isActive,
            })
            .from(appointmentTypes)
            .where(and(
                eq(appointmentTypes.clinicId, clinicId),
                eq(appointmentTypes.isActive, true)
            ))
            .orderBy(asc(appointmentTypes.name));

        // If no appointment types exist, create default ones
        if (appointmentTypesList.length === 0) {
            appointmentTypesList = await createDefaultAppointmentTypes(clinicId, session.user.id);
        }

        res.json({ appointmentTypes: appointmentTypesList });

    } catch (error) {
        console.error('Get appointment types error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Auto-update overdue appointments to no-show
export const updateOverdueAppointments = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clinicId = req.userClinic.id;
        const now = new Date();

        // Find appointments that are overdue (past end time and still scheduled/confirmed)
        const overdueAppointments = await db
            .select()
            .from(appointments)
            .where(and(
                eq(appointments.clinicId, clinicId),
                eq(appointments.status, 'scheduled'),
                lte(appointments.endTime, now)
            ));

        if (overdueAppointments.length === 0) {
            return res.json({ 
                message: 'No overdue appointments found',
                updatedCount: 0 
            });
        }

        // Update them to no-show status
        const appointmentIds = overdueAppointments.map(apt => apt.id);
        
        const updatedAppointments = await db
            .update(appointments)
            .set({ 
                status: 'no_show',
                updatedAt: now
            })
            .where(and(
                eq(appointments.clinicId, clinicId),
                inArray(appointments.id, appointmentIds)
            ))
            .returning();

        console.log(`[Appointments] Auto-updated ${updatedAppointments.length} overdue appointments to no-show`);

        res.json({
            message: `Updated ${updatedAppointments.length} overdue appointments to no-show`,
            updatedCount: updatedAppointments.length,
            appointments: updatedAppointments
        });

    } catch (error) {
        console.error('Update overdue appointments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Helper function to create default appointment types for a clinic
const createDefaultAppointmentTypes = async (clinicId, createdBy) => {
    const defaultTypes = [
        {
            name: 'Consultation',
            description: 'General medical consultation',
            durationMinutes: 30,
            color: '#3498DB',
            defaultPrice: 100.00
        },
        {
            name: 'Regular Checkup',
            description: 'Routine health checkup',
            durationMinutes: 15,
            color: '#2ECC71',
            defaultPrice: 75.00
        },
        {
            name: 'Follow-up',
            description: 'Follow-up appointment',
            durationMinutes: 20,
            color: '#F39C12',
            defaultPrice: 80.00
        },
        {
            name: 'Procedure',
            description: 'Medical procedure',
            durationMinutes: 60,
            color: '#E74C3C',
            defaultPrice: 200.00
        },
        {
            name: 'Emergency',
            description: 'Emergency consultation',
            durationMinutes: 45,
            color: '#E67E22',
            defaultPrice: 150.00
        }
    ];

    try {
        const createdTypes = await db
            .insert(appointmentTypes)
            .values(defaultTypes.map(type => ({
                ...type,
                clinicId,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            })))
            .returning({
                id: appointmentTypes.id,
                name: appointmentTypes.name,
                description: appointmentTypes.description,
                durationMinutes: appointmentTypes.durationMinutes,
                color: appointmentTypes.color,
                defaultPrice: appointmentTypes.defaultPrice,
                isActive: appointmentTypes.isActive,
            });

        console.log(`Created ${createdTypes.length} default appointment types for clinic ${clinicId}`);
        return createdTypes;
    } catch (error) {
        console.error('Error creating default appointment types:', error);
        throw error;
    }
};

// Create new appointment type
export const createAppointmentType = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { name, description, durationMinutes, color, defaultPrice } = req.body;

        // Validate required fields
        if (!name || !durationMinutes) {
            return res.status(400).json({ error: 'Name and duration are required' });
        }

        // Validate duration
        if (durationMinutes < 5 || durationMinutes > 480) {
            return res.status(400).json({ error: 'Duration must be between 5 and 480 minutes' });
        }

        // Validate color format (hex color)
        if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
            return res.status(400).json({ error: 'Color must be a valid hex color (e.g., #FF0000)' });
        }

        // Validate price
        if (defaultPrice && (isNaN(defaultPrice) || defaultPrice < 0)) {
            return res.status(400).json({ error: 'Default price must be a positive number' });
        }

        // Check if appointment type with same name exists for this clinic
        const existingType = await db
            .select()
            .from(appointmentTypes)
            .where(and(
                eq(appointmentTypes.clinicId, clinicId),
                eq(appointmentTypes.name, name),
                eq(appointmentTypes.isActive, true)
            ))
            .limit(1);

        if (existingType.length > 0) {
            return res.status(409).json({ error: 'Appointment type with this name already exists' });
        }

        // Create new appointment type
        const [newAppointmentType] = await db
            .insert(appointmentTypes)
            .values({
                clinicId,
                name,
                description: description || null,
                durationMinutes: parseInt(durationMinutes),
                color: color || '#3498DB',
                defaultPrice: defaultPrice ? parseFloat(defaultPrice).toFixed(2) : null,
                isActive: true,
            })
            .returning({
                id: appointmentTypes.id,
                name: appointmentTypes.name,
                description: appointmentTypes.description,
                durationMinutes: appointmentTypes.durationMinutes,
                color: appointmentTypes.color,
                defaultPrice: appointmentTypes.defaultPrice,
                isActive: appointmentTypes.isActive,
                createdAt: appointmentTypes.createdAt,
            });

        res.status(201).json({
            message: 'Appointment type created successfully',
            appointmentType: newAppointmentType
        });

    } catch (error) {
        console.error('Create appointment type error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update appointment type
export const updateAppointmentType = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { appointmentTypeId } = req.params;
        const { name, description, durationMinutes, color, defaultPrice, isActive } = req.body;

        // Validate required fields
        if (!name || !durationMinutes) {
            return res.status(400).json({ error: 'Name and duration are required' });
        }

        // Validate duration
        if (durationMinutes < 5 || durationMinutes > 480) {
            return res.status(400).json({ error: 'Duration must be between 5 and 480 minutes' });
        }

        // Validate color format (hex color)
        if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
            return res.status(400).json({ error: 'Color must be a valid hex color (e.g., #FF0000)' });
        }

        // Validate price
        if (defaultPrice && (isNaN(defaultPrice) || defaultPrice < 0)) {
            return res.status(400).json({ error: 'Default price must be a positive number' });
        }

        // Check if appointment type exists and belongs to this clinic
        const existingType = await db
            .select()
            .from(appointmentTypes)
            .where(and(
                eq(appointmentTypes.id, appointmentTypeId),
                eq(appointmentTypes.clinicId, clinicId)
            ))
            .limit(1);

        if (existingType.length === 0) {
            return res.status(404).json({ error: 'Appointment type not found' });
        }

        // Check if another appointment type with same name exists for this clinic
        const duplicateType = await db
            .select()
            .from(appointmentTypes)
            .where(and(
                eq(appointmentTypes.clinicId, clinicId),
                eq(appointmentTypes.name, name),
                ne(appointmentTypes.id, appointmentTypeId),
                eq(appointmentTypes.isActive, true)
            ))
            .limit(1);

        if (duplicateType.length > 0) {
            return res.status(409).json({ error: 'Appointment type with this name already exists' });
        }

        // Update appointment type
        const [updatedAppointmentType] = await db
            .update(appointmentTypes)
            .set({
                name,
                description: description || null,
                durationMinutes: parseInt(durationMinutes),
                color: color || '#3498DB',
                defaultPrice: defaultPrice ? parseFloat(defaultPrice).toFixed(2) : null,
                isActive: isActive !== undefined ? isActive : true,
                updatedAt: new Date(),
            })
            .where(eq(appointmentTypes.id, appointmentTypeId))
            .returning({
                id: appointmentTypes.id,
                name: appointmentTypes.name,
                description: appointmentTypes.description,
                durationMinutes: appointmentTypes.durationMinutes,
                color: appointmentTypes.color,
                defaultPrice: appointmentTypes.defaultPrice,
                isActive: appointmentTypes.isActive,
                updatedAt: appointmentTypes.updatedAt,
            });

        res.json({
            message: 'Appointment type updated successfully',
            appointmentType: updatedAppointmentType
        });

    } catch (error) {
        console.error('Update appointment type error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete (soft delete) appointment type
export const deleteAppointmentType = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { appointmentTypeId } = req.params;

        // Check if appointment type exists and belongs to this clinic
        const existingType = await db
            .select()
            .from(appointmentTypes)
            .where(and(
                eq(appointmentTypes.id, appointmentTypeId),
                eq(appointmentTypes.clinicId, clinicId)
            ))
            .limit(1);

        if (existingType.length === 0) {
            return res.status(404).json({ error: 'Appointment type not found' });
        }

        // Check if there are any appointments using this type
        const appointmentsUsingType = await db
            .select()
            .from(appointments)
            .where(eq(appointments.appointmentTypeId, appointmentTypeId))
            .limit(1);

        if (appointmentsUsingType.length > 0) {
            // Soft delete - just mark as inactive
            await db
                .update(appointmentTypes)
                .set({
                    isActive: false,
                    updatedAt: new Date(),
                })
                .where(eq(appointmentTypes.id, appointmentTypeId));

            res.json({
                message: 'Appointment type deactivated successfully (appointments using this type still exist)'
            });
        } else {
            // Hard delete if no appointments are using it
            await db
                .delete(appointmentTypes)
                .where(eq(appointmentTypes.id, appointmentTypeId));

            res.json({
                message: 'Appointment type deleted successfully'
            });
        }

    } catch (error) {
        console.error('Delete appointment type error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get single appointment type
export const getAppointmentType = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { appointmentTypeId } = req.params;

        const [appointmentType] = await db
            .select({
                id: appointmentTypes.id,
                name: appointmentTypes.name,
                description: appointmentTypes.description,
                durationMinutes: appointmentTypes.durationMinutes,
                color: appointmentTypes.color,
                defaultPrice: appointmentTypes.defaultPrice,
                isActive: appointmentTypes.isActive,
                createdAt: appointmentTypes.createdAt,
                updatedAt: appointmentTypes.updatedAt,
            })
            .from(appointmentTypes)
            .where(and(
                eq(appointmentTypes.id, appointmentTypeId),
                eq(appointmentTypes.clinicId, clinicId)
            ))
            .limit(1);

        if (!appointmentType) {
            return res.status(404).json({ error: 'Appointment type not found' });
        }

        res.json({ appointmentType });

    } catch (error) {
        console.error('Get appointment type error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}; 