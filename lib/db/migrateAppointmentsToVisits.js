import { db } from './drizzle.js';
import { visits, appointments, appointmentTypes } from './schema.js';
import { sql } from 'drizzle-orm';

export async function migrateAppointmentsToVisits() {
    console.log('Starting appointment to visits migration...');
    
    try {
        // Insert appointments into visits table
        const result = await db.execute(sql`
            INSERT INTO visits (
                id, 
                clinic_id, 
                patient_id, 
                provider_id, 
                visit_date, 
                visit_type, 
                chief_complaint, 
                origin, 
                status, 
                scheduled_start, 
                created_by, 
                recorded_by, 
                created_at, 
                updated_at
            )
            SELECT 
                gen_random_uuid(), 
                A.clinic_id, 
                A.patient_id, 
                A.doctor_id, 
                A.start_time, 
                COALESCE(AT.name, 'consultation'), 
                A.reason, 
                'scheduled'::visit_origin, 
                CASE 
                    WHEN A.status = 'checked_in' THEN 'checked_in'::visit_status
                    WHEN A.status = 'completed' THEN 'completed'::visit_status
                    WHEN A.status = 'cancelled' THEN 'cancelled'::visit_status
                    WHEN A.status = 'no_show' THEN 'no_show'::visit_status
                    ELSE 'scheduled'::visit_status
                END, 
                A.start_time, 
                A.created_by, 
                A.created_by, 
                A.created_at, 
                A.updated_at
            FROM appointments A
            LEFT JOIN appointment_types AT ON AT.id = A.appointment_type_id
            WHERE A.status IN ('scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')
        `);
        
        console.log('Migration completed successfully!');
        console.log('Rows inserted:', result.rowCount);
        
        return result;
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateAppointmentsToVisits()
        .then(() => {
            console.log('Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
} 