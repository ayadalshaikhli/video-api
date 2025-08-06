ALTER TABLE "staff_schedules" ADD COLUMN "monday" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD COLUMN "tuesday" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD COLUMN "wednesday" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD COLUMN "thursday" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD COLUMN "friday" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD COLUMN "saturday" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD COLUMN "sunday" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_schedules" DROP COLUMN "day_of_week";