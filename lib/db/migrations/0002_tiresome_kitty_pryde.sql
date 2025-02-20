CREATE TABLE IF NOT EXISTS "caption_styles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"font_file_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_admin_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "caption_styles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "short_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"project_title" text NOT NULL,
	"video_topic" text NOT NULL,
	"generated_script" text NOT NULL,
	"video_style_id" integer,
	"voice_id" integer NOT NULL,
	"caption_style_id" integer NOT NULL,
	"video_url" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_styles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"image_url" text,
	"description" text,
	"prompts" jsonb DEFAULT '[]',
	"sdxl_params" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"is_admin_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_styles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "voices" ALTER COLUMN "name" SET DATA TYPE varchar(100);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "short_videos" ADD CONSTRAINT "short_videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "short_videos" ADD CONSTRAINT "short_videos_video_style_id_video_styles_id_fk" FOREIGN KEY ("video_style_id") REFERENCES "public"."video_styles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "short_videos" ADD CONSTRAINT "short_videos_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "short_videos" ADD CONSTRAINT "short_videos_caption_style_id_caption_styles_id_fk" FOREIGN KEY ("caption_style_id") REFERENCES "public"."caption_styles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
