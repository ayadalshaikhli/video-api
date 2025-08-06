import dotenv from 'dotenv';
import path from 'path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { client, db } from './drizzle.js';

dotenv.config();

async function resetDatabase() {
  try {
    console.log('🔄 Resetting database...');
    
    // Drop all tables first (order matters due to foreign keys)
    const dropTables = [
      'appointment_reminders',
      'audit_logs',
      'departments',
      'documents',
      'invoice_items',
      'invoices',
      'lab_order_items',
      'lab_orders',
      'medical_visits',
      'patient_documents',
      'payments',
      'prescription_items',
      'prescriptions',
      'services',
      'staff_schedules',
      'staff_time_off',
      'vitals',
      'appointments',
      'appointment_types',
      'patients',
      'user_roles',
      'profiles',
      'users',
      'clinics'
    ];

    console.log('🗑️  Dropping existing tables...');
    for (const table of dropTables) {
      await client.unsafe(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`   ✓ Dropped table: ${table}`);
    }

    // Drop enums
    console.log('🗑️  Dropping existing enums...');
    await client.unsafe(`DROP TYPE IF EXISTS appointment_status CASCADE`);
    await client.unsafe(`DROP TYPE IF EXISTS user_role CASCADE`);
    console.log('   ✓ Dropped enums');

    // Drop drizzle migration table
    await client.unsafe(`DROP TABLE IF EXISTS __drizzle_migrations CASCADE`);
    console.log('   ✓ Dropped migration table');

    console.log('✅ Database reset complete');
    
    // Run migrations
    console.log('🚀 Running migrations...');
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), '/lib/db/migrations'),
    });
    
    console.log('✅ Migrations complete');
    console.log('🎉 Database is ready!');
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetDatabase(); 