CREATE TYPE "public"."escalation_level" AS ENUM('inviter', 'inviters_inviter', 'founders');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "problem_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_member_id" uuid NOT NULL,
	"description" text NOT NULL,
	"escalation_level" "escalation_level" DEFAULT 'inviter' NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"outcome_note" text,
	"resolved_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_report_description_length" CHECK (char_length("problem_report"."description") between 1 and 2000),
	CONSTRAINT "problem_report_outcome_length" CHECK ("problem_report"."outcome_note" is null or char_length("problem_report"."outcome_note") <= 1000),
	CONSTRAINT "problem_report_resolved_has_note" CHECK ("problem_report"."status" <> 'resolved' or "problem_report"."outcome_note" is not null)
);
--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_agreement_id_agreement_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_reporter_id_member_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_reported_member_id_member_id_fk" FOREIGN KEY ("reported_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_resolved_by_id_member_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "problem_report_agreement_idx" ON "problem_report" USING btree ("agreement_id");--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_problem_report_id_problem_report_id_fk" FOREIGN KEY ("problem_report_id") REFERENCES "public"."problem_report"("id") ON DELETE cascade ON UPDATE no action;