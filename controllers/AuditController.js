import { db } from '../lib/db/drizzle.js';
import { auditLogs, userRoles } from '../lib/db/schema.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';

export const getAuditLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, action, entityType, limit = 50, offset = 0 } = req.query;
    
    // Get user's clinic ID through userRoles
    const userRole = await db
      .select({
        clinicId: userRoles.clinicId
      })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1);

    if (!userRole || userRole.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const clinicId = userRole[0].clinicId;
    
    // Build query conditions
    const conditions = [eq(auditLogs.clinicId, clinicId)];
    
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }
    
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }
    
    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }
    
    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType));
    }
    
    // Get audit logs for the clinic
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql`count(*)` })
      .from(auditLogs)
      .where(and(...conditions));

    res.json({ 
      logs,
      pagination: {
        total: totalCount[0]?.count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
}; 