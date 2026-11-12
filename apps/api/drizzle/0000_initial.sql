-- btree_gist lets the loan exclusion constraint at the end compare offering ids (it ships with PostgreSQL).
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('message', 'agreement', 'reminder', 'report', 'flag', 'request', 'public_message');--> statement-breakpoint
CREATE TYPE "public"."push_platform" AS ENUM('web');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('unused', 'pending_confirmation', 'used', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."closed_reason" AS ENUM('removed', 'used_up');--> statement-breakpoint
CREATE TYPE "public"."handover" AS ENUM('to_requester', 'at_lister', 'elsewhere', 'online');--> statement-breakpoint
CREATE TYPE "public"."loan_length_unit" AS ENUM('hours', 'days', 'weeks');--> statement-breakpoint
CREATE TYPE "public"."offering_status" AS ENUM('available', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."offering_type" AS ENUM('lend', 'gift', 'trade', 'service');--> statement-breakpoint
CREATE TYPE "public"."session_length_unit" AS ENUM('minutes', 'hours', 'days', 'weeks');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('item', 'kg', 'g', 'lb', 'oz', 'litre', 'hour', 'portion', 'bag', 'box', 'other');--> statement-breakpoint
CREATE TYPE "public"."arrangement_closed_reason" AS ENUM('nothing_left', 'quiet', 'member_left');--> statement-breakpoint
CREATE TYPE "public"."arrangement_status" AS ENUM('open', 'agreed', 'declined', 'withdrawn', 'closed');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'call_accepted', 'system', 'asked', 'detail_changed', 'accepted', 'declined', 'withdrawn', 'closed', 'returned', 'done', 'not_done', 'messages_shared');--> statement-breakpoint
CREATE TYPE "public"."escalation_level" AS ENUM('inviter', 'inviters_inviter', 'founders');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."request_closed_reason" AS ENUM('by_asker', 'agreed', 'account_deleted');--> statement-breakpoint
CREATE TYPE "public"."request_kind" AS ENUM('borrow', 'receive', 'trade', 'service');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"display_name" text NOT NULL,
	"image" text,
	"bio" text,
	"invited_by_id" uuid,
	"is_founder" boolean DEFAULT false NOT NULL,
	"share_phone" text,
	"share_email" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_email_unique" UNIQUE("email"),
	CONSTRAINT "member_display_name_length" CHECK (char_length("member"."display_name") between 1 and 60),
	CONSTRAINT "member_bio_length" CHECK ("member"."bio" is null or char_length("member"."bio") <= 500),
	CONSTRAINT "member_inviter_or_founder" CHECK ("member"."is_founder" or "member"."invited_by_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"conversation_id" uuid,
	"subject_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"email" boolean DEFAULT false NOT NULL,
	"device" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preference_member_type" UNIQUE("member_id","type")
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"platform" "push_platform" DEFAULT 'web' NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text,
	"auth" text,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint"),
	CONSTRAINT "push_subscription_web_keys" CHECK ("push_subscription"."platform" <> 'web' or ("push_subscription"."p256dh" is not null and "push_subscription"."auth" is not null)),
	CONSTRAINT "push_subscription_label_length" CHECK (char_length("push_subscription"."label") between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "rate_limit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"inviter_id" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'unused' NOT NULL,
	"reserved_until" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"used_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "offering" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "offering_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount" numeric(12, 3),
	"unit" "unit",
	"remaining" numeric(12, 3),
	"loan_length" integer,
	"loan_length_unit" "loan_length_unit",
	"session_length" integer,
	"session_length_unit" "session_length_unit",
	"sessions_available" integer,
	"sessions_remaining" integer,
	"handovers" "handover"[] DEFAULT '{}' NOT NULL,
	"area" jsonb,
	"area_neighbourhood" text GENERATED ALWAYS AS (lower("area"->>'neighbourhood')) STORED,
	"area_city" text GENERATED ALWAYS AS (lower("area"->>'city')) STORED,
	"meeting_place" jsonb,
	"status" "offering_status" DEFAULT 'available' NOT NULL,
	"closed_reason" "closed_reason",
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offering_title_length" CHECK (char_length("offering"."title") between 1 and 100),
	CONSTRAINT "offering_description_length" CHECK ("offering"."description" is null or char_length("offering"."description") <= 2000),
	CONSTRAINT "offering_at_lister_has_area" CHECK (not ('at_lister' = any("offering"."handovers")) or "offering"."area" is not null),
	CONSTRAINT "offering_elsewhere_has_place" CHECK (not ('elsewhere' = any("offering"."handovers")) or "offering"."meeting_place" is not null),
	CONSTRAINT "offering_positive_numbers" CHECK (
      ("offering"."amount" is null or "offering"."amount" > 0) and ("offering"."remaining" is null or "offering"."remaining" >= 0)
      and ("offering"."loan_length" is null or "offering"."loan_length" > 0)
      and ("offering"."session_length" is null or "offering"."session_length" > 0)
      and ("offering"."sessions_available" is null or "offering"."sessions_available" >= 1)
      and ("offering"."sessions_remaining" is null or "offering"."sessions_remaining" >= 0)),
	CONSTRAINT "offering_units_with_numbers" CHECK (
      ("offering"."amount" is null) = ("offering"."unit" is null)
      and ("offering"."loan_length" is null) = ("offering"."loan_length_unit" is null)
      and ("offering"."session_length" is null) = ("offering"."session_length_unit" is null)),
	CONSTRAINT "offering_fields_match_type" CHECK (
      ("offering"."type" = 'lend' or ("offering"."loan_length" is null))
      and ("offering"."type" = 'service' or ("offering"."session_length" is null and "offering"."sessions_available" is null and "offering"."sessions_remaining" is null))
      and ("offering"."type" <> 'service' or ("offering"."amount" is null))
      and ("offering"."type" in ('gift', 'trade') or "offering"."remaining" is null)),
	CONSTRAINT "offering_closed_has_reason" CHECK (("offering"."status" = 'closed') = ("offering"."closed_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "offering_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"alt_text" text,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offering_photo_fileKey_unique" UNIQUE("file_key"),
	CONSTRAINT "offering_photo_alt_length" CHECK ("offering_photo"."alt_text" is null or char_length("offering_photo"."alt_text") <= 200)
);
--> statement-breakpoint
CREATE TABLE "service_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_availability_weekday" CHECK ("service_availability"."weekday" between 1 and 7),
	CONSTRAINT "service_availability_times" CHECK ("service_availability"."start_time" < "service_availability"."end_time")
);
--> statement-breakpoint
CREATE TABLE "trade_accept" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 3),
	"unit" "unit",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_accept_position" CHECK ("trade_accept"."position" between 0 and 9),
	CONSTRAINT "trade_accept_description_length" CHECK (char_length("trade_accept"."description") between 1 and 100),
	CONSTRAINT "trade_accept_amount" CHECK (("trade_accept"."amount" is null or "trade_accept"."amount" > 0) and ("trade_accept"."amount" is null) = ("trade_accept"."unit" is null))
);
--> statement-breakpoint
CREATE TABLE "arrangement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"request_id" uuid,
	"status" "arrangement_status" DEFAULT 'open' NOT NULL,
	"closed_reason" "arrangement_closed_reason",
	"version" integer DEFAULT 1 NOT NULL,
	"starts_at" timestamp with time zone,
	"has_time" boolean DEFAULT false NOT NULL,
	"handover" "handover",
	"place" jsonb,
	"loan_length" integer,
	"loan_length_unit" "loan_length_unit",
	"amount" numeric(12, 3),
	"own_offer" text,
	"own_offer_amount" numeric(12, 3),
	"own_offer_unit" "unit",
	"session_length" integer,
	"session_length_unit" "session_length_unit",
	"sessions" integer,
	"decision_note" text,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"agreed_at" timestamp with time zone,
	"agreed_place" jsonb,
	"agreed_offer" jsonb,
	"loan_starts_at" timestamp with time zone,
	"loan_ends_at" timestamp with time zone,
	"loan_period" "tstzrange" GENERATED ALWAYS AS (case when "loan_starts_at" is null then null else tstzrange("loan_starts_at", "loan_ends_at") end) STORED,
	"returned_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"done_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arrangement_closed_has_reason" CHECK (("arrangement"."status" = 'closed') = ("arrangement"."closed_reason" is not null)),
	CONSTRAINT "arrangement_positive_numbers" CHECK (
      ("arrangement"."loan_length" is null or "arrangement"."loan_length" > 0) and ("arrangement"."amount" is null or "arrangement"."amount" > 0)
      and ("arrangement"."own_offer_amount" is null or "arrangement"."own_offer_amount" > 0)
      and ("arrangement"."session_length" is null or "arrangement"."session_length" > 0) and ("arrangement"."sessions" is null or "arrangement"."sessions" >= 1)),
	CONSTRAINT "arrangement_units_with_numbers" CHECK (
      ("arrangement"."loan_length" is null) = ("arrangement"."loan_length_unit" is null)
      and ("arrangement"."session_length" is null) = ("arrangement"."session_length_unit" is null)
      and ("arrangement"."own_offer_amount" is null) = ("arrangement"."own_offer_unit" is null)),
	CONSTRAINT "arrangement_text_lengths" CHECK (
      ("arrangement"."own_offer" is null or char_length("arrangement"."own_offer") <= 300)
      and ("arrangement"."decision_note" is null or char_length("arrangement"."decision_note") <= 500)),
	CONSTRAINT "arrangement_agreed_has_time" CHECK (("arrangement"."status" = 'agreed') = ("arrangement"."agreed_at" is not null)),
	CONSTRAINT "arrangement_record_only_when_agreed" CHECK (
      "arrangement"."status" = 'agreed' or ("arrangement"."agreed_place" is null and "arrangement"."agreed_offer" is null and "arrangement"."loan_starts_at" is null
      and "arrangement"."loan_ends_at" is null and "arrangement"."returned_at" is null and "arrangement"."reminder_sent_at" is null and "arrangement"."done_at" is null)),
	CONSTRAINT "arrangement_loan_period" CHECK (
      ("arrangement"."loan_starts_at" is null) = ("arrangement"."loan_ends_at" is null) and ("arrangement"."loan_starts_at" is null or "arrangement"."loan_starts_at" < "arrangement"."loan_ends_at")),
	CONSTRAINT "arrangement_returned_is_a_loan" CHECK ("arrangement"."returned_at" is null or "arrangement"."loan_starts_at" is not null),
	CONSTRAINT "arrangement_done_is_not_a_loan" CHECK ("arrangement"."done_at" is null or "arrangement"."loan_starts_at" is null),
	CONSTRAINT "arrangement_done_has_who" CHECK (("arrangement"."done_at" is null) = ("arrangement"."done_by_id" is null))
);
--> statement-breakpoint
CREATE TABLE "arrangement_offer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"arrangement_id" uuid NOT NULL,
	"trade_accept_id" uuid NOT NULL,
	"amount" numeric(12, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arrangement_offer_amount" CHECK ("arrangement_offer"."amount" is null or "arrangement_offer"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"arrangement_id" uuid,
	"problem_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_arrangementId_unique" UNIQUE("arrangement_id"),
	CONSTRAINT "conversation_has_one_owner" CHECK (("conversation"."arrangement_id" is null) <> ("conversation"."problem_report_id" is null))
);
--> statement-breakpoint
CREATE TABLE "conversation_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone,
	CONSTRAINT "conversation_participant_pair" UNIQUE("conversation_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_id" uuid,
	"kind" "message_kind" DEFAULT 'text' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"shared_phone" text,
	"shared_email" text,
	"proposed_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_body_length" CHECK (char_length("message"."body") <= 4000)
);
--> statement-breakpoint
CREATE TABLE "problem_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"arrangement_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_member_id" uuid NOT NULL,
	"description" text NOT NULL,
	"escalation_level" "escalation_level" DEFAULT 'inviter' NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"outcome_note" text,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"messages_shared_at" timestamp with time zone,
	"messages_shared_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_report_description_length" CHECK (char_length("problem_report"."description") between 1 and 2000),
	CONSTRAINT "problem_report_outcome_length" CHECK ("problem_report"."outcome_note" is null or char_length("problem_report"."outcome_note") <= 1000),
	CONSTRAINT "problem_report_resolved_has_note" CHECK ("problem_report"."status" <> 'resolved' or "problem_report"."outcome_note" is not null)
);
--> statement-breakpoint
CREATE TABLE "request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asker_id" uuid NOT NULL,
	"kind" "request_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"needed_after" date,
	"needed_by" date,
	"area" jsonb,
	"area_neighbourhood" text GENERATED ALWAYS AS (lower("area"->>'neighbourhood')) STORED,
	"area_city" text GENERATED ALWAYS AS (lower("area"->>'city')) STORED,
	"handovers" "handover"[] DEFAULT '{}' NOT NULL,
	"loan_length" integer,
	"loan_length_unit" "loan_length_unit",
	"amount" numeric(12, 3),
	"unit" "unit",
	"session_length" integer,
	"session_length_unit" "session_length_unit",
	"sessions" integer,
	"status" "request_status" DEFAULT 'open' NOT NULL,
	"closed_reason" "request_closed_reason",
	"closed_by_arrangement_id" uuid,
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_title_length" CHECK (char_length("request"."title") between 1 and 100),
	CONSTRAINT "request_description_length" CHECK ("request"."description" is null or char_length("request"."description") <= 2000),
	CONSTRAINT "request_dates_in_order" CHECK ("request"."needed_after" is null or "request"."needed_by" is null or "request"."needed_by" >= "request"."needed_after"),
	CONSTRAINT "request_positive_numbers" CHECK (
      ("request"."amount" is null or "request"."amount" > 0) and ("request"."loan_length" is null or "request"."loan_length" > 0)
      and ("request"."session_length" is null or "request"."session_length" > 0) and ("request"."sessions" is null or "request"."sessions" >= 1)),
	CONSTRAINT "request_units_with_numbers" CHECK (
      ("request"."amount" is null) = ("request"."unit" is null)
      and ("request"."loan_length" is null) = ("request"."loan_length_unit" is null)
      and ("request"."session_length" is null) = ("request"."session_length_unit" is null)),
	CONSTRAINT "request_fields_match_kind" CHECK (
      ("request"."kind" = 'borrow' or "request"."loan_length" is null)
      and ("request"."kind" in ('receive', 'trade') or "request"."amount" is null)
      and ("request"."kind" = 'service' or ("request"."session_length" is null and "request"."sessions" is null))),
	CONSTRAINT "request_closed_has_reason" CHECK (("request"."status" = 'closed') = ("request"."closed_reason" is not null)),
	CONSTRAINT "request_arrangement_only_when_agreed" CHECK ("request"."closed_by_arrangement_id" is null or "request"."closed_reason" = 'agreed')
);
--> statement-breakpoint
CREATE TABLE "request_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "request_availability_weekday" CHECK ("request_availability"."weekday" between 1 and 7),
	CONSTRAINT "request_availability_times" CHECK ("request_availability"."start_time" < "request_availability"."end_time")
);
--> statement-breakpoint
CREATE TABLE "request_give_back" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 3),
	"unit" "unit",
	CONSTRAINT "request_give_back_position" CHECK ("request_give_back"."position" between 0 and 9),
	CONSTRAINT "request_give_back_description_length" CHECK (char_length("request_give_back"."description") between 1 and 100),
	CONSTRAINT "request_give_back_amount" CHECK (("request_give_back"."amount" is null or "request_give_back"."amount" > 0) and ("request_give_back"."amount" is null) = ("request_give_back"."unit" is null))
);
--> statement-breakpoint
CREATE TABLE "request_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"linked_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_link_once" UNIQUE("request_id","offering_id")
);
--> statement-breakpoint
CREATE TABLE "public_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"offering_id" uuid,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_message_one_subject" CHECK (("public_message"."request_id" is null) <> ("public_message"."offering_id" is null)),
	CONSTRAINT "public_message_body_length" CHECK ("public_message"."removed_at" is not null or char_length("public_message"."body") between 1 and 240)
);
--> statement-breakpoint
CREATE TABLE "flag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid,
	"request_id" uuid,
	"public_message_id" uuid,
	"flagged_by_id" uuid NOT NULL,
	"request" text NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flag_one_subject" CHECK (num_nonnulls("flag"."offering_id", "flag"."request_id", "flag"."public_message_id") = 1),
	CONSTRAINT "flag_request_length" CHECK (char_length("flag"."request") between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_member_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_invited_by_id_member_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_member_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_member_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_used_by_id_member_id_fk" FOREIGN KEY ("used_by_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering" ADD CONSTRAINT "offering_owner_id_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_photo" ADD CONSTRAINT "offering_photo_offering_id_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offering"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_availability" ADD CONSTRAINT "service_availability_offering_id_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offering"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_accept" ADD CONSTRAINT "trade_accept_offering_id_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offering"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement" ADD CONSTRAINT "arrangement_offering_id_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offering"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement" ADD CONSTRAINT "arrangement_requester_id_member_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement" ADD CONSTRAINT "arrangement_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement" ADD CONSTRAINT "arrangement_done_by_id_member_id_fk" FOREIGN KEY ("done_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement_offer" ADD CONSTRAINT "arrangement_offer_arrangement_id_arrangement_id_fk" FOREIGN KEY ("arrangement_id") REFERENCES "public"."arrangement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement_offer" ADD CONSTRAINT "arrangement_offer_trade_accept_id_trade_accept_id_fk" FOREIGN KEY ("trade_accept_id") REFERENCES "public"."trade_accept"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_arrangement_id_arrangement_id_fk" FOREIGN KEY ("arrangement_id") REFERENCES "public"."arrangement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_problem_report_id_problem_report_id_fk" FOREIGN KEY ("problem_report_id") REFERENCES "public"."problem_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participant" ADD CONSTRAINT "conversation_participant_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participant" ADD CONSTRAINT "conversation_participant_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_author_id_member_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_arrangement_id_arrangement_id_fk" FOREIGN KEY ("arrangement_id") REFERENCES "public"."arrangement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_reporter_id_member_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_reported_member_id_member_id_fk" FOREIGN KEY ("reported_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_resolved_by_id_member_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_messages_shared_by_id_member_id_fk" FOREIGN KEY ("messages_shared_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_asker_id_member_id_fk" FOREIGN KEY ("asker_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_closed_by_arrangement_id_arrangement_id_fk" FOREIGN KEY ("closed_by_arrangement_id") REFERENCES "public"."arrangement"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_availability" ADD CONSTRAINT "request_availability_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_give_back" ADD CONSTRAINT "request_give_back_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_link" ADD CONSTRAINT "request_link_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_link" ADD CONSTRAINT "request_link_offering_id_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offering"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_link" ADD CONSTRAINT "request_link_linked_by_id_member_id_fk" FOREIGN KEY ("linked_by_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_message" ADD CONSTRAINT "public_message_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_message" ADD CONSTRAINT "public_message_offering_id_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offering"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_message" ADD CONSTRAINT "public_message_author_id_member_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag" ADD CONSTRAINT "flag_offering_id_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offering"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag" ADD CONSTRAINT "flag_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag" ADD CONSTRAINT "flag_public_message_id_public_message_id_fk" FOREIGN KEY ("public_message_id") REFERENCES "public"."public_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag" ADD CONSTRAINT "flag_flagged_by_id_member_id_fk" FOREIGN KEY ("flagged_by_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_invited_by_idx" ON "member" USING btree ("invited_by_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "notification_log_lookup_idx" ON "notification_log" USING btree ("member_id","conversation_id","sent_at");--> statement-breakpoint
CREATE INDEX "notification_log_subject_idx" ON "notification_log" USING btree ("member_id","subject_id","sent_at");--> statement-breakpoint
CREATE INDEX "push_subscription_member_idx" ON "push_subscription" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "rate_limit_event_key_idx" ON "rate_limit_event" USING btree ("key","created_at");--> statement-breakpoint
CREATE INDEX "invitation_inviter_idx" ON "invitation" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "offering_search_idx" ON "offering" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "offering_status_created_idx" ON "offering" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "offering_type_idx" ON "offering" USING btree ("type");--> statement-breakpoint
CREATE INDEX "offering_owner_idx" ON "offering" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "offering_area_neighbourhood_idx" ON "offering" USING btree ("area_neighbourhood");--> statement-breakpoint
CREATE INDEX "offering_area_city_idx" ON "offering" USING btree ("area_city");--> statement-breakpoint
CREATE INDEX "offering_photo_offering_idx" ON "offering_photo" USING btree ("offering_id");--> statement-breakpoint
CREATE INDEX "service_availability_offering_idx" ON "service_availability" USING btree ("offering_id");--> statement-breakpoint
CREATE INDEX "trade_accept_offering_idx" ON "trade_accept" USING btree ("offering_id");--> statement-breakpoint
CREATE UNIQUE INDEX "arrangement_one_not_agreed_per_requester" ON "arrangement" USING btree ("offering_id","requester_id") WHERE "arrangement"."status" <> 'agreed';--> statement-breakpoint
CREATE INDEX "arrangement_requester_status_idx" ON "arrangement" USING btree ("requester_id","status");--> statement-breakpoint
CREATE INDEX "arrangement_offering_status_idx" ON "arrangement" USING btree ("offering_id","status");--> statement-breakpoint
CREATE INDEX "arrangement_quiet_idx" ON "arrangement" USING btree ("status","last_activity_at");--> statement-breakpoint
CREATE UNIQUE INDEX "arrangement_offer_once" ON "arrangement_offer" USING btree ("arrangement_id","trade_accept_id");--> statement-breakpoint
CREATE INDEX "conversation_participant_member_idx" ON "conversation_participant" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "message_conversation_created_idx" ON "message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "problem_report_arrangement_idx" ON "problem_report" USING btree ("arrangement_id");--> statement-breakpoint
CREATE INDEX "request_search_idx" ON "request" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "request_status_created_idx" ON "request" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "request_kind_idx" ON "request" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "request_asker_idx" ON "request" USING btree ("asker_id");--> statement-breakpoint
CREATE INDEX "request_area_neighbourhood_idx" ON "request" USING btree ("area_neighbourhood");--> statement-breakpoint
CREATE INDEX "request_area_city_idx" ON "request" USING btree ("area_city");--> statement-breakpoint
CREATE INDEX "request_availability_request_idx" ON "request_availability" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_give_back_request_idx" ON "request_give_back" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_link_offering_idx" ON "request_link" USING btree ("offering_id");--> statement-breakpoint
CREATE INDEX "public_message_request_idx" ON "public_message" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "public_message_offering_idx" ON "public_message" USING btree ("offering_id","created_at");--> statement-breakpoint
CREATE INDEX "public_message_author_idx" ON "public_message" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "flag_offering_idx" ON "flag" USING btree ("offering_id");--> statement-breakpoint
CREATE INDEX "flag_request_idx" ON "flag" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "flag_public_message_idx" ON "flag" USING btree ("public_message_id");--> statement-breakpoint
-- Written by hand: drizzle-kit can't express exclusion constraints. Two loans of the same offering that
-- haven't been marked returned may never overlap (002 FR-011a, research §4).
ALTER TABLE "arrangement" ADD CONSTRAINT "arrangement_loans_dont_overlap" EXCLUDE USING gist ("offering_id" WITH =, "loan_period" WITH &&) WHERE ("returned_at" IS NULL);
