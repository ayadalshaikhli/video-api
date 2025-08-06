ALTER TABLE "medical_visits" ADD COLUMN "clinical_findings" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "medical_visits" ADD COLUMN "soap_notes" jsonb DEFAULT '{}'::jsonb;