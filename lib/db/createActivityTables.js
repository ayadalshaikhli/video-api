import { db } from './drizzle.js';
import { sql } from 'drizzle-orm';

export async function createActivityTables() {
  try {
    console.log('Creating activity logging tables...');

    // Create activity_logs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID NOT NULL,
        user_id UUID NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        description TEXT,
        ip_address TEXT,
        user_agent TEXT,
        session_id TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      )
    `);

    // Create audit_trails table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_trails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID NOT NULL,
        user_id UUID NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        details JSONB NOT NULL,
        risk_level TEXT DEFAULT 'low',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      )
    `);

    // Create system_metrics table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID NOT NULL,
        metric_type TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value NUMERIC NOT NULL,
        unit TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        metadata JSONB DEFAULT '{}'
      )
    `);

    // Create user_sessions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        clinic_id UUID NOT NULL,
        session_token TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        device_info JSONB DEFAULT '{}',
        login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        logout_time TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true NOT NULL,
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      )
    `);

    console.log('Activity logging tables created successfully!');
  } catch (error) {
    console.error('Error creating activity tables:', error);
  }
} 