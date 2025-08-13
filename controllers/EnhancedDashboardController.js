import { db } from '../lib/db/drizzle.js';
import { 
  patients, 
  visits, 
  invoices, 
  payments, 
  userRoles, 
  activityLogs,
  userSessions,
  systemMetrics
} from '../lib/db/schema.js';
import { eq, and, gte, lte, desc, count, sum, asc, sql, avg } from 'drizzle-orm';
import ActivityLogger from '../utils/activityLogger.js';

// Helper for date-only columns (e.g., payments.paymentDate)
function toDateYmd(value) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().split('T')[0];
}

// Comprehensive Dashboard Data
export async function getComprehensiveDashboard(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const { range = 'today' } = req.query;

    // Calculate date range
    const { startDate, endDate } = calculateDateRange(range);

    // Get all metrics in parallel
    const [
      visitsData,
      patientsData,
      revenueData,
      staffData,
      efficiencyData
    ] = await Promise.all([
      getVisitsMetrics(clinicId, startDate, endDate),
      getPatientsMetrics(clinicId, startDate, endDate),
      getRevenueMetrics(clinicId, startDate, endDate),
      getStaffMetrics(clinicId),
      getEfficiencyMetrics(clinicId, startDate, endDate)
    ]);

    const dashboardData = {
      visits: visitsData,
      patients: patientsData,
      revenue: revenueData,
      staff: staffData,
      efficiency: efficiencyData,
      summary: {
        totalVisits: visitsData.total,
        totalPatients: patientsData.total,
        totalRevenue: revenueData.total,
        activeStaff: staffData.active,
        completionRate: efficiencyData.completionRate
      }
    };

    res.json({ data: dashboardData });
  } catch (error) {
    console.error('Error getting comprehensive dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
}

// Real-time Metrics
export async function getRealTimeMetrics(req, res) {
  try {
    const clinicId = req.userClinic.id;

    // Get active sessions
    const activeSessions = await ActivityLogger.getActiveSessions(clinicId);
    
    // Get current visits (in progress)
    const currentVisits = await db.select({ count: count() })
      .from(visits)
      .where(and(
        eq(visits.clinicId, clinicId),
        eq(visits.status, 'checked_in')
      ));

    // Get pending tasks (invoices, payments, etc.)
    const pendingInvoices = await db.select({ count: count() })
      .from(invoices)
      .where(and(
        eq(invoices.clinicId, clinicId),
        eq(invoices.status, 'pending')
      ));

    // Get system health
    const systemHealth = await getSystemHealthScore(clinicId);

    const realTimeData = {
      activeUsers: activeSessions.length,
      currentVisits: currentVisits[0]?.count || 0,
      pendingTasks: pendingInvoices[0]?.count || 0,
      systemHealth: systemHealth
    };

    res.json({ data: realTimeData });
  } catch (error) {
    console.error('Error getting real-time metrics:', error);
    res.status(500).json({ error: 'Failed to get real-time metrics' });
  }
}

// Trends Data
export async function getTrendsData(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const { range = 'week' } = req.query;

    const { startDate, endDate } = calculateDateRange(range);
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - 7); // Previous period

    // Get current period data
    const [currentPatients, currentRevenue, currentVisits, currentEfficiency] = await Promise.all([
      getPatientCount(clinicId, startDate, endDate),
      getRevenueTotal(clinicId, startDate, endDate),
      getVisitCount(clinicId, startDate, endDate),
      getEfficiencyRate(clinicId, startDate, endDate)
    ]);

    // Get previous period data
    const [previousPatients, previousRevenue, previousVisits, previousEfficiency] = await Promise.all([
      getPatientCount(clinicId, previousStartDate, startDate),
      getRevenueTotal(clinicId, previousStartDate, startDate),
      getVisitCount(clinicId, previousStartDate, startDate),
      getEfficiencyRate(clinicId, previousStartDate, startDate)
    ]);

    // Calculate growth percentages
    const trendsData = {
      patientGrowth: calculateGrowth(currentPatients, previousPatients),
      revenueGrowth: calculateGrowth(currentRevenue, previousRevenue),
      visitEfficiency: calculateGrowth(currentEfficiency, previousEfficiency),
      staffProductivity: await getStaffProductivityTrend(clinicId, startDate, endDate)
    };

    res.json({ data: trendsData });
  } catch (error) {
    console.error('Error getting trends data:', error);
    res.status(500).json({ error: 'Failed to get trends data' });
  }
}

// Recent Activity
export async function getRecentActivity(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const { limit = 10 } = req.query;

    const activities = await ActivityLogger.getActivityLogs({
      clinicId,
      limit: parseInt(limit),
      offset: 0
    });

    // Format activities for display and to match frontend expectations
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      // Existing fields
      action: activity.action,
      entityType: activity.entityType,
      description: activity.description,
      timestamp: activity.createdAt,
      user: activity.userId,
      metadata: activity.metadata,
      // Fields expected by dashboard formatter
      date: activity.createdAt,
      type: activity.entityType, // e.g., 'visit', 'invoice', 'payment', 'patient'
      title: activity.description || `${activity.action} ${activity.entityType}`,
      status: activity.metadata?.status,
      patientName: activity.metadata?.patientName
    }));

    res.json({ data: formattedActivities });
  } catch (error) {
    console.error('Error getting recent activity:', error);
    res.status(500).json({ error: 'Failed to get recent activity' });
  }
}

// Helper functions
function calculateDateRange(range) {
  const endDate = new Date();
  const startDate = new Date();

  switch (range) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    default:
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

async function getVisitsMetrics(clinicId, startDate, endDate) {
  const [total, completed, scheduled, cancelled] = await Promise.all([
    db.select({ count: count() }).from(visits).where(and(
      eq(visits.clinicId, clinicId),
      gte(visits.visitDate, startDate),
      lte(visits.visitDate, endDate)
    )),
    db.select({ count: count() }).from(visits).where(and(
      eq(visits.clinicId, clinicId),
      eq(visits.status, 'completed'),
      gte(visits.visitDate, startDate),
      lte(visits.visitDate, endDate)
    )),
    db.select({ count: count() }).from(visits).where(and(
      eq(visits.clinicId, clinicId),
      eq(visits.status, 'scheduled'),
      gte(visits.visitDate, startDate),
      lte(visits.visitDate, endDate)
    )),
    db.select({ count: count() }).from(visits).where(and(
      eq(visits.clinicId, clinicId),
      eq(visits.status, 'cancelled'),
      gte(visits.visitDate, startDate),
      lte(visits.visitDate, endDate)
    ))
  ]);

  return {
    total: total[0]?.count || 0,
    completed: completed[0]?.count || 0,
    scheduled: scheduled[0]?.count || 0,
    cancelled: cancelled[0]?.count || 0
  };
}

async function getPatientsMetrics(clinicId, startDate, endDate) {
  const [total, newPatients] = await Promise.all([
    db.select({ count: count() }).from(patients).where(eq(patients.clinicId, clinicId)),
    db.select({ count: count() }).from(patients).where(and(
      eq(patients.clinicId, clinicId),
      gte(patients.createdAt, startDate),
      lte(patients.createdAt, endDate)
    ))
  ]);

  return {
    total: total[0]?.count || 0,
    new: newPatients[0]?.count || 0
  };
}

async function getRevenueMetrics(clinicId, startDate, endDate) {
  const [total, pending] = await Promise.all([
    db.select({ total: sum(payments.amount) })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(and(
        eq(invoices.clinicId, clinicId),
        gte(payments.paymentDate, toDateYmd(startDate)),
        lte(payments.paymentDate, toDateYmd(endDate))
      )),
    db.select({ total: sum(invoices.total) })
      .from(invoices)
      .where(and(
        eq(invoices.clinicId, clinicId),
        eq(invoices.status, 'pending')
      ))
  ]);

  return {
    total: parseFloat(total[0]?.total || 0),
    pending: parseFloat(pending[0]?.total || 0)
  };
}

async function getStaffMetrics(clinicId) {
  const [total, active] = await Promise.all([
    db.select({ count: count() }).from(userRoles).where(eq(userRoles.clinicId, clinicId)),
    db.select({ count: count() }).from(userRoles).where(and(
      eq(userRoles.clinicId, clinicId),
      eq(userRoles.isActive, true)
    ))
  ]);

  return {
    total: total[0]?.count || 0,
    active: active[0]?.count || 0
  };
}

async function getEfficiencyMetrics(clinicId, startDate, endDate) {
  const [total, completed] = await Promise.all([
    db.select({ count: count() }).from(visits).where(and(
      eq(visits.clinicId, clinicId),
      gte(visits.visitDate, startDate),
      lte(visits.visitDate, endDate)
    )),
    db.select({ count: count() }).from(visits).where(and(
      eq(visits.clinicId, clinicId),
      eq(visits.status, 'completed'),
      gte(visits.visitDate, startDate),
      lte(visits.visitDate, endDate)
    ))
  ]);

  const totalVisits = total[0]?.count || 0;
  const completedVisits = completed[0]?.count || 0;

  return {
    completionRate: totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0,
    averageWaitTime: 15, // Placeholder
    patientSatisfaction: 85 // Placeholder
  };
}

async function getSystemHealthScore(clinicId) {
  try {
    const [performanceMetrics, errorMetrics] = await Promise.all([
      ActivityLogger.getSystemMetrics({ clinicId, metricType: 'performance', limit: 10 }),
      ActivityLogger.getSystemMetrics({ clinicId, metricType: 'error', limit: 10 })
    ]);

    let score = 95; // Base score

    // Deduct points for errors
    if (errorMetrics.length > 0) {
      score -= Math.min(errorMetrics.length * 5, 20);
    }

    // Add points for good performance
    const avgResponseTime = performanceMetrics.length > 0 ? 
      performanceMetrics.reduce((sum, m) => sum + parseFloat(m.value), 0) / performanceMetrics.length : 0;
    
    if (avgResponseTime < 500) score += 5;
    else if (avgResponseTime > 1000) score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  } catch (error) {
    return 85; // Default good health
  }
}

async function getPatientCount(clinicId, startDate, endDate) {
  const result = await db.select({ count: count() })
    .from(patients)
    .where(and(
      eq(patients.clinicId, clinicId),
      gte(patients.createdAt, startDate),
      lte(patients.createdAt, endDate)
    ));
  return result[0]?.count || 0;
}

async function getRevenueTotal(clinicId, startDate, endDate) {
  const result = await db.select({ total: sum(payments.amount) })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(
      eq(invoices.clinicId, clinicId),
      gte(payments.paymentDate, toDateYmd(startDate)),
      lte(payments.paymentDate, toDateYmd(endDate))
    ));
  return parseFloat(result[0]?.total || 0);
}

async function getVisitCount(clinicId, startDate, endDate) {
  const result = await db.select({ count: count() })
    .from(visits)
    .where(and(
      eq(visits.clinicId, clinicId),
      gte(visits.visitDate, startDate),
      lte(visits.visitDate, endDate)
    ));
  return result[0]?.count || 0;
}

async function getEfficiencyRate(clinicId, startDate, endDate) {
  const [total, completed] = await Promise.all([
    getVisitCount(clinicId, startDate, endDate),
    db.select({ count: count() })
      .from(visits)
      .where(and(
        eq(visits.clinicId, clinicId),
        eq(visits.status, 'completed'),
        gte(visits.visitDate, startDate),
        lte(visits.visitDate, endDate)
      ))
  ]);
  
  const completedCount = completed[0]?.count || 0;
  return total > 0 ? Math.round((completedCount / total) * 100) : 0;
}

function calculateGrowth(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

async function getStaffProductivityTrend(clinicId, startDate, endDate) {
  const result = await db.select({
    productivity: sql`ROUND(COUNT(${visits.id}) * 100.0 / (COUNT(${userRoles.userId}) * 30), 2)`
  })
  .from(userRoles)
  .leftJoin(visits, and(
    eq(visits.clinicId, userRoles.clinicId),
    gte(visits.visitDate, startDate),
    lte(visits.visitDate, endDate)
  ))
  .where(eq(userRoles.clinicId, clinicId));

  return parseFloat(result[0]?.productivity || 0);
} 