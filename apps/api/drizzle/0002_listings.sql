CREATE TYPE "public"."closed_reason" AS ENUM('removed', 'used_up');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('available', 'lent_out', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('lend', 'gift', 'trade', 'service');--> statement-breakpoint
CREATE TYPE "public"."loan_length_unit" AS ENUM('hours', 'days', 'weeks');--> statement-breakpoint
CREATE TYPE "public"."session_length_unit" AS ENUM('minutes', 'hours');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('item', 'kg', 'g', 'litre', 'hour', 'portion', 'bag', 'box', 'other');--> statement-breakpoint
CREATE TABLE "listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "listing_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount" numeric(12, 3),
	"unit" "unit",
	"remaining" numeric(12, 3),
	"loan_length" integer,
	"loan_length_unit" "loan_length_unit",
	"wanted" text,
	"wanted_amount" numeric(12, 3),
	"wanted_unit" "unit",
	"open_to_offers" boolean DEFAULT false NOT NULL,
	"session_length" integer,
	"session_length_unit" "session_length_unit",
	"sessions_available" integer,
	"sessions_remaining" integer,
	"area" text,
	"status" "listing_status" DEFAULT 'available' NOT NULL,
	"closed_reason" "closed_reason",
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '') || ' ' || coalesce("wanted", '')), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_title_length" CHECK (char_length("listing"."title") between 1 and 100),
	CONSTRAINT "listing_description_length" CHECK ("listing"."description" is null or char_length("listing"."description") <= 2000),
	CONSTRAINT "listing_wanted_length" CHECK ("listing"."wanted" is null or char_length("listing"."wanted") <= 300),
	CONSTRAINT "listing_area_length" CHECK ("listing"."area" is null or char_length("listing"."area") <= 60),
	CONSTRAINT "listing_positive_numbers" CHECK (
      ("listing"."amount" is null or "listing"."amount" > 0) and ("listing"."remaining" is null or "listing"."remaining" >= 0)
      and ("listing"."wanted_amount" is null or "listing"."wanted_amount" > 0) and ("listing"."loan_length" is null or "listing"."loan_length" > 0)
      and ("listing"."session_length" is null or "listing"."session_length" > 0)
      and ("listing"."sessions_available" is null or "listing"."sessions_available" >= 1)
      and ("listing"."sessions_remaining" is null or "listing"."sessions_remaining" >= 0)),
	CONSTRAINT "listing_units_with_numbers" CHECK (
      ("listing"."amount" is null) = ("listing"."unit" is null)
      and ("listing"."loan_length" is null) = ("listing"."loan_length_unit" is null)
      and ("listing"."wanted_amount" is null) = ("listing"."wanted_unit" is null)
      and ("listing"."session_length" is null) = ("listing"."session_length_unit" is null)),
	CONSTRAINT "listing_fields_match_type" CHECK (
      ("listing"."type" = 'lend' or ("listing"."loan_length" is null))
      and ("listing"."type" = 'trade' or ("listing"."wanted" is null and "listing"."wanted_amount" is null and not "listing"."open_to_offers"))
      and ("listing"."type" = 'service' or ("listing"."session_length" is null and "listing"."sessions_available" is null and "listing"."sessions_remaining" is null))
      and ("listing"."type" <> 'service' or ("listing"."amount" is null))
      and ("listing"."type" in ('gift', 'trade') or "listing"."remaining" is null)),
	CONSTRAINT "listing_trade_wants_something" CHECK ("listing"."type" <> 'trade' or "listing"."wanted" is not null or "listing"."open_to_offers"),
	CONSTRAINT "listing_closed_has_reason" CHECK (("listing"."status" = 'closed') = ("listing"."closed_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "listing_flag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"flagged_by_id" uuid NOT NULL,
	"request" text NOT NULL,
	"seen_by_owner_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_flag_request_length" CHECK (char_length("listing_flag"."request") between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "listing_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"alt_text" text,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_photo_fileKey_unique" UNIQUE("file_key"),
	CONSTRAINT "listing_photo_alt_length" CHECK ("listing_photo"."alt_text" is null or char_length("listing_photo"."alt_text") <= 200)
);
--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_owner_id_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_flag" ADD CONSTRAINT "listing_flag_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_flag" ADD CONSTRAINT "listing_flag_flagged_by_id_member_id_fk" FOREIGN KEY ("flagged_by_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photo" ADD CONSTRAINT "listing_photo_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_search_idx" ON "listing" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "listing_status_created_idx" ON "listing" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "listing_type_idx" ON "listing" USING btree ("type");--> statement-breakpoint
CREATE INDEX "listing_owner_idx" ON "listing" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "listing_flag_listing_idx" ON "listing_flag" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_photo_listing_idx" ON "listing_photo" USING btree ("listing_id");