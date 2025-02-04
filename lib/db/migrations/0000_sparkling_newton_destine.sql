CREATE TABLE IF NOT EXISTS "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boost_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_boost_id" integer,
	"amount" numeric(20, 10) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"boost_identifier" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boosted_token_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"boost_event_id" integer,
	"token_boost_id" integer,
	"schema_version" text,
	"chain_id" text NOT NULL,
	"dex_id" text NOT NULL,
	"url" text,
	"pair_address" text NOT NULL,
	"labels" jsonb,
	"base_token_address" text NOT NULL,
	"base_token_name" text NOT NULL,
	"base_token_symbol" text NOT NULL,
	"quote_token_address" text NOT NULL,
	"quote_token_name" text NOT NULL,
	"quote_token_symbol" text NOT NULL,
	"price_native" text,
	"price_usd" text,
	"liquidity_usd" numeric(20, 2),
	"liquidity_base" numeric(20, 8),
	"liquidity_quote" numeric(20, 8),
	"fdv" numeric(20, 2),
	"market_cap" numeric(20, 2),
	"image_url" text,
	"websites" jsonb,
	"socials" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coin_holders" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_id" integer NOT NULL,
	"address" varchar(100) NOT NULL,
	"balance" numeric(30, 0) NOT NULL,
	"percentage" numeric(5, 2),
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coin_mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_id" integer NOT NULL,
	"mention_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coin_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_id" integer NOT NULL,
	"price" numeric(20, 10) NOT NULL,
	"volume" numeric(20, 2),
	"liquidity" numeric(20, 2),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coin_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_id" integer NOT NULL,
	"mention_count" integer DEFAULT 0 NOT NULL,
	"sentiment_score" numeric(5, 2) DEFAULT 0 NOT NULL,
	"rating" integer NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coin_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_id" integer NOT NULL,
	"source_name" varchar(50) NOT NULL,
	"source_id" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coins" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"description" text,
	"contract_address" varchar(100) NOT NULL,
	"blockchain" varchar(50) DEFAULT 'solana' NOT NULL,
	"market_cap" numeric(20, 2),
	"price" numeric(20, 10),
	"liquidity" numeric(20, 2),
	"pair_address" varchar(100),
	"dex_id" varchar(50),
	"twitter" varchar(255),
	"telegram" varchar(255),
	"website" varchar(255),
	"discord" varchar(255),
	"total_supply" numeric(30, 0),
	"circulating_supply" numeric(30, 0),
	"launch_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"invited_by" integer NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255),
	"url" text NOT NULL,
	"source" varchar(100),
	"content" text,
	"author" varchar(100),
	"published_at" timestamp,
	"sentiment_score" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mentions_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"source" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"published_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pump_fun" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"uri" varchar(255) NOT NULL,
	"update_authority_address" varchar(100) NOT NULL,
	"creators" jsonb DEFAULT '[]',
	"collection" jsonb,
	"uses" jsonb,
	"address" varchar(100) NOT NULL,
	"mint_model" varchar(50) DEFAULT 'mint' NOT NULL,
	"mint_address" varchar(100) NOT NULL,
	"mint_authority_address" varchar(100),
	"freeze_authority_address" varchar(100),
	"decimals" integer DEFAULT 6 NOT NULL,
	"supply_basis_points" numeric(30, 0) NOT NULL,
	"is_wrapped_sol" boolean DEFAULT false NOT NULL,
	"currency_symbol" varchar(20) NOT NULL,
	"currency_decimals" integer DEFAULT 6 NOT NULL,
	"currency_namespace" varchar(50) DEFAULT 'spl-token' NOT NULL,
	"blockchain" varchar(50) DEFAULT 'solana' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pump_fun_mint_address_unique" UNIQUE("mint_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "solana_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"price" numeric(20, 10) NOT NULL,
	"open_price" numeric(20, 10) NOT NULL,
	"high_price" numeric(20, 10) NOT NULL,
	"low_price" numeric(20, 10) NOT NULL,
	"volume" numeric(20, 2),
	"change_percentage" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"role" varchar(50) NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_product_id" text,
	"plan_name" varchar(50),
	"subscription_status" varchar(20),
	CONSTRAINT "teams_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "teams_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_boosts" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_address" varchar(100) NOT NULL,
	"pair_address" varchar(100),
	"chain_id" varchar(50) NOT NULL,
	"cumulative_amount" numeric(20, 10) DEFAULT 0 NOT NULL,
	"total_boosts" integer DEFAULT 0 NOT NULL,
	"icon" varchar(255),
	"header" varchar(255),
	"description" text,
	"links" jsonb,
	"token_created_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_address" varchar(100) NOT NULL,
	"chain_id" varchar(50) NOT NULL,
	"type" varchar(50),
	"status" varchar(20),
	"payment_timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_address" varchar(100) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"price_usd" numeric(20, 10),
	"liquidity_usd" numeric(20, 2),
	"market_cap" numeric(20, 2)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_address" varchar(100) NOT NULL,
	"chain_id" varchar(50) NOT NULL,
	"icon" varchar(255),
	"description" text,
	"links" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "token_profiles_token_address_unique" UNIQUE("token_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"signature" text NOT NULL,
	"token_address" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric NOT NULL,
	"price" numeric NOT NULL,
	"value" numeric NOT NULL,
	"timestamp" timestamp NOT NULL,
	"wallet" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "token_transactions_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" varchar(100),
	"address" varchar(200),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"color" varchar(7) DEFAULT '#000000' NOT NULL,
	"tags" jsonb DEFAULT '[]',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100),
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boost_events" ADD CONSTRAINT "boost_events_token_boost_id_token_boosts_id_fk" FOREIGN KEY ("token_boost_id") REFERENCES "public"."token_boosts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boosted_token_info" ADD CONSTRAINT "boosted_token_info_boost_event_id_boost_events_id_fk" FOREIGN KEY ("boost_event_id") REFERENCES "public"."boost_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boosted_token_info" ADD CONSTRAINT "boosted_token_info_token_boost_id_token_boosts_id_fk" FOREIGN KEY ("token_boost_id") REFERENCES "public"."token_boosts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coin_holders" ADD CONSTRAINT "coin_holders_coin_id_coins_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coins"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coin_mentions" ADD CONSTRAINT "coin_mentions_coin_id_coins_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coins"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coin_mentions" ADD CONSTRAINT "coin_mentions_mention_id_mentions_id_fk" FOREIGN KEY ("mention_id") REFERENCES "public"."mentions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coin_prices" ADD CONSTRAINT "coin_prices_coin_id_coins_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coins"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coin_ratings" ADD CONSTRAINT "coin_ratings_coin_id_coins_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coins"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coin_sources" ADD CONSTRAINT "coin_sources_coin_id_coins_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coins"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
