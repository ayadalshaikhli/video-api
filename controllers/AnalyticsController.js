import { db } from '../lib/db/drizzle.js';
import { patients, appointments, invoices, payments, userRoles } from '../lib/db/schema.js';
import { eq, and, gte, lte, desc, sql, count, sum } from 'drizzle-orm';

// Get analytics data for a clinic
export async function getAnalytics(req, res) {
  try {
    // Auth and clinic access already verified by middleware
    const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
    const { type = 'overview', range = 'month' } = req.query;

    // Calculate date range
    const { startDate, endDate, startDateStr, endDateStr } = calculateDateRange(range);

    let analyticsData = {};

    switch (type) {
      case 'overview':
        analyticsData = await getOverviewAnalytics(clinicId, startDate, endDate, startDateStr, endDateStr);
        break;
      case 'patients':
        analyticsData = await getPatientsAnalytics(clinicId, startDate, endDate);
        break;
      case 'financial':
        analyticsData = await getFinancialAnalytics(clinicId, startDate, endDate, startDateStr, endDateStr);
        break;
      case 'appointments':
        analyticsData = await getAppointmentsAnalytics(clinicId, startDate, endDate);
        break;
      case 'performance':
        analyticsData = await getPerformanceAnalytics(clinicId, startDate, endDate);
        break;
      default:
        analyticsData = await getOverviewAnalytics(clinicId, startDate, endDate, startDateStr, endDateStr);
    }

    res.json({ data: analyticsData });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
}

// Calculate date range based on the range parameter
function calculateDateRange(range) {
  const now = new Date();
  let startDate = new Date();

  switch (range) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(now.getMonth() - 1);
  }

  // Return both Date objects (for timestamp fields) and date strings (for date fields)
  return {
    startDate,
    endDate: now,
    startDateStr: startDate.toISOString().split('T')[0],
    endDateStr: now.toISOString().split('T')[0]
  };
}

// Overview analytics with key metrics
async function getOverviewAnalytics(clinicId, startDate, endDate, startDateStr, endDateStr) {
  try {
    // Get total patients
    const totalPatientsResult = await db
      .select({ count: count() })
      .from(patients)
      .where(eq(patients.clinicId, clinicId));

    // Get appointments in date range (using Date objects for timestamp field)
    const appointmentsResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      );

    // Get total revenue from payments by joining with invoices (using date strings for date field)
    const revenueResult = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        )
      );

    // Get completed appointments
    const completedAppointmentsResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.status, 'completed'),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      );

    // Get new patients in date range
    const newPatientsResult = await db
      .select({ count: count() })
      .from(patients)
      .where(
        and(
          eq(patients.clinicId, clinicId),
          gte(patients.createdAt, startDate),
          lte(patients.createdAt, endDate)
        )
      );

    return {
      totalPatients: totalPatientsResult[0]?.count || 0,
      totalAppointments: appointmentsResult[0]?.count || 0,
      totalRevenue: revenueResult[0]?.total || 0,
      completedAppointments: completedAppointmentsResult[0]?.count || 0,
      newPatients: newPatientsResult[0]?.count || 0,
      averageRevenuePerAppointment: appointmentsResult[0]?.count > 0 ?
        (revenueResult[0]?.total || 0) / appointmentsResult[0]?.count : 0
    };
  } catch (error) {
    console.error('Error getting overview analytics:', error);
    return {
      totalPatients: 0,
      totalAppointments: 0,
      totalRevenue: 0,
      completedAppointments: 0,
      newPatients: 0,
      averageRevenuePerAppointment: 0
    };
  }
}

// Patients analytics
async function getPatientsAnalytics(clinicId, startDate, endDate) {
  try {
    // Get total patients
    const totalPatientsResult = await db
      .select({ count: count() })
      .from(patients)
      .where(eq(patients.clinicId, clinicId));

    // Get new patients in date range
    const newPatientsResult = await db
      .select({ count: count() })
      .from(patients)
      .where(
        and(
          eq(patients.clinicId, clinicId),
          gte(patients.createdAt, startDate),
          lte(patients.createdAt, endDate)
        )
      );

    // Get patients with appointments in date range
    const activePatientsResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      );

    // Get returning patients (patients with multiple appointments)
    const returningPatientsResult = await db
      .select({ count: count() })
      .from(
        db.select({ patientId: appointments.patientId })
          .from(appointments)
          .where(
            and(
              eq(appointments.clinicId, clinicId),
              gte(appointments.startTime, startDate),
              lte(appointments.startTime, endDate)
            )
          )
          .groupBy(appointments.patientId)
          .having(sql`count(*) > 1`)
          .as('returning_patients')
      );

    return {
      totalPatients: totalPatientsResult[0]?.count || 0,
      newPatients: newPatientsResult[0]?.count || 0,
      activePatients: activePatientsResult[0]?.count || 0,
      returningPatients: returningPatientsResult[0]?.count || 0,
      patientRetentionRate: totalPatientsResult[0]?.count > 0 ?
        (returningPatientsResult[0]?.count / totalPatientsResult[0]?.count) * 100 : 0
    };
  } catch (error) {
    console.error('Error getting patients analytics:', error);
    return {
      totalPatients: 0,
      newPatients: 0,
      activePatients: 0,
      returningPatients: 0,
      patientRetentionRate: 0
    };
  }
}

// Financial analytics
async function getFinancialAnalytics(clinicId, startDate, endDate, startDateStr, endDateStr) {
  try {
    // Get total revenue from payments by joining with invoices (using date strings for date field)
    const revenueResult = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        )
      );

    // Get total invoices
    const invoicesResult = await db
      .select({ count: count(), total: sum(invoices.totalAmount) })
      .from(invoices)
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        )
      );

    // Get paid invoices
    const paidInvoicesResult = await db
      .select({ count: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          eq(invoices.status, 'paid'),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        )
      );

    // Get outstanding invoices
    const outstandingInvoicesResult = await db
      .select({ count: count(), total: sum(invoices.totalAmount) })
      .from(invoices)
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          eq(invoices.status, 'pending'),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        )
      );

    const totalRevenue = revenueResult[0]?.total || 0;
    const totalInvoices = invoicesResult[0]?.count || 0;
    const paidInvoices = paidInvoicesResult[0]?.count || 0;
    const outstandingAmount = outstandingInvoicesResult[0]?.total || 0;

    return {
      totalRevenue,
      totalInvoices,
      paidInvoices,
      outstandingInvoices: outstandingInvoicesResult[0]?.count || 0,
      outstandingAmount,
      collectionRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0,
      averageInvoiceValue: totalInvoices > 0 ? (invoicesResult[0]?.total || 0) / totalInvoices : 0
    };
  } catch (error) {
    console.error('Error getting financial analytics:', error);
    return {
      totalRevenue: 0,
      totalInvoices: 0,
      paidInvoices: 0,
      outstandingInvoices: 0,
      outstandingAmount: 0,
      collectionRate: 0,
      averageInvoiceValue: 0
    };
  }
}

// Appointments analytics
async function getAppointmentsAnalytics(clinicId, startDate, endDate) {
  try {
    // Get total appointments in date range (using Date objects for timestamp field)
    const totalAppointmentsResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      );

    // Get completed appointments
    const completedResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.status, 'completed'),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      );

    // Get scheduled appointments
    const scheduledResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.status, 'scheduled'),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      );

    // Get cancelled appointments
    const cancelledResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.status, 'cancelled'),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      );

    // Get no-show appointments
    const noShowResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.status, 'no_show'),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      );

    return {
      scheduled: scheduledResult[0]?.count || 0,
      completed: completedResult[0]?.count || 0,
      cancelled: cancelledResult[0]?.count || 0,
      noShows: noShowResult[0]?.count || 0,
      averageDuration: 30, // Placeholder - would need to calculate from actual data
      busyHours: [] // Would need to analyze appointment times
    };
  } catch (error) {
    console.error('Error getting appointments analytics:', error);
    return {
      scheduled: 0,
      completed: 0,
      cancelled: 0,
      noShows: 0,
      averageDuration: 0,
      busyHours: []
    };
  }
}

// Performance analytics
async function getPerformanceAnalytics(clinicId, startDate, endDate) {
  try {
    // Get total appointments for throughput calculation (using Date objects for timestamp field)
    const totalAppointmentsResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      );

    const completedAppointmentsResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.status, 'completed'),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      );

    const totalStaffResult = await db
      .select({ count: count() })
      .from(userRoles)
      .where(eq(userRoles.clinicId, clinicId));

    const totalAppointments = totalAppointmentsResult[0]?.count || 0;
    const completedAppointments = completedAppointmentsResult[0]?.count || 0;
    const totalStaff = totalStaffResult[0]?.count || 0;

    return {
      patientThroughput: totalAppointments > 0 ? Math.round(totalAppointments / 30) : 0, // Per day average
      staffProductivity: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
      equipmentUtilization: 75, // Placeholder - would need equipment data
      qualityMetrics: [] // Would need quality indicators
    };
  } catch (error) {
    console.error('Error getting performance analytics:', error);
    return {
      patientThroughput: 0,
      staffProductivity: 0,
      equipmentUtilization: 0,
      qualityMetrics: []
    };
  }
} 