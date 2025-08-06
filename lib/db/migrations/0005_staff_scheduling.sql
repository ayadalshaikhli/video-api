-- Migration: Add staff scheduling tables
-- Created: 2025-07-28

-- Create shift_types table
CREATE TABLE IF NOT EXISTS "shift_types" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "clinic_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "start_time" time NOT NULL,
    "end_time" time NOT NULL,
    "color" varchar(7),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create staff_schedules table
CREATE TABLE IF NOT EXISTS "staff_schedules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "clinic_id" uuid NOT NULL,
    "shift_type_id" uuid,
    "day_of_week" integer NOT NULL,
    "start_time" time NOT NULL,
    "end_time" time NOT NULL,
    "is_recurring" boolean DEFAULT true NOT NULL,
    "start_date" date,
    "end_date" date,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create schedule_overrides table
CREATE TABLE IF NOT EXISTS "schedule_overrides" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "clinic_id" uuid NOT NULL,
    "date" date NOT NULL,
    "original_start_time" time,
    "original_end_time" time,
    "new_start_time" time,
    "new_end_time" time,
    "reason" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Update existing staff_time_off table
ALTER TABLE "staff_time_off" 
ADD COLUMN IF NOT EXISTS "start_time" time,
ADD COLUMN IF NOT EXISTS "end_time" time,
ADD COLUMN IF NOT EXISTS "type" varchar(50) DEFAULT 'vacation' NOT NULL,
ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'pending' NOT NULL;

-- Add foreign key constraints
ALTER TABLE "shift_types" ADD CONSTRAINT "shift_types_clinic_id_clinics_id_fk" 
FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_user_id_users_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_clinic_id_clinics_id_fk" 
FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_shift_type_id_shift_types_id_fk" 
FOREIGN KEY ("shift_type_id") REFERENCES "shift_types"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_user_id_users_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_clinic_id_clinics_id_fk" 
FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "shift_types_clinic_id_idx" ON "shift_types" ("clinic_id");
CREATE INDEX IF NOT EXISTS "staff_schedules_user_id_idx" ON "staff_schedules" ("user_id");
CREATE INDEX IF NOT EXISTS "staff_schedules_clinic_id_idx" ON "staff_schedules" ("clinic_id");
CREATE INDEX IF NOT EXISTS "staff_schedules_day_of_week_idx" ON "staff_schedules" ("day_of_week");
CREATE INDEX IF NOT EXISTS "schedule_overrides_user_id_idx" ON "schedule_overrides" ("user_id");
CREATE INDEX IF NOT EXISTS "schedule_overrides_date_idx" ON "schedule_overrides" ("date");
CREATE INDEX IF NOT EXISTS "staff_time_off_user_id_idx" ON "staff_time_off" ("user_id");
CREATE INDEX IF NOT EXISTS "staff_time_off_status_idx" ON "staff_time_off" ("status"); 