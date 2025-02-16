CREATE TABLE IF NOT EXISTS "banned_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" varchar(200) NOT NULL,
	"reason" text,
	"banned_by" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "banned_wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_authors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"bio" text,
	"profile_image_url" varchar(500),
	"twitter_handle" varchar(50),
	"linkedin_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"meta_title" varchar(70),
	"meta_description" varchar(160),
	"canonical_url" varchar(500),
	"author_id" integer NOT NULL,
	"published_at" timestamp,
	"hero_image_url" varchar(500),
	"og_image_url" varchar(500),
	"seo_description" text DEFAULT '',
	"seo_keywords" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"sol_amount" numeric(20, 9) NOT NULL,
	"credits_purchased" numeric(20, 2) NOT NULL,
	"price_per_credit" numeric(20, 9) NOT NULL,
	"transaction_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_transactions_transaction_hash_unique" UNIQUE("transaction_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"project_id" varchar(50) NOT NULL,
	"credits_spent" numeric(20, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "current_credits" (
	"user_id" varchar(50) PRIMARY KEY NOT NULL,
	"api_key" varchar(50) PRIMARY KEY NOT NULL,
	"total_credits" numeric(20, 2)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_genres" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar(50) NOT NULL,
	"name" varchar(50) NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_genres_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar(50) NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"create_date" timestamp,
	"animation_mode_id" varchar(50),
	"genre_id" varchar(50),
	"resolution_id" varchar(50),
	"project_status_id" varchar(50),
	"generative_video_integration_id" varchar(50),
	"audio_synchronization_id" varchar(50),
	"width" numeric,
	"height" numeric,
	"frames_per_second" numeric,
	"smoothness" numeric,
	"positive_keywords" json,
	"negative_keywords" json,
	"translation" json,
	"rotation" json,
	"dynamic_camera" boolean,
	"oscillation" json,
	"intensity" numeric,
	"audio" json,
	"completed_form" json,
	"video" json,
	"status" varchar(50),
	"minutes" numeric,
	"is_submitted" boolean,
	"user_name" varchar(255),
	"completed_percentage" numeric,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_projects_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "image_credit_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"image_generation_id" integer NOT NULL,
	"credits_spent" numeric(20, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "image_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"prompt" text NOT NULL,
	"model" varchar(50) NOT NULL,
	"image_url" text,
	"generation_duration" integer,
	"cost_credits" numeric(20, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"generation_parameters" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "solana_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"signature" varchar(100) NOT NULL,
	"from_address" varchar(44) NOT NULL,
	"amount" numeric(20, 9) NOT NULL,
	"price_usd" numeric(10, 2),
	"status" varchar(20) NOT NULL,
	"payment_timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "solana_payments_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tweets" (
	"id" serial PRIMARY KEY NOT NULL,
	"tweet_id" varchar(100) NOT NULL,
	"tweet_url" varchar(500),
	"user_id" varchar(100) NOT NULL,
	"username" varchar(100) NOT NULL,
	"display_name" varchar(200),
	"profile_image_url" varchar(500),
	"content" text NOT NULL,
	"tweet_type" varchar(20) NOT NULL,
	"has_image" boolean DEFAULT false NOT NULL,
	"has_video" boolean DEFAULT false NOT NULL,
	"media_urls" jsonb DEFAULT '[]',
	"mentioned_coins" jsonb DEFAULT '[]',
	"mentioned_addresses" jsonb DEFAULT '[]',
	"like_count" integer DEFAULT 0,
	"retweet_count" integer DEFAULT 0,
	"reply_count" integer DEFAULT 0,
	"referenced_tweet_id" varchar(100),
	"tweet_created_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tweets_tweet_id_unique" UNIQUE("tweet_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_audio_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"voice_id" integer,
	"prompt" text,
	"audio_url" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"total_credits" numeric(20, 2) DEFAULT 0 NOT NULL,
	"used_credits" numeric(20, 2) DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"project_id" varchar(50),
	"aws_id" varchar(50),
	"project_name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'Draft' NOT NULL,
	CONSTRAINT "video_projects_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "video_projects_aws_id_unique" UNIQUE("aws_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"video_url" text NOT NULL,
	"prompt" text NOT NULL,
	"keywords" jsonb DEFAULT '[]',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cost_sol" numeric(20, 9) NOT NULL,
	"resolution_id" varchar(50),
	"project_status_id" varchar(50),
	"animation_mode_id" varchar(50),
	"genre_id" varchar(50),
	"width" integer DEFAULT 1920 NOT NULL,
	"height" integer DEFAULT 1080 NOT NULL,
	"frames_per_second" integer DEFAULT 30 NOT NULL,
	"smoothness" integer,
	"intensity" integer,
	"positive_keywords" jsonb DEFAULT '[]',
	"negative_keywords" jsonb DEFAULT '[]',
	"translation" jsonb DEFAULT '[]',
	"rotation" jsonb DEFAULT '[]',
	"dynamic_camera" boolean DEFAULT false,
	"oscillation" boolean,
	"cond_prompt" text,
	"uncond_prompt" text,
	"status" varchar(20) DEFAULT 'Draft' NOT NULL,
	"minutes" numeric(10, 2) DEFAULT 0.04,
	"audio_temp_file_id" varchar(100),
	"audio_filename" varchar(255),
	"audio_url" text,
	"audio_synchronization_id" varchar(50),
	"is_submitted" boolean DEFAULT false,
	"completed_percentage" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"voice_url" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_by" integer,
	"is_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "solana_wallet_address" varchar(44);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "last_payment_type" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "solana_wallet_address" varchar(44);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "banned_wallets" ADD CONSTRAINT "banned_wallets_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_blog_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."blog_authors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_usage" ADD CONSTRAINT "credit_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_usage" ADD CONSTRAINT "credit_usage_project_id_video_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."video_projects"("project_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "image_credit_usage" ADD CONSTRAINT "image_credit_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "image_credit_usage" ADD CONSTRAINT "image_credit_usage_image_generation_id_image_generations_id_fk" FOREIGN KEY ("image_generation_id") REFERENCES "public"."image_generations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "solana_payments" ADD CONSTRAINT "solana_payments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_audio_generations" ADD CONSTRAINT "user_audio_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_audio_generations" ADD CONSTRAINT "user_audio_generations_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "videos" ADD CONSTRAINT "videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "voices" ADD CONSTRAINT "voices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_solana_wallet_address_unique" UNIQUE("solana_wallet_address");