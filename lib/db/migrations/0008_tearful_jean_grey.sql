ALTER TYPE "public"."appointment_status" ADD VALUE 'checked_in' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "checked_in_at" timestamp with time zone;