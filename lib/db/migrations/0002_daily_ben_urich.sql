CREATE TABLE "cash_drawers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp with time zone,
	"opening_amount" numeric DEFAULT '0' NOT NULL,
	"closing_amount" numeric,
	"total_cash_collected" numeric DEFAULT '0' NOT NULL,
	"total_card_collected" numeric DEFAULT '0' NOT NULL,
	"total_other_collected" numeric DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"cash_drawer_id" uuid,
	"amount" numeric NOT NULL,
	"payment_method" text NOT NULL,
	"payment_date" date DEFAULT now() NOT NULL,
	"collected_by" uuid NOT NULL,
	"patient_name" text,
	"invoice_number" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
