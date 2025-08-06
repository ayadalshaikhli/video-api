import { db } from '../lib/db/drizzle.js';
import { 
  patients, 
  invoices, 
  payments, 
  userRoles, 
  visits, 
  prescriptions, 
  labOrders,
  services,
  invoiceItems,
  profiles
} from '../lib/db/schema.js';
import { eq, and, gte, lte, desc, sql, count, sum, asc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get comprehensive reports data
export async function getReports(req, res) {
  try {
    // Auth and clinic access already verified by middleware
    const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
    const { type = 'overview', range = 'month' } = req.query;

    // Calculate date range
    const { startDate, endDate, startDateStr, endDateStr } = calculateDateRange(range);

    // Add debugging
    console.log('Reports Debug:', {
      clinicId,
      type,
      range,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startDateStr,
      endDateStr
    });

    // Get all report data for all tabs
    const [overviewData, patientsData, financialData, visitsData, performanceData] = await Promise.all([
      getOverviewReport(clinicId, startDate, endDate, startDateStr, endDateStr),
      getPatientsReport(clinicId, startDate, endDate),
      getFinancialReport(clinicId, startDate, endDate, startDateStr, endDateStr),
      getVisitsReport(clinicId, startDate, endDate),
      getPerformanceReport(clinicId, startDate, endDate)
    ]);

    // Structure the data as the frontend expects
    const reportData = {
      overview: overviewData,
      patients: patientsData,
      financial: financialData,
      visits: visitsData,
      performance: performanceData
    };

    // Add debugging for the result
    console.log('Report Data:', JSON.stringify(reportData, null, 2));

    res.json({ data: reportData });
  } catch (error) {
    console.error('Error getting reports:', error);
    res.status(500).json({ error: 'Failed to get reports' });
  }
}

// Export report in various formats
export async function exportReport(req, res) {
  try {
    // Auth and clinic access already verified by middleware
    const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
    const { type = 'overview', range = 'month', format = 'csv' } = req.query;

    // Calculate date range
    const { startDate, endDate, startDateStr, endDateStr } = calculateDateRange(range);

    // Get report data
    let reportData = {};
    switch (type) {
      case 'overview':
        reportData = await getOverviewReport(clinicId, startDate, endDate, startDateStr, endDateStr);
        break;
      case 'patients':
        reportData = await getPatientsReport(clinicId, startDate, endDate);
        break;
      case 'financial':
        reportData = await getFinancialReport(clinicId, startDate, endDate, startDateStr, endDateStr);
        break;
      case 'visits':
        reportData = await getVisitsReport(clinicId, startDate, endDate);
        break;
      case 'performance':
        reportData = await getPerformanceReport(clinicId, startDate, endDate);
        break;
      default:
        reportData = await getOverviewReport(clinicId, startDate, endDate, startDateStr, endDateStr);
    }

    // Generate export based on format
    if (format === 'csv') {
      const csvContent = generateCSV(reportData, type, range, startDateStr, endDateStr);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${startDateStr}_to_${endDateStr}.csv"`);
      
      res.send(csvContent);
    } else if (format === 'json') {
      // Set headers for JSON download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${startDateStr}_to_${endDateStr}.json"`);
      
      res.json({
        reportType: type,
        dateRange: range,
        startDate: startDateStr,
        endDate: endDateStr,
        generatedAt: new Date().toISOString(),
        data: reportData
      });
    } else {
      res.status(400).json({ error: 'Unsupported format. Use "csv" or "json"' });
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
}

// Test endpoint to check all data without date filtering
export async function testData(req, res) {
  try {
    const clinicId = req.userClinic.id;
    
    console.log('Testing data for clinic:', clinicId);

    // Get all data without date filters
    const [patientsCount, appointmentsCount, invoicesCount, visitsCount, paymentsCount] = await Promise.all([
      db.select({ count: count() }).from(patients).where(eq(patients.clinicId, clinicId)),
      db.select({ count: count() }).from(appointments).where(eq(appointments.clinicId, clinicId)),
      db.select({ count: count() }).from(invoices).where(eq(invoices.clinicId, clinicId)),
      db.select({ count: count() }).from(visits).where(eq(visits.clinicId, clinicId)),
      db.select({ count: count() }).from(payments).innerJoin(invoices, eq(payments.invoiceId, invoices.id)).where(eq(invoices.clinicId, clinicId))
    ]);

    // Get some sample data to see what's there
    const samplePatients = await db.select().from(patients).where(eq(patients.clinicId, clinicId)).limit(3);
    const sampleAppointments = await db.select().from(appointments).where(eq(appointments.clinicId, clinicId)).limit(3);
    const sampleInvoices = await db.select().from(invoices).where(eq(invoices.clinicId, clinicId)).limit(3);

    const result = {
      counts: {
        patients: patientsCount[0]?.count || 0,
        appointments: appointmentsCount[0]?.count || 0,
        invoices: invoicesCount[0]?.count || 0,
        visits: visitsCount[0]?.count || 0,
        payments: paymentsCount[0]?.count || 0
      },
      samples: {
        patients: samplePatients,
        appointments: sampleAppointments,
        invoices: sampleInvoices
      }
    };

    console.log('Test Data Result:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error('Error testing data:', error);
    res.status(500).json({ error: 'Failed to test data' });
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
    case 'all': // Add option for all time data
      startDate = new Date('2020-01-01'); // Very old date to get all data
      break;
    default:
      startDate.setMonth(now.getMonth() - 1);
  }

  console.log('Date Range Calculation:', {
    range,
    startDate: startDate.toISOString(),
    endDate: now.toISOString(),
    startDateStr: startDate.toISOString().split('T')[0],
    endDateStr: now.toISOString().split('T')[0]
  });

  // Return both Date objects (for timestamp fields) and date strings (for date fields)
  return { 
    startDate, 
    endDate: now,
    startDateStr: startDate.toISOString().split('T')[0],
    endDateStr: now.toISOString().split('T')[0]
  };
}

// Overview report with key metrics - Enhanced for Iraq market
async function getOverviewReport(clinicId, startDate, endDate, startDateStr, endDateStr) {
  try {
    console.log('Overview Report Debug - Date Range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startDateStr,
      endDateStr
    });

    // First, let's check if there's any data at all for this clinic
    const allPatientsCheck = await db
      .select({ count: count() })
      .from(patients)
      .where(eq(patients.clinicId, clinicId));

    const allAppointmentsCheck = await db
      .select({ count: count() })
      .from(appointments)
      .where(eq(appointments.clinicId, clinicId));

    const allInvoicesCheck = await db
      .select({ count: count() })
      .from(invoices)
      .where(eq(invoices.clinicId, clinicId));

    const allVisitsCheck = await db
      .select({ count: count() })
      .from(visits)
      .where(eq(visits.clinicId, clinicId));

    console.log('Data Check - All Time:', {
      patients: allPatientsCheck[0]?.count || 0,
      appointments: allAppointmentsCheck[0]?.count || 0,
      invoices: allInvoicesCheck[0]?.count || 0,
      visits: allVisitsCheck[0]?.count || 0
    });

    // Get total patients (all time, no date filter)
    const totalPatientsResult = await db
      .select({ count: count() })
      .from(patients)
      .where(eq(patients.clinicId, clinicId));

    console.log('Total Patients Result:', totalPatientsResult);

    // Get visits in date range (using Date objects for timestamp field)
    const visitsResult = await db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      );

    console.log('Visits Result:', visitsResult);

    // Get total revenue from payments by joining with invoices (using Date objects)
    const revenueResult = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          gte(payments.paymentDate, startDateStr),
          lte(payments.paymentDate, endDateStr)
        )
      );

    console.log('Revenue Result:', revenueResult);

    // Get completed visits
    const completedVisitsResult = await db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          eq(visits.status, 'completed'),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      );

    console.log('Completed Visits Result:', completedVisitsResult);

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

    console.log('New Patients Result:', newPatientsResult);

    // Get visits in date range (already calculated above)
    console.log('Visits Result (reusing):', visitsResult);

    // Get staff count
    const staffResult = await db
      .select({ count: count() })
      .from(userRoles)
      .where(and(
        eq(userRoles.clinicId, clinicId),
        eq(userRoles.isActive, true)
      ));

    console.log('Staff Result:', staffResult);

    // Calculate average wait time (placeholder - would need actual wait time data)
    const averageWaitTime = 15; // minutes

    // Calculate patient satisfaction (placeholder - would need survey data)
    const patientSatisfaction = 85; // percentage

    // Calculate staff utilization
    const totalStaff = staffResult[0]?.count || 1;
    const staffUtilization = Math.round((completedVisitsResult[0]?.count || 0) / totalStaff);

    const result = {
      totalPatients: totalPatientsResult[0]?.count || 0,
      totalVisits: visitsResult[0]?.count || 0,
      totalRevenue: parseFloat(revenueResult[0]?.total || 0),
      completedVisits: completedVisitsResult[0]?.count || 0,
      newPatients: newPatientsResult[0]?.count || 0,
      averageWaitTime,
      patientSatisfaction,
      staffUtilization,
      averageRevenuePerVisit: visitsResult[0]?.count > 0 ? 
        parseFloat(revenueResult[0]?.total || 0) / visitsResult[0]?.count : 0
    };

    console.log('Overview Report Final Result:', result);
    return result;

  } catch (error) {
    console.error('Error getting overview report:', error);
    return {
      totalPatients: 0,
      totalVisits: 0,
      totalRevenue: 0,
      completedVisits: 0,
      newPatients: 0,
      averageWaitTime: 0,
      patientSatisfaction: 0,
      staffUtilization: 0,
      averageRevenuePerVisit: 0
    };
  }
}

// Patients report - Enhanced with detailed demographics
async function getPatientsReport(clinicId, startDate, endDate) {
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

    // Get patients with visits in date range
    const activePatientsResult = await db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      );

    // Get returning patients (patients with multiple visits)
    const returningPatientsResult = await db
      .select({ count: count() })
      .from(
        db.select({ patientId: visits.patientId })
          .from(visits)
          .where(
            and(
              eq(visits.clinicId, clinicId),
              gte(visits.visitDate, startDate),
              lte(visits.visitDate, endDate)
            )
          )
          .groupBy(visits.patientId)
          .having(sql`count(*) > 1`)
          .as('returning_patients')
      );

    // Get gender distribution
    const genderDistributionResult = await db
      .select({
        gender: patients.gender,
        count: count()
      })
      .from(patients)
      .where(eq(patients.clinicId, clinicId))
      .groupBy(patients.gender);

    // Get age distribution (simplified - would need more complex age calculation)
    const ageDistributionResult = await db
      .select({
        ageGroup: sql`CASE 
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${patients.dateOfBirth})) < 18 THEN 'Under 18'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${patients.dateOfBirth})) BETWEEN 18 AND 30 THEN '18-30'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${patients.dateOfBirth})) BETWEEN 31 AND 50 THEN '31-50'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${patients.dateOfBirth})) BETWEEN 51 AND 65 THEN '51-65'
          ELSE 'Over 65'
        END`,
        count: count()
      })
      .from(patients)
      .where(eq(patients.clinicId, clinicId))
      .groupBy(sql`CASE 
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${patients.dateOfBirth})) < 18 THEN 'Under 18'
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${patients.dateOfBirth})) BETWEEN 18 AND 30 THEN '18-30'
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${patients.dateOfBirth})) BETWEEN 31 AND 50 THEN '31-50'
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${patients.dateOfBirth})) BETWEEN 51 AND 65 THEN '51-65'
        ELSE 'Over 65'
      END`);

    const totalPatients = totalPatientsResult[0]?.count || 0;
    const newPatients = newPatientsResult[0]?.count || 0;
    const activePatients = activePatientsResult[0]?.count || 0;
    const returningPatients = returningPatientsResult[0]?.count || 0;

    return {
      totalPatients,
      newPatients,
      activePatients,
      returningPatients,
      patientRetentionRate: totalPatients > 0 ? 
        Math.round((returningPatients / totalPatients) * 100) : 0,
      genderDistribution: genderDistributionResult.map(item => ({
        gender: item.gender || 'Unknown',
        count: item.count,
        percentage: totalPatients > 0 ? Math.round((item.count / totalPatients) * 100) : 0
      })),
      ageDistribution: ageDistributionResult.map(item => ({
        ageGroup: item.ageGroup,
        count: item.count,
        percentage: totalPatients > 0 ? Math.round((item.count / totalPatients) * 100) : 0
      })),
      appointmentTypes: [], // Would need appointment type data
      topDiagnoses: [] // Would need diagnosis data from visits
    };
  } catch (error) {
    console.error('Error getting patients report:', error);
    return {
      totalPatients: 0,
      newPatients: 0,
      activePatients: 0,
      returningPatients: 0,
      patientRetentionRate: 0,
      genderDistribution: [],
      ageDistribution: [],
      appointmentTypes: [],
      topDiagnoses: []
    };
  }
}

// Financial report - Enhanced for Iraq cash-based market
async function getFinancialReport(clinicId, startDate, endDate, startDateStr, endDateStr) {
  try {
    // Get total revenue from payments by joining with invoices (using Date objects)
    const revenueResult = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          gte(payments.paymentDate, startDateStr),
          lte(payments.paymentDate, endDateStr)
        )
      );

    // Get total invoices
    const invoicesResult = await db
      .select({ count: count(), total: sum(invoices.total) })
      .from(invoices)
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          gte(invoices.issueDate, startDateStr),
          lte(invoices.issueDate, endDateStr)
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
          gte(invoices.issueDate, startDateStr),
          lte(invoices.issueDate, endDateStr)
        )
      );

    // Get outstanding invoices
    const outstandingInvoicesResult = await db
      .select({ count: count(), total: sum(invoices.total) })
      .from(invoices)
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          eq(invoices.status, 'pending'),
          gte(invoices.issueDate, startDateStr),
          lte(invoices.issueDate, endDateStr)
        )
      );

    // Get overdue invoices
    const overdueInvoicesResult = await db
      .select({ count: count(), total: sum(invoices.total) })
      .from(invoices)
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          eq(invoices.status, 'pending'),
          sql`${invoices.dueDate} < CURRENT_DATE`,
          gte(invoices.issueDate, startDateStr),
          lte(invoices.issueDate, endDateStr)
        )
      );

    // Get revenue by service
    const revenueByServiceResult = await db
      .select({
        serviceName: services.name,
        revenue: sum(invoiceItems.total),
        count: count(invoiceItems.id)
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .leftJoin(services, eq(invoiceItems.serviceId, services.id))
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          gte(invoices.issueDate, startDateStr),
          lte(invoices.issueDate, endDateStr)
        )
      )
      .groupBy(services.name)
      .orderBy(desc(sum(invoiceItems.total)))
      .limit(5);

    // Get monthly trends
    const monthlyTrendsResult = await db
      .select({
        month: sql`TO_CHAR(${invoices.issueDate}, 'YYYY-MM')`,
        revenue: sum(invoices.total),
        count: count(invoices.id)
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.clinicId, clinicId),
          gte(invoices.issueDate, startDateStr),
          lte(invoices.issueDate, endDateStr)
        )
      )
      .groupBy(sql`TO_CHAR(${invoices.issueDate}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${invoices.issueDate}, 'YYYY-MM')`));

    const totalRevenue = parseFloat(revenueResult[0]?.total || 0);
    const totalInvoices = invoicesResult[0]?.count || 0;
    const paidInvoices = paidInvoicesResult[0]?.count || 0;
    const outstandingAmount = parseFloat(outstandingInvoicesResult[0]?.total || 0);
    const overdueAmount = parseFloat(overdueInvoicesResult[0]?.total || 0);

    return {
      totalRevenue,
      totalInvoices,
      paidInvoices,
      outstandingInvoices: outstandingInvoicesResult[0]?.count || 0,
      outstandingAmount,
      overdueInvoices: overdueInvoicesResult[0]?.count || 0,
      overdueAmount,
      collectionRate: totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0,
      averageInvoiceValue: totalInvoices > 0 ? parseFloat(invoicesResult[0]?.total || 0) / totalInvoices : 0,
      revenueByService: revenueByServiceResult.map(item => ({
        name: item.serviceName || 'Other Services',
        revenue: parseFloat(item.revenue || 0),
        count: item.count,
        percentage: totalRevenue > 0 ? Math.round((parseFloat(item.revenue || 0) / totalRevenue) * 100) : 0
      })),
      monthlyTrends: monthlyTrendsResult.map(item => ({
        month: item.month,
        revenue: parseFloat(item.revenue || 0),
        count: item.count
      }))
    };
  } catch (error) {
    console.error('Error getting financial report:', error);
    return {
      totalRevenue: 0,
      totalInvoices: 0,
      paidInvoices: 0,
      outstandingInvoices: 0,
      outstandingAmount: 0,
      overdueInvoices: 0,
      overdueAmount: 0,
      collectionRate: 0,
      averageInvoiceValue: 0,
      revenueByService: [],
      monthlyTrends: []
    };
  }
}

// Visits report - Enhanced with detailed patterns
async function getVisitsReport(clinicId, startDate, endDate) {
  try {
    // Get total visits in date range (using Date objects for timestamp field)
    const totalVisitsResult = await db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      );

    // Get completed visits
    const completedResult = await db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          eq(visits.status, 'completed'),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      );

    // Get scheduled visits
    const scheduledResult = await db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          eq(visits.status, 'scheduled'),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      );

    // Get cancelled visits
    const cancelledResult = await db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          eq(visits.status, 'cancelled'),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      );

    // Get no-show visits
    const noShowResult = await db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          eq(visits.status, 'no_show'),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      );

    // Get busy hours analysis
    const busyHoursResult = await db
      .select({
        hour: sql`EXTRACT(HOUR FROM ${visits.visitDate})`,
        count: count()
      })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${visits.visitDate})`)
      .orderBy(desc(count()));

    // Calculate average duration (placeholder - would need actual duration data)
    const averageDuration = 30; // minutes

    return {
      scheduled: scheduledResult[0]?.count || 0,
      completed: completedResult[0]?.count || 0,
      cancelled: cancelledResult[0]?.count || 0,
      noShows: noShowResult[0]?.count || 0,
      averageDuration,
      busyHours: busyHoursResult.map(item => ({
        hour: item.hour,
        count: item.count,
        percentage: totalVisitsResult[0]?.count > 0 ? 
          Math.round((item.count / totalVisitsResult[0]?.count) * 100) : 0
      }))
    };
  } catch (error) {
    console.error('Error getting visits report:', error);
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

// Performance report - Enhanced with detailed metrics
async function getPerformanceReport(clinicId, startDate, endDate) {
  try {
    // Get total visits for throughput calculation (using Date objects for timestamp field)
    const totalVisitsResult = await db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      );

    const completedVisitsResult = await db
      .select({ count: count() })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, clinicId),
          eq(visits.status, 'completed'),
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate)
        )
      );

    const totalStaffResult = await db
      .select({ count: count() })
      .from(userRoles)
      .where(and(
        eq(userRoles.clinicId, clinicId),
        eq(userRoles.isActive, true)
      ));

    // Get visits for throughput calculation (already calculated above as totalVisitsResult)

    // Get prescriptions for quality metrics
    const prescriptionsResult = await db
      .select({ count: count() })
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.clinicId, clinicId),
          gte(prescriptions.prescriptionDate, startDate),
          lte(prescriptions.prescriptionDate, endDate)
        )
      );

    // Get lab orders for quality metrics
    const labOrdersResult = await db
      .select({ count: count() })
      .from(labOrders)
      .where(
        and(
          eq(labOrders.clinicId, clinicId),
          gte(labOrders.orderDate, startDate),
          lte(labOrders.orderDate, endDate)
        )
      );

    const totalVisits = totalVisitsResult[0]?.count || 0;
    const completedVisits = completedVisitsResult[0]?.count || 0;
    const totalStaff = totalStaffResult[0]?.count || 1;

    // Calculate days in range for throughput
    const daysInRange = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 30;

    return {
      patientThroughput: daysInRange > 0 ? Math.round(totalVisits / daysInRange) : 0, // Per day average
      staffProductivity: totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0,
      equipmentUtilization: 75, // Placeholder - would need equipment data
      qualityMetrics: [
        {
          name: 'Prescriptions per Visit',
          value: totalVisits > 0 ? Math.round((prescriptionsResult[0]?.count || 0) / totalVisits * 100) / 100 : 0,
          unit: 'prescriptions'
        },
        {
          name: 'Lab Orders per Visit',
          value: totalVisits > 0 ? Math.round((labOrdersResult[0]?.count || 0) / totalVisits * 100) / 100 : 0,
          unit: 'orders'
        },
        {
          name: 'Completion Rate',
          value: totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0,
          unit: '%'
        }
      ]
    };
  } catch (error) {
    console.error('Error getting performance report:', error);
    return {
      patientThroughput: 0,
      staffProductivity: 0,
      equipmentUtilization: 0,
      qualityMetrics: []
    };
  }
}

// Generate CSV content for export
function generateCSV(data, type, range, startDate, endDate) {
  const headers = ['Report Type', 'Date Range', 'Start Date', 'End Date', 'Generated At'];
  const values = [type, range, startDate, endDate, new Date().toISOString()];
  
  let csvContent = headers.join(',') + '\n';
  csvContent += values.join(',') + '\n\n';
  
  // Add data based on report type
  csvContent += 'Metric,Value\n';
  
  switch (type) {
    case 'overview':
      csvContent += `Total Patients,${data.totalPatients}\n`;
      csvContent += `Total Visits,${data.totalVisits}\n`;
      csvContent += `Total Revenue,${data.totalRevenue}\n`;
      csvContent += `Completed Visits,${data.completedVisits}\n`;
      csvContent += `New Patients,${data.newPatients}\n`;
      csvContent += `Average Wait Time,${data.averageWaitTime} minutes\n`;
      csvContent += `Patient Satisfaction,${data.patientSatisfaction}%\n`;
      csvContent += `Staff Utilization,${data.staffUtilization}\n`;
      csvContent += `Average Revenue Per Visit,${data.averageRevenuePerVisit}\n`;
      break;
      
    case 'patients':
      csvContent += `Total Patients,${data.totalPatients}\n`;
      csvContent += `New Patients,${data.newPatients}\n`;
      csvContent += `Active Patients,${data.activePatients}\n`;
      csvContent += `Returning Patients,${data.returningPatients}\n`;
      csvContent += `Patient Retention Rate,${data.patientRetentionRate}%\n`;
      break;
      
    case 'financial':
      csvContent += `Total Revenue,${data.totalRevenue}\n`;
      csvContent += `Total Invoices,${data.totalInvoices}\n`;
      csvContent += `Paid Invoices,${data.paidInvoices}\n`;
      csvContent += `Outstanding Invoices,${data.outstandingInvoices}\n`;
      csvContent += `Outstanding Amount,${data.outstandingAmount}\n`;
      csvContent += `Overdue Invoices,${data.overdueInvoices}\n`;
      csvContent += `Overdue Amount,${data.overdueAmount}\n`;
      csvContent += `Collection Rate,${data.collectionRate}%\n`;
      csvContent += `Average Invoice Value,${data.averageInvoiceValue}\n`;
      break;
      
    case 'visits':
      csvContent += `Scheduled Visits,${data.scheduled}\n`;
      csvContent += `Completed Visits,${data.completed}\n`;
      csvContent += `Cancelled Visits,${data.cancelled}\n`;
      csvContent += `No Shows,${data.noShows}\n`;
      csvContent += `Average Duration,${data.averageDuration} minutes\n`;
      break;
      
    case 'performance':
      csvContent += `Patient Throughput,${data.patientThroughput} per day\n`;
      csvContent += `Staff Productivity,${data.staffProductivity}%\n`;
      csvContent += `Equipment Utilization,${data.equipmentUtilization}%\n`;
      break;
      
    default:
      csvContent += `Data,${JSON.stringify(data)}\n`;
  }
  
  return csvContent;
} 