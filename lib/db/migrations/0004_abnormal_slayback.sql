CREATE TABLE IF NOT EXISTS "captions" (
	"id" serial PRIMARY KEY NOT NULL,
	"composition_id" integer NOT NULL,
	"text" text NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"timestamp_ms" integer,
	"confidence" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compositions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"script" text NOT NULL,
	"voice" varchar(100) NOT NULL,
	"music_url" text,
	"aspect" varchar(10) DEFAULT '9:16' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"final_video_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"composition_id" integer NOT NULL,
	"text" text NOT NULL,
	"start" numeric(10, 3) NOT NULL,
	"end" numeric(10, 3) NOT NULL,
	"media_url" text NOT NULL,
	"animation" varchar(50) DEFAULT 'fade' NOT NULL,
	"style" jsonb DEFAULT '{"fontFamily": "Arial", "fontSize": 24, "color": "#ffffff", "background": "transparent"}' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "captions" ADD CONSTRAINT "captions_composition_id_compositions_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."compositions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compositions" ADD CONSTRAINT "compositions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "segments" ADD CONSTRAINT "segments_composition_id_compositions_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."compositions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
