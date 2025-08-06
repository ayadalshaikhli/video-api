import { db } from '../lib/db/drizzle.js';
import { patients, appointments, visits, invoices, payments, userRoles, services } from '../lib/db/schema.js';
import { eq, and, gte, lte, count, sum, desc, sql } from 'drizzle-orm';

// Dashboard controller for clinic overview and statistics

// Get basic dashboard stats for a clinic
export const getDashboardStats = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
        const userRole = req.userRole?.role || 'doctor';  // Get user role
        
        console.log(`[Dashboard] Getting real stats for clinic ${clinicId}, user ${req.user.id}, role: ${userRole}`);
        
        // Get real patient count
        const [patientCountResult] = await db
            .select({ count: count() })
            .from(patients)
            .where(eq(patients.clinicId, clinicId));
        
        const totalPatients = patientCountResult?.count || 0;
        
        // Get today's appointments
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        const [todayAppointmentsResult] = await db
            .select({ count: count() })
            .from(appointments)
            .where(and(
                eq(appointments.clinicId, clinicId),
                gte(appointments.startTime, startOfDay),
                lte(appointments.startTime, endOfDay)
            ));
        
        const todayAppointments = todayAppointmentsResult?.count || 0;
        
        // Get pending appointments (scheduled and confirmed)
        const [pendingAppointmentsResult] = await db
            .select({ count: count() })
            .from(appointments)
            .where(and(
                eq(appointments.clinicId, clinicId),
                sql`${appointments.status} IN ('scheduled', 'confirmed')`,
                gte(appointments.startTime, startOfDay)
            ));
        
        const pendingAppointments = pendingAppointmentsResult?.count || 0;
        
        // Get monthly revenue (current month)
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        
        const [monthlyRevenueResult] = await db
            .select({ 
                total: sum(invoices.total),
                count: count()
            })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                eq(invoices.status, 'paid'),
                gte(invoices.issueDate, startOfMonth.toISOString().split('T')[0]),
                lte(invoices.issueDate, endOfMonth.toISOString().split('T')[0])
            ));
        
        const monthlyRevenue = parseFloat(monthlyRevenueResult?.total || 0);
        
        // Get completed visits (this month)
        const [completedVisitsResult] = await db
            .select({ count: count() })
            .from(visits)
            .where(and(
                eq(visits.clinicId, clinicId),
                gte(visits.visitDate, startOfMonth),
                lte(visits.visitDate, endOfMonth)
            ));
        
        const completedVisits = completedVisitsResult?.count || 0;
        
        // Get pending payments (invoices with pending status)
        const [pendingPaymentsResult] = await db
            .select({ 
                total: sum(invoices.total),
                count: count()
            })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                eq(invoices.status, 'pending')
            ));
        
        const pendingPayments = parseFloat(pendingPaymentsResult?.total || 0);
        
        const stats = {
            totalPatients,
            todayAppointments,
            pendingAppointments,
            monthlyRevenue,
            completedVisits,
            pendingPayments
        };
        
        console.log(`[Dashboard] Returning real stats for clinic ${clinicId}:`, stats);
        res.json({
            success: true,
            stats: stats,
            clinicId: clinicId
        });
        
    } catch (error) {
        console.error('[Dashboard] Get stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get comprehensive dashboard data for a clinic
export const getDashboardData = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
        const userRole = req.userRole?.role || 'doctor';  // Get user role
        const { range = 'today' } = req.query;
        
        console.log(`[Dashboard] Getting real dashboard data for clinic ${clinicId}, range: ${range}, user ${req.user.id}, role: ${userRole}`);
        
        // Get total patients count
        const [patientCountResult] = await db
            .select({ count: count() })
            .from(patients)
            .where(eq(patients.clinicId, clinicId));
        
        const totalPatients = patientCountResult?.count || 0;
        
        // Calculate date range based on the range parameter
        const today = new Date();
        let startDate, endDate;
        
        if (range === 'today') {
            startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        } else if (range === 'week') {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            startDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 7);
        } else if (range === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        } else {
            // Default to today
            startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        }
        
        // Get appointments for the date range
        const [appointmentCountResult] = await db
            .select({ count: count() })
            .from(appointments)
            .where(and(
                eq(appointments.clinicId, clinicId),
                gte(appointments.startTime, startDate),
                lte(appointments.startTime, endDate)
            ));
        
        const totalAppointments = appointmentCountResult?.count || 0;
        
        // Get completed appointments
        const [completedAppointmentsResult] = await db
            .select({ count: count() })
            .from(appointments)
            .where(and(
                eq(appointments.clinicId, clinicId),
                eq(appointments.status, 'completed'),
                gte(appointments.startTime, startDate),
                lte(appointments.startTime, endDate)
            ));
        
        const completedAppointments = completedAppointmentsResult?.count || 0;
        
        // Get new patients in date range
        const [newPatientsResult] = await db
            .select({ count: count() })
            .from(patients)
            .where(and(
                eq(patients.clinicId, clinicId),
                gte(patients.createdAt, startDate),
                lte(patients.createdAt, endDate)
            ));
        
        const newPatients = newPatientsResult?.count || 0;
        
        // Get revenue for the date range
        const [revenueResult] = await db
            .select({ 
                total: sum(invoices.total),
                count: count()
            })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                eq(invoices.status, 'paid'),
                gte(invoices.issueDate, startDate.toISOString().split('T')[0]),
                lte(invoices.issueDate, endDate.toISOString().split('T')[0])
            ));
        
        const totalRevenue = parseFloat(revenueResult?.total || 0);
        
        // Get pending revenue
        const [pendingRevenueResult] = await db
            .select({ 
                total: sum(invoices.total),
                count: count()
            })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                eq(invoices.status, 'pending')
            ));
        
        const pendingRevenue = parseFloat(pendingRevenueResult?.total || 0);
        
        // Get active staff count
        const [activeStaffResult] = await db
            .select({ count: count() })
            .from(userRoles)
            .where(and(
                eq(userRoles.clinicId, clinicId),
                eq(userRoles.isActive, true),
                eq(userRoles.status, 'active')
            ));
        
        const activeStaff = activeStaffResult?.count || 0;
        
        // Get on-duty staff count (simplified - staff with appointments today)
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        const [onDutyStaffResult] = await db
            .select({ count: sql`COUNT(DISTINCT ${appointments.doctorId})` })
            .from(appointments)
            .where(and(
                eq(appointments.clinicId, clinicId),
                gte(appointments.startTime, startOfDay),
                lte(appointments.startTime, endOfDay),
                sql`${appointments.status} IN ('scheduled', 'confirmed')`
            ));
        
        const onDutyStaff = onDutyStaffResult?.count || 0;
        
        // Get recent activity (last 10 appointments, visits, and payments)
        // Filter based on user role
        let recentAppointments = []
        if (['admin', 'doctor', 'nurse', 'receptionist'].includes(userRole)) {
            recentAppointments = await db
                .select({
                    id: appointments.id,
                    type: sql`'appointment'`,
                    title: appointments.title,
                    date: appointments.createdAt,
                    status: appointments.status,
                    patientName: sql`CONCAT(${patients.firstName}, ' ', ${patients.lastName})`
                })
                .from(appointments)
                .leftJoin(patients, eq(appointments.patientId, patients.id))
                .where(eq(appointments.clinicId, clinicId))
                .orderBy(desc(appointments.createdAt))
                .limit(5);
        }
        
        let recentVisits = []
        if (['admin', 'doctor', 'nurse'].includes(userRole)) {
            recentVisits = await db
                .select({
                    id: visits.id,
                    type: sql`'visit'`,
                    title: sql`'Medical Visit'`,
                    date: visits.createdAt,
                    status: visits.status,
                    patientName: sql`CONCAT(${patients.firstName}, ' ', ${patients.lastName})`
                })
                .from(visits)
                .leftJoin(patients, eq(visits.patientId, patients.id))
                .where(eq(visits.clinicId, clinicId))
                .orderBy(desc(visits.createdAt))
                .limit(5);
        }
        
        let recentPayments = []
        if (['admin', 'receptionist'].includes(userRole)) {
            recentPayments = await db
                .select({
                    id: payments.id,
                    type: sql`'payment'`,
                    title: sql`'Payment'`,
                    date: payments.createdAt,
                    amount: payments.amount,
                    patientName: sql`CONCAT(${patients.firstName}, ' ', ${patients.lastName})`
                })
                .from(payments)
                .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
                .leftJoin(patients, eq(invoices.patientId, patients.id))
                .where(eq(invoices.clinicId, clinicId))
                .orderBy(desc(payments.createdAt))
                .limit(5);
        }
        
        // Combine and sort recent activity
        const recentActivity = [
            ...recentAppointments.map(item => ({ ...item, date: item.date })),
            ...recentVisits.map(item => ({ ...item, date: item.date })),
            ...recentPayments.map(item => ({ ...item, date: new Date(item.date) }))
        ]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);
        
        // Create the data structure that matches what the component expects
        const dashboardData = {
            appointments: { 
                total: totalAppointments, 
                completed: completedAppointments 
            },
            patients: { 
                total: totalPatients, 
                new: newPatients
            },
            revenue: { 
                total: totalRevenue,
                pending: pendingRevenue
            },
            staff: { 
                active: activeStaff,
                onDuty: onDutyStaff
            },
            recentActivity: recentActivity
        };
        
        console.log(`[Dashboard] Returning real dashboard data for clinic ${clinicId}, range: ${range}:`, dashboardData);
        res.json({
            success: true,
            data: dashboardData,
            clinicId: clinicId,
            range: range,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Dashboard] Get dashboard data error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}; 