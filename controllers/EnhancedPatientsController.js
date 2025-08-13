import { db } from '../lib/db/drizzle.js';
import { 
  patients, 
  visits, 
  invoices, 
  payments, 
  profiles 
} from '../lib/db/schema.js';
import { eq, and, gte, lte, desc, count, sum, asc, sql, avg } from 'drizzle-orm';

// Patient Analytics
export async function getPatientAnalytics(req, res) {
  try {
    const clinicId = req.userClinic.id;

    // Get current month dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get total patients
    const totalPatientsResult = await db.select({ count: count() })
      .from(patients)
      .where(eq(patients.clinicId, clinicId));

    // Get new patients this month
    const newThisMonthResult = await db.select({ count: count() })
      .from(patients)
      .where(and(
        eq(patients.clinicId, clinicId),
        gte(patients.createdAt, startOfMonth),
        lte(patients.createdAt, endOfMonth)
      ));

    // Get returning patients (patients with more than 1 visit)
    const returningPatientsResult = await db.select({
      patientCount: count(sql`DISTINCT ${patients.id}`)
    })
    .from(patients)
    .innerJoin(visits, eq(patients.id, visits.patientId))
    .where(eq(patients.clinicId, clinicId))
    .groupBy(patients.id)
    .having(sql`COUNT(${visits.id}) > 1`);

    // Get average visits per patient
    const avgVisitsResult = await db.select({
      avgVisits: avg(sql`visit_count`)
    })
    .from(
      db.select({
        patientId: patients.id,
        visitCount: count(visits.id)
      })
      .from(patients)
      .leftJoin(visits, eq(patients.id, visits.patientId))
      .where(eq(patients.clinicId, clinicId))
      .groupBy(patients.id)
      .as('patient_visits')
    );

    // Get retention rate (patients who visited in last 30 days / total patients)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentVisitorsResult = await db.select({
      count: count(sql`DISTINCT ${patients.id}`)
    })
    .from(patients)
    .innerJoin(visits, eq(patients.id, visits.patientId))
    .where(and(
      eq(patients.clinicId, clinicId),
      gte(visits.visitDate, thirtyDaysAgo)
    ));

    // Get average lifetime value
    const lifetimeValueResult = await db.select({
      avgValue: avg(sql`total_paid`)
    })
    .from(
      db.select({
        patientId: patients.id,
        totalPaid: sum(payments.amount)
      })
      .from(patients)
      .leftJoin(visits, eq(patients.id, visits.patientId))
      .leftJoin(invoices, eq(visits.id, invoices.visitId))
      .leftJoin(payments, eq(invoices.id, payments.invoiceId))
      .where(eq(patients.clinicId, clinicId))
      .groupBy(patients.id)
      .as('patient_value')
    );

    const analytics = {
      totalPatients: totalPatientsResult[0]?.count || 0,
      newThisMonth: newThisMonthResult[0]?.count || 0,
      returningPatients: returningPatientsResult.length,
      averageVisitsPerPatient: Math.round(parseFloat(avgVisitsResult[0]?.avgVisits || 0) * 100) / 100,
      retentionRate: totalPatientsResult[0]?.count > 0 ? 
        Math.round((recentVisitorsResult[0]?.count / totalPatientsResult[0].count) * 100) : 0,
      lifetimeValue: Math.round(parseFloat(lifetimeValueResult[0]?.avgValue || 0) * 100) / 100
    };

    res.json({ data: analytics });
  } catch (error) {
    console.error('Error getting patient analytics:', error);
    res.status(500).json({ error: 'Failed to get patient analytics' });
  }
}

// Patient Demographics
export async function getPatientDemographics(req, res) {
  try {
    const clinicId = req.userClinic.id;

    // Get age distribution
    const ageDistribution = await db.select({
      ageGroup: sql`CASE 
        WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) < 18 THEN 'Under 18'
        WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) BETWEEN 18 AND 30 THEN '18-30'
        WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) BETWEEN 31 AND 50 THEN '31-50'
        WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) BETWEEN 51 AND 65 THEN '51-65'
        ELSE '65+'
      END`,
      count: count(sql`DISTINCT ${patients.id}`)
    })
    .from(patients)
    .innerJoin(profiles, eq(patients.userId, profiles.userId))
    .where(eq(patients.clinicId, clinicId))
    .groupBy(sql`CASE 
      WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) < 18 THEN 'Under 18'
      WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) BETWEEN 18 AND 30 THEN '18-30'
      WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) BETWEEN 31 AND 50 THEN '31-50'
      WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) BETWEEN 51 AND 65 THEN '51-65'
      ELSE '65+'
    END`)
    .orderBy(asc(sql`CASE 
      WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) < 18 THEN 'Under 18'
      WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) BETWEEN 18 AND 30 THEN '18-30'
      WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) BETWEEN 31 AND 50 THEN '31-50'
      WHEN EXTRACT(YEAR FROM AGE(${profiles.dateOfBirth})) BETWEEN 51 AND 65 THEN '51-65'
      ELSE '65+'
    END`));

    // Get gender distribution
    const genderDistribution = await db.select({
      gender: profiles.gender,
      count: count(sql`DISTINCT ${patients.id}`)
    })
    .from(patients)
    .innerJoin(profiles, eq(patients.userId, profiles.userId))
    .where(eq(patients.clinicId, clinicId))
    .groupBy(profiles.gender)
    .orderBy(desc(count(sql`DISTINCT ${patients.id}`)));

    const demographics = {
      ageGroups: ageDistribution.map(item => ({
        group: item.ageGroup,
        count: item.count,
        percentage: 0 // Will be calculated on frontend
      })),
      genderDistribution: genderDistribution.map(item => ({
        gender: item.gender || 'Unknown',
        count: item.count,
        percentage: 0 // Will be calculated on frontend
      }))
    };

    res.json({ data: demographics });
  } catch (error) {
    console.error('Error getting patient demographics:', error);
    res.status(500).json({ error: 'Failed to get patient demographics' });
  }
}

// Top Patients by Revenue
export async function getTopPatients(req, res) {
  try {
    const clinicId = req.userClinic.id;
    const { limit = 10 } = req.query;

    const topPatients = await db.select({
      patientId: patients.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      totalRevenue: sum(payments.amount),
      visitCount: count(sql`DISTINCT ${visits.id}`),
      lastVisit: sql`MAX(${visits.visitDate})`
    })
    .from(patients)
    .innerJoin(profiles, eq(patients.userId, profiles.userId))
    .leftJoin(visits, eq(patients.id, visits.patientId))
    .leftJoin(invoices, eq(visits.id, invoices.visitId))
    .leftJoin(payments, eq(invoices.id, payments.invoiceId))
    .where(eq(patients.clinicId, clinicId))
    .groupBy(patients.id, profiles.firstName, profiles.lastName)
    .orderBy(desc(sum(payments.amount)))
    .limit(parseInt(limit));

    const formattedPatients = topPatients.map(patient => ({
      id: patient.patientId,
      name: `${patient.firstName} ${patient.lastName}`,
      totalRevenue: parseFloat(patient.totalRevenue || 0),
      visitCount: patient.visitCount,
      lastVisit: patient.lastVisit,
      averageRevenue: patient.visitCount > 0 ? 
        parseFloat(patient.totalRevenue || 0) / patient.visitCount : 0
    }));

    res.json({ data: formattedPatients });
  } catch (error) {
    console.error('Error getting top patients:', error);
    res.status(500).json({ error: 'Failed to get top patients' });
  }
} 