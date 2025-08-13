import { db } from '../lib/db/drizzle.js';
import { activityLogs, auditTrails, systemMetrics, userSessions } from '../lib/db/schema.js';
import { eq, and, gte, lte, desc, count, sql } from 'drizzle-orm';

class ActivityLogger {
  // Log general user activities
  static async logActivity({
    clinicId,
    userId,
    action,
    entityType,
    entityId = null,
    oldValues = null,
    newValues = null,
    description = null,
    ipAddress = null,
    userAgent = null,
    sessionId = null,
    metadata = {}
  }) {
    try {
      await db.insert(activityLogs).values({
        clinicId,
        userId,
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        description,
        ipAddress,
        userAgent,
        sessionId,
        metadata
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  // Log sensitive operations for audit trail
  static async logAuditTrail({
    clinicId,
    userId,
    action,
    resource,
    details,
    riskLevel = 'low'
  }) {
    try {
      await db.insert(auditTrails).values({
        clinicId,
        userId,
        action,
        resource,
        details,
        riskLevel
      });
    } catch (error) {
      console.error('Error logging audit trail:', error);
    }
  }

  // Log system metrics
  static async logSystemMetric({
    clinicId,
    metricType,
    metricName,
    value,
    unit = null,
    metadata = {}
  }) {
    try {
      await db.insert(systemMetrics).values({
        clinicId,
        metricType,
        metricName,
        value,
        unit,
        metadata
      });
    } catch (error) {
      console.error('Error logging system metric:', error);
    }
  }

  // Track user session
  static async trackSession({
    userId,
    clinicId,
    sessionToken,
    ipAddress = null,
    userAgent = null,
    deviceInfo = {}
  }) {
    try {
      await db.insert(userSessions).values({
        userId,
        clinicId,
        sessionToken,
        ipAddress,
        userAgent,
        deviceInfo
      });
    } catch (error) {
      console.error('Error tracking session:', error);
    }
  }

  // Update session activity
  static async updateSessionActivity(sessionToken) {
    try {
      await db.update(userSessions)
        .set({ lastActivity: new Date() })
        .where(eq(userSessions.sessionToken, sessionToken));
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }

  // End user session
  static async endSession(sessionToken) {
    try {
      await db.update(userSessions)
        .set({ 
          logoutTime: new Date(),
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(userSessions.sessionToken, sessionToken));
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  // Get activity logs with filtering
  static async getActivityLogs({
    clinicId,
    userId = null,
    action = null,
    entityType = null,
    startDate = null,
    endDate = null,
    limit = 100,
    offset = 0
  }) {
    try {
      let whereConditions = [eq(activityLogs.clinicId, clinicId)];
      
      if (userId) whereConditions.push(eq(activityLogs.userId, userId));
      if (action) whereConditions.push(eq(activityLogs.action, action));
      if (entityType) whereConditions.push(eq(activityLogs.entityType, entityType));
      if (startDate) whereConditions.push(gte(activityLogs.createdAt, startDate));
      if (endDate) whereConditions.push(lte(activityLogs.createdAt, endDate));

      const logs = await db.select()
        .from(activityLogs)
        .where(and(...whereConditions))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return logs;
    } catch (error) {
      console.error('Error getting activity logs:', error);
      return [];
    }
  }

  // Get audit trails
  static async getAuditTrails({
    clinicId,
    riskLevel = null,
    startDate = null,
    endDate = null,
    limit = 100,
    offset = 0
  }) {
    try {
      let whereConditions = [eq(auditTrails.clinicId, clinicId)];
      
      if (riskLevel) whereConditions.push(eq(auditTrails.riskLevel, riskLevel));
      if (startDate) whereConditions.push(gte(auditTrails.createdAt, startDate));
      if (endDate) whereConditions.push(lte(auditTrails.createdAt, endDate));

      const trails = await db.select()
        .from(auditTrails)
        .where(and(...whereConditions))
        .orderBy(desc(auditTrails.createdAt))
        .limit(limit)
        .offset(offset);

      return trails;
    } catch (error) {
      console.error('Error getting audit trails:', error);
      return [];
    }
  }

  // Get system metrics
  static async getSystemMetrics({
    clinicId,
    metricType = null,
    metricName = null,
    startDate = null,
    endDate = null,
    limit = 100
  }) {
    try {
      let whereConditions = [eq(systemMetrics.clinicId, clinicId)];
      
      if (metricType) whereConditions.push(eq(systemMetrics.metricType, metricType));
      if (metricName) whereConditions.push(eq(systemMetrics.metricName, metricName));
      if (startDate) whereConditions.push(gte(systemMetrics.timestamp, startDate));
      if (endDate) whereConditions.push(lte(systemMetrics.timestamp, endDate));

      const metrics = await db.select()
        .from(systemMetrics)
        .where(and(...whereConditions))
        .orderBy(desc(systemMetrics.timestamp))
        .limit(limit);

      return metrics;
    } catch (error) {
      console.error('Error getting system metrics:', error);
      return [];
    }
  }

  // Get active sessions
  static async getActiveSessions(clinicId) {
    try {
      const sessions = await db.select()
        .from(userSessions)
        .where(and(
          eq(userSessions.clinicId, clinicId),
          eq(userSessions.isActive, true)
        ))
        .orderBy(desc(userSessions.lastActivity));

      return sessions;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  // Get activity summary statistics
  static async getActivitySummary(clinicId, startDate, endDate) {
    try {
      const [totalActivities, uniqueUsers, topActions, topEntities] = await Promise.all([
        // Total activities
        db.select({ count: count() })
          .from(activityLogs)
          .where(and(
            eq(activityLogs.clinicId, clinicId),
            gte(activityLogs.createdAt, startDate),
            lte(activityLogs.createdAt, endDate)
          )),

        // Unique users
        db.select({ count: count() })
          .from(activityLogs)
          .where(and(
            eq(activityLogs.clinicId, clinicId),
            gte(activityLogs.createdAt, startDate),
            lte(activityLogs.createdAt, endDate)
          ))
          .groupBy(activityLogs.userId),

        // Top actions
        db.select({
          action: activityLogs.action,
          count: count()
        })
          .from(activityLogs)
          .where(and(
            eq(activityLogs.clinicId, clinicId),
            gte(activityLogs.createdAt, startDate),
            lte(activityLogs.createdAt, endDate)
          ))
          .groupBy(activityLogs.action)
          .orderBy(desc(count()))
          .limit(5),

        // Top entity types
        db.select({
          entityType: activityLogs.entityType,
          count: count()
        })
          .from(activityLogs)
          .where(and(
            eq(activityLogs.clinicId, clinicId),
            gte(activityLogs.createdAt, startDate),
            lte(activityLogs.createdAt, endDate)
          ))
          .groupBy(activityLogs.entityType)
          .orderBy(desc(count()))
          .limit(5)
      ]);

      return {
        totalActivities: totalActivities[0]?.count || 0,
        uniqueUsers: uniqueUsers.length,
        topActions: topActions,
        topEntities: topEntities
      };
    } catch (error) {
      console.error('Error getting activity summary:', error);
      return {
        totalActivities: 0,
        uniqueUsers: 0,
        topActions: [],
        topEntities: []
      };
    }
  }
}

export default ActivityLogger; 