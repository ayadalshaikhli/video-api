import { db } from '../lib/db/drizzle.js';
import { 
    shiftTypes, 
    staffSchedules, 
    staffTimeOff, 
    scheduleOverrides,
    users, 
    profiles, 
    userRoles,
    clinics 
} from '../lib/db/schema.js';
import { eq, and, or, gte, lte, desc, asc } from 'drizzle-orm';

class ScheduleController {
    // Shift Types Management
    static async getShiftTypes(req, res) {
        try {
            const clinicId = req.userClinic.id;
            
            const shiftTypesList = await db
                .select()
                .from(shiftTypes)
                .where(and(
                    eq(shiftTypes.clinicId, clinicId),
                    eq(shiftTypes.isActive, true)
                ))
                .orderBy(asc(shiftTypes.name));

            res.json({ shiftTypes: shiftTypesList });
        } catch (error) {
            console.error('Error getting shift types:', error);
            res.status(500).json({ error: 'Failed to get shift types' });
        }
    }

    static async createShiftType(req, res) {
        try {
            const clinicId = req.userClinic.id;
            const { name, startTime, endTime, color } = req.body;

            const [shiftType] = await db
                .insert(shiftTypes)
                .values({
                    clinicId,
                    name,
                    startTime,
                    endTime,
                    color: color || '#3498db'
                })
                .returning();

            res.json({ shiftType });
        } catch (error) {
            console.error('Error creating shift type:', error);
            res.status(500).json({ error: 'Failed to create shift type' });
        }
    }

    static async updateShiftType(req, res) {
        try {
            const { id } = req.params;
            const clinicId = req.userClinic.id;
            const { name, startTime, endTime, color, isActive } = req.body;

            const [shiftType] = await db
                .update(shiftTypes)
                .set({
                    name,
                    startTime,
                    endTime,
                    color,
                    isActive,
                    updatedAt: new Date()
                })
                .where(and(
                    eq(shiftTypes.id, id),
                    eq(shiftTypes.clinicId, clinicId)
                ))
                .returning();

            if (!shiftType) {
                return res.status(404).json({ error: 'Shift type not found' });
            }

            res.json({ shiftType });
        } catch (error) {
            console.error('Error updating shift type:', error);
            res.status(500).json({ error: 'Failed to update shift type' });
        }
    }

    static async deleteShiftType(req, res) {
        try {
            const { id } = req.params;
            const clinicId = req.userClinic.id;

            // Check if shift type is being used
            const usedSchedules = await db
                .select()
                .from(staffSchedules)
                .where(eq(staffSchedules.shiftTypeId, id))
                .limit(1);

            if (usedSchedules.length > 0) {
                return res.status(400).json({ 
                    error: 'Cannot delete shift type that is being used in schedules' 
                });
            }

            await db
                .delete(shiftTypes)
                .where(and(
                    eq(shiftTypes.id, id),
                    eq(shiftTypes.clinicId, clinicId)
                ));

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting shift type:', error);
            res.status(500).json({ error: 'Failed to delete shift type' });
        }
    }

    // Staff Schedules Management
    static async getStaffSchedules(req, res) {
        try {
            const clinicId = req.userClinic.id;
            const { userId } = req.query;

            let whereConditions = [eq(staffSchedules.clinicId, clinicId)];

            if (userId) {
                whereConditions.push(eq(staffSchedules.userId, userId));
            }

            const schedules = await db
                .select({
                    id: staffSchedules.id,
                    userId: staffSchedules.userId,
                    startTime: staffSchedules.startTime,
                    endTime: staffSchedules.endTime,
                    monday: staffSchedules.monday,
                    tuesday: staffSchedules.tuesday,
                    wednesday: staffSchedules.wednesday,
                    thursday: staffSchedules.thursday,
                    friday: staffSchedules.friday,
                    saturday: staffSchedules.saturday,
                    sunday: staffSchedules.sunday,
                    isRecurring: staffSchedules.isRecurring,
                    startDate: staffSchedules.startDate,
                    endDate: staffSchedules.endDate,
                    isActive: staffSchedules.isActive,
                    notes: staffSchedules.notes,
                    shiftType: {
                        id: shiftTypes.id,
                        name: shiftTypes.name,
                        color: shiftTypes.color
                    },
                    user: {
                        id: users.id,
                        email: users.email,
                        firstName: profiles.firstName,
                        lastName: profiles.lastName
                    }
                })
                .from(staffSchedules)
                .leftJoin(shiftTypes, eq(staffSchedules.shiftTypeId, shiftTypes.id))
                .leftJoin(users, eq(staffSchedules.userId, users.id))
                .leftJoin(profiles, eq(users.id, profiles.id))
                .where(and(...whereConditions))
                .orderBy(asc(staffSchedules.startTime));

            res.json({ schedules });
        } catch (error) {
            console.error('Error getting staff schedules:', error);
            res.status(500).json({ error: 'Failed to get staff schedules' });
        }
    }

    static async createStaffSchedule(req, res) {
        try {
            const clinicId = req.userClinic.id;
            const { 
                userId, 
                shiftTypeId, 
                startTime, 
                endTime, 
                monday, 
                tuesday, 
                wednesday, 
                thursday, 
                friday, 
                saturday, 
                sunday,
                isRecurring, 
                startDate, 
                endDate, 
                notes 
            } = req.body;

            // Check if user belongs to this clinic
            const userRole = await db
                .select()
                .from(userRoles)
                .where(and(
                    eq(userRoles.userId, userId),
                    eq(userRoles.clinicId, clinicId)
                ))
                .limit(1);

            if (userRole.length === 0) {
                return res.status(400).json({ error: 'User does not belong to this clinic' });
            }

            const [schedule] = await db
                .insert(staffSchedules)
                .values({
                    userId,
                    clinicId,
                    shiftTypeId,
                    startTime,
                    endTime,
                    monday: monday || false,
                    tuesday: tuesday || false,
                    wednesday: wednesday || false,
                    thursday: thursday || false,
                    friday: friday || false,
                    saturday: saturday || false,
                    sunday: sunday || false,
                    isRecurring,
                    startDate,
                    endDate,
                    notes
                })
                .returning();

            res.json({ schedule });
        } catch (error) {
            console.error('Error creating staff schedule:', error);
            res.status(500).json({ error: 'Failed to create staff schedule' });
        }
    }

    static async updateStaffSchedule(req, res) {
        try {
            const { id } = req.params;
            const clinicId = req.userClinic.id;
            const { 
                shiftTypeId, 
                startTime, 
                endTime, 
                monday, 
                tuesday, 
                wednesday, 
                thursday, 
                friday, 
                saturday, 
                sunday,
                isRecurring, 
                startDate, 
                endDate, 
                isActive, 
                notes 
            } = req.body;

            const [schedule] = await db
                .update(staffSchedules)
                .set({
                    shiftTypeId,
                    startTime,
                    endTime,
                    monday: monday || false,
                    tuesday: tuesday || false,
                    wednesday: wednesday || false,
                    thursday: thursday || false,
                    friday: friday || false,
                    saturday: saturday || false,
                    sunday: sunday || false,
                    isRecurring,
                    startDate,
                    endDate,
                    isActive,
                    notes,
                    updatedAt: new Date()
                })
                .where(and(
                    eq(staffSchedules.id, id),
                    eq(staffSchedules.clinicId, clinicId)
                ))
                .returning();

            if (!schedule) {
                return res.status(404).json({ error: 'Schedule not found' });
            }

            res.json({ schedule });
        } catch (error) {
            console.error('Error updating staff schedule:', error);
            res.status(500).json({ error: 'Failed to update staff schedule' });
        }
    }

    static async deleteStaffSchedule(req, res) {
        try {
            const { id } = req.params;
            const clinicId = req.userClinic.id;

            await db
                .delete(staffSchedules)
                .where(and(
                    eq(staffSchedules.id, id),
                    eq(staffSchedules.clinicId, clinicId)
                ));

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting staff schedule:', error);
            res.status(500).json({ error: 'Failed to delete staff schedule' });
        }
    }

    // Time Off Management
    static async getTimeOffRequests(req, res) {
        try {
            const clinicId = req.userClinic.id;
            const { status, userId } = req.query;

            let whereConditions = [eq(staffTimeOff.clinicId, clinicId)];

            if (status) {
                whereConditions.push(eq(staffTimeOff.status, status));
            }

            if (userId) {
                whereConditions.push(eq(staffTimeOff.userId, userId));
            }

            const timeOffRequests = await db
                .select({
                    id: staffTimeOff.id,
                    userId: staffTimeOff.userId,
                    startDate: staffTimeOff.startDate,
                    endDate: staffTimeOff.endDate,
                    startTime: staffTimeOff.startTime,
                    endTime: staffTimeOff.endTime,
                    reason: staffTimeOff.reason,
                    type: staffTimeOff.type,
                    status: staffTimeOff.status,
                    approvedBy: staffTimeOff.approvedBy,
                    approvedAt: staffTimeOff.approvedAt,
                    createdAt: staffTimeOff.createdAt,
                    user: {
                        id: users.id,
                        email: users.email,
                        firstName: profiles.firstName,
                        lastName: profiles.lastName
                    }
                })
                .from(staffTimeOff)
                .leftJoin(users, eq(staffTimeOff.userId, users.id))
                .leftJoin(profiles, eq(users.id, profiles.id))
                .where(and(...whereConditions))
                .orderBy(desc(staffTimeOff.createdAt));

            res.json({ timeOffRequests });
        } catch (error) {
            console.error('Error getting time off requests:', error);
            res.status(500).json({ error: 'Failed to get time off requests' });
        }
    }

    static async createTimeOffRequest(req, res) {
        try {
            const clinicId = req.userClinic.id;
            const { userId, startDate, endDate, startTime, endTime, reason, type } = req.body;

            // Check if user belongs to this clinic
            const userRole = await db
                .select()
                .from(userRoles)
                .where(and(
                    eq(userRoles.userId, userId),
                    eq(userRoles.clinicId, clinicId)
                ))
                .limit(1);

            if (userRole.length === 0) {
                return res.status(400).json({ error: 'User does not belong to this clinic' });
            }

            const [timeOffRequest] = await db
                .insert(staffTimeOff)
                .values({
                    userId,
                    clinicId,
                    startDate,
                    endDate,
                    startTime,
                    endTime,
                    reason,
                    type: type || 'vacation'
                })
                .returning();

            res.json({ timeOffRequest });
        } catch (error) {
            console.error('Error creating time off request:', error);
            res.status(500).json({ error: 'Failed to create time off request' });
        }
    }

    static async updateTimeOffRequest(req, res) {
        try {
            const { id } = req.params;
            const clinicId = req.userClinic.id;
            const { status, approvedBy } = req.body;

            const updateData = {
                status,
                updatedAt: new Date()
            };

            if (status === 'approved') {
                updateData.approvedBy = approvedBy;
                updateData.approvedAt = new Date();
            }

            const [timeOffRequest] = await db
                .update(staffTimeOff)
                .set(updateData)
                .where(and(
                    eq(staffTimeOff.id, id),
                    eq(staffTimeOff.clinicId, clinicId)
                ))
                .returning();

            if (!timeOffRequest) {
                return res.status(404).json({ error: 'Time off request not found' });
            }

            res.json({ timeOffRequest });
        } catch (error) {
            console.error('Error updating time off request:', error);
            res.status(500).json({ error: 'Failed to update time off request' });
        }
    }

    // Schedule Overrides
    static async getScheduleOverrides(req, res) {
        try {
            const clinicId = req.userClinic.id;
            const { userId, date } = req.query;

            let whereConditions = [eq(scheduleOverrides.clinicId, clinicId)];

            if (userId) {
                whereConditions.push(eq(scheduleOverrides.userId, userId));
            }

            if (date) {
                whereConditions.push(eq(scheduleOverrides.date, date));
            }

            const overrides = await db
                .select({
                    id: scheduleOverrides.id,
                    userId: scheduleOverrides.userId,
                    date: scheduleOverrides.date,
                    originalStartTime: scheduleOverrides.originalStartTime,
                    originalEndTime: scheduleOverrides.originalEndTime,
                    newStartTime: scheduleOverrides.newStartTime,
                    newEndTime: scheduleOverrides.newEndTime,
                    reason: scheduleOverrides.reason,
                    isActive: scheduleOverrides.isActive,
                    user: {
                        id: users.id,
                        email: users.email,
                        firstName: profiles.firstName,
                        lastName: profiles.lastName
                    }
                })
                .from(scheduleOverrides)
                .leftJoin(users, eq(scheduleOverrides.userId, users.id))
                .leftJoin(profiles, eq(users.id, profiles.id))
                .where(and(...whereConditions))
                .orderBy(asc(scheduleOverrides.date));

            res.json({ overrides });
        } catch (error) {
            console.error('Error getting schedule overrides:', error);
            res.status(500).json({ error: 'Failed to get schedule overrides' });
        }
    }

    static async createScheduleOverride(req, res) {
        try {
            const clinicId = req.userClinic.id;
            const { userId, date, originalStartTime, originalEndTime, newStartTime, newEndTime, reason } = req.body;

            const [override] = await db
                .insert(scheduleOverrides)
                .values({
                    userId,
                    clinicId,
                    date,
                    originalStartTime,
                    originalEndTime,
                    newStartTime,
                    newEndTime,
                    reason
                })
                .returning();

            res.json({ override });
        } catch (error) {
            console.error('Error creating schedule override:', error);
            res.status(500).json({ error: 'Failed to create schedule override' });
        }
    }
}

export default ScheduleController; 