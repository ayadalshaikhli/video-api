import { db } from '../lib/db/drizzle.js';
import { activityLogs, systemMetrics, userSessions } from '../lib/db/schema.js';
import ActivityLogger from './activityLogger.js';

export async function addSampleData(clinicId) {
  try {
    console.log('Adding sample data for clinic:', clinicId);

    // Add sample activity logs
    const sampleActivities = [
      {
        clinicId,
        userId: '51b2c275-f33d-4464-b43e-56dc6753472b',
        action: 'create',
        entityType: 'patient',
        description: 'Created new patient John Smith',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        metadata: { patientName: 'John Smith' }
      },
      {
        clinicId,
        userId: '51b2c275-f33d-4464-b43e-56dc6753472b',
        action: 'update',
        entityType: 'visit',
        description: 'Updated visit status to completed',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        metadata: { visitId: 'sample-visit-1', status: 'completed' }
      },
      {
        clinicId,
        userId: '51b2c275-f33d-4464-b43e-56dc6753472b',
        action: 'create',
        entityType: 'invoice',
        description: 'Created invoice for visit',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        metadata: { amount: 150, visitId: 'sample-visit-1' }
      },
      {
        clinicId,
        userId: '51b2c275-f33d-4464-b43e-56dc6753472b',
        action: 'view',
        entityType: 'reports',
        description: 'Viewed financial reports',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        metadata: { reportType: 'financial' }
      },
      {
        clinicId,
        userId: '51b2c275-f33d-4464-b43e-56dc6753472b',
        action: 'export',
        entityType: 'reports',
        description: 'Exported patient report',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        metadata: { reportType: 'patients', format: 'pdf' }
      }
    ];

    for (const activity of sampleActivities) {
      await ActivityLogger.logActivity(activity);
    }

    // Add sample system metrics
    const sampleMetrics = [
      {
        clinicId,
        metricType: 'performance',
        metricName: 'api_response_time',
        value: 250,
        unit: 'ms'
      },
      {
        clinicId,
        metricType: 'performance',
        metricName: 'database_query_time',
        value: 45,
        unit: 'ms'
      },
      {
        clinicId,
        metricType: 'usage',
        metricName: 'active_users',
        value: 3,
        unit: 'count'
      },
      {
        clinicId,
        metricType: 'usage',
        metricName: 'daily_visits',
        value: 15,
        unit: 'count'
      },
      {
        clinicId,
        metricType: 'error',
        metricName: 'error_rate',
        value: 0.5,
        unit: 'percentage'
      }
    ];

    for (const metric of sampleMetrics) {
      await ActivityLogger.logSystemMetric(metric);
    }

    // Add sample user session
    await ActivityLogger.trackSession({
      userId: '51b2c275-f33d-4464-b43e-56dc6753472b',
      clinicId,
      sessionToken: 'sample-session-token',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      deviceInfo: { platform: 'iOS', version: '14.0' }
    });

    console.log('Sample data added successfully!');
  } catch (error) {
    console.error('Error adding sample data:', error);
  }
} 