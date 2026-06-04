CREATE TYPE "public"."agreement_confirmation" AS ENUM('pending', 'confirmed', 'disputed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."agreement_outcome" AS ENUM('lent', 'gifted', 'traded', 'provided');--> statement-breakpoint
CREATE TABLE "agreement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"other_member_id" uuid NOT NULL,
	"outcome" "agreement_outcome" NOT NULL,
	"amount" numeric(12, 3),
	"sessions" integer,
	"return_due" date,
	"returned_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"confirmation" "agreement_confirmation" DEFAULT 'pending' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_not_with_self" CHECK ("agreement"."owner_id" <> "agreement"."other_member_id"),
	CONSTRAINT "agreement_amount_positive" CHECK ("agreement"."amount" is null or "agreement"."amount" > 0),
	CONSTRAINT "agreement_sessions_positive" CHECK ("agreement"."sessions" is null or "agreement"."sessions" >= 1),
	CONSTRAINT "agreement_loan_has_return_date" CHECK ("agreement"."outcome" <> 'lent' or "agreement"."return_due" is not null),
	CONSTRAINT "agreement_note_length" CHECK ("agreement"."note" is null or char_length("agreement"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_owner_id_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_other_member_id_member_id_fk" FOREIGN KEY ("other_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agreement_owner_idx" ON "agreement" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "agreement_other_idx" ON "agreement" USING btree ("other_member_id");--> statement-breakpoint
CREATE INDEX "agreement_listing_idx" ON "agreement" USING btree ("listing_id");