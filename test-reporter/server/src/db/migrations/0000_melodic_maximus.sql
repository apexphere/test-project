CREATE TABLE IF NOT EXISTS "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(20) NOT NULL,
	"branch" varchar(255),
	"commit_sha" varchar(40),
	"pr_number" integer,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp NOT NULL,
	"total_tests" integer NOT NULL,
	"passed" integer NOT NULL,
	"failed" integer NOT NULL,
	"skipped" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"test_id" varchar(500) NOT NULL,
	"title" varchar(500) NOT NULL,
	"file" varchar(500) NOT NULL,
	"status" varchar(20) NOT NULL,
	"duration_ms" integer NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_stack" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_stats" (
	"test_id" varchar(500) PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"file" varchar(500) NOT NULL,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"total_passed" integer DEFAULT 0 NOT NULL,
	"total_failed" integer DEFAULT 0 NOT NULL,
	"total_skipped" integer DEFAULT 0 NOT NULL,
	"avg_duration_ms" real DEFAULT 0 NOT NULL,
	"min_duration_ms" integer,
	"max_duration_ms" integer,
	"flakiness_score" real DEFAULT 0 NOT NULL,
	"last_run_at" timestamp,
	"last_status" varchar(20),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_runs_branch" ON "runs" ("branch");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_runs_created" ON "runs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_results_run" ON "test_results" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_results_test" ON "test_results" ("test_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stats_flakiness" ON "test_stats" ("flakiness_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stats_duration" ON "test_stats" ("avg_duration_ms");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_results" ADD CONSTRAINT "test_results_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
