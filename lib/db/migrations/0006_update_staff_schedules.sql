-- Migration: Update staff_schedules table for new scheduling structure
-- This migration updates the staff_schedules table to support individual day fields
-- instead of a single day_of_week field

-- First, add the new day columns
ALTER TABLE "staff_schedules" 
ADD COLUMN "monday" boolean DEFAULT false,
ADD COLUMN "tuesday" boolean DEFAULT false,
ADD COLUMN "wednesday" boolean DEFAULT false,
ADD COLUMN "thursday" boolean DEFAULT false,
ADD COLUMN "friday" boolean DEFAULT false,
ADD COLUMN "saturday" boolean DEFAULT false,
ADD COLUMN "sunday" boolean DEFAULT false;

-- Update existing records to set the appropriate day based on day_of_week
UPDATE "staff_schedules" SET 
    "monday" = CASE WHEN "day_of_week" = 1 THEN true ELSE false END,
    "tuesday" = CASE WHEN "day_of_week" = 2 THEN true ELSE false END,
    "wednesday" = CASE WHEN "day_of_week" = 3 THEN true ELSE false END,
    "thursday" = CASE WHEN "day_of_week" = 4 THEN true ELSE false END,
    "friday" = CASE WHEN "day_of_week" = 5 THEN true ELSE false END,
    "saturday" = CASE WHEN "day_of_week" = 6 THEN true ELSE false END,
    "sunday" = CASE WHEN "day_of_week" = 0 THEN true ELSE false END;

-- Make the new day columns NOT NULL after setting default values
ALTER TABLE "staff_schedules" 
ALTER COLUMN "monday" SET NOT NULL,
ALTER COLUMN "tuesday" SET NOT NULL,
ALTER COLUMN "wednesday" SET NOT NULL,
ALTER COLUMN "thursday" SET NOT NULL,
ALTER COLUMN "friday" SET NOT NULL,
ALTER COLUMN "saturday" SET NOT NULL,
ALTER COLUMN "sunday" SET NOT NULL;

-- Drop the old day_of_week column
ALTER TABLE "staff_schedules" DROP COLUMN "day_of_week";

-- Add indexes for better performance
CREATE INDEX "idx_staff_schedules_user_id" ON "staff_schedules" ("user_id");
CREATE INDEX "idx_staff_schedules_clinic_id" ON "staff_schedules" ("clinic_id");
CREATE INDEX "idx_staff_schedules_active" ON "staff_schedules" ("is_active"); 