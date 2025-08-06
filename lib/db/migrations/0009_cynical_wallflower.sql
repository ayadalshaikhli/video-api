CREATE TYPE "public"."visit_origin" AS ENUM('scheduled', 'walk_in');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"appointment_id" uuid,
	"provider_id" uuid,
	"visit_date" timestamp with time zone NOT NULL,
	"visit_type" text NOT NULL,
	"chief_complaint" text,
	"visit_notes" text,
	"diagnosis" jsonb DEFAULT '[]'::jsonb,
	"treatment_plan" text,
	"follow_up_instructions" text,
	"follow_up_date" date,
	"clinical_findings" jsonb DEFAULT '[]'::jsonb,
	"soap_notes" jsonb DEFAULT '{}'::jsonb,
	"origin" "visit_origin" DEFAULT 'scheduled' NOT NULL,
	"status" "visit_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_start" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "medical_visits" CASCADE;