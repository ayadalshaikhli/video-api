-- Migration: Add staff_invitations table
-- Created: 2025-07-28

CREATE TABLE IF NOT EXISTS "staff_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"code" varchar(8) NOT NULL UNIQUE,
	"role" user_role DEFAULT 'doctor' NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"notes" text,
	"expires_at" timestamp with time zone,
	"is_used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "staff_invitations_code_idx" ON "staff_invitations" ("code");
CREATE INDEX IF NOT EXISTS "staff_invitations_clinic_id_idx" ON "staff_invitations" ("clinic_id");
CREATE INDEX IF NOT EXISTS "staff_invitations_is_used_idx" ON "staff_invitations" ("is_used"); 