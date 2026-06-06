-- btree_gist lets the loan exclusion constraint at the end compare listing ids (it ships with PostgreSQL).
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('message', 'agreement', 'reminder', 'report', 'flag');--> statement-breakpoint
CREATE TYPE "public"."push_platform" AS ENUM('web');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('unused', 'pending_confirmation', 'used', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."closed_reason" AS ENUM('removed', 'used_up');--> statement-breakpoint
CREATE TYPE "public"."handover" AS ENUM('to_requester', 'at_lister', 'elsewhere', 'online');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('available', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('lend', 'gift', 'trade', 'service');--> statement-breakpoint
CREATE TYPE "public"."loan_length_unit" AS ENUM('hours', 'days', 'weeks');--> statement-breakpoint
CREATE TYPE "public"."session_length_unit" AS ENUM('minutes', 'hours', 'days', 'weeks');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('item', 'kg', 'g', 'lb', 'oz', 'litre', 'hour', 'portion', 'bag', 'box', 'other');--> statement-breakpoint
CREATE TYPE "public"."proposal_closed_reason" AS ENUM('nothing_left', 'quiet', 'member_left');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('open', 'accepted', 'declined', 'withdrawn', 'closed');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'contact_shared', 'call_proposed', 'call_accepted', 'system', 'detail_changed', 'accepted', 'declined', 'withdrawn', 'closed', 'messages_shared');--> statement-breakpoint
CREATE TYPE "public"."agreement_outcome" AS ENUM('lent', 'gifted', 'traded', 'provided');--> statement-breakpoint
CREATE TYPE "public"."escalation_level" AS ENUM('inviter', 'inviters_inviter', 'founders');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved');--> statement-breakpoint
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
	"session_length" integer,
	"session_length_unit" "session_length_unit",
	"sessions_available" integer,
	"sessions_remaining" integer,
	"handovers" "handover"[] DEFAULT '{}' NOT NULL,
	"area" jsonb,
	"area_neighbourhood" text GENERATED ALWAYS AS (lower("area"->>'neighbourhood')) STORED,
	"area_city" text GENERATED ALWAYS AS (lower("area"->>'city')) STORED,
	"meeting_place" jsonb,
	"status" "listing_status" DEFAULT 'available' NOT NULL,
	"closed_reason" "closed_reason",
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_title_length" CHECK (char_length("listing"."title") between 1 and 100),
	CONSTRAINT "listing_description_length" CHECK ("listing"."description" is null or char_length("listing"."description") <= 2000),
	CONSTRAINT "listing_at_lister_has_area" CHECK (not ('at_lister' = any("listing"."handovers")) or "listing"."area" is not null),
	CONSTRAINT "listing_elsewhere_has_place" CHECK (not ('elsewhere' = any("listing"."handovers")) or "listing"."meeting_place" is not null),
	CONSTRAINT "listing_positive_numbers" CHECK (
      ("listing"."amount" is null or "listing"."amount" > 0) and ("listing"."remaining" is null or "listing"."remaining" >= 0)
      and ("listing"."loan_length" is null or "listing"."loan_length" > 0)
      and ("listing"."session_length" is null or "listing"."session_length" > 0)
      and ("listing"."sessions_available" is null or "listing"."sessions_available" >= 1)
      and ("listing"."sessions_remaining" is null or "listing"."sessions_remaining" >= 0)),
	CONSTRAINT "listing_units_with_numbers" CHECK (
      ("listing"."amount" is null) = ("listing"."unit" is null)
      and ("listing"."loan_length" is null) = ("listing"."loan_length_unit" is null)
      and ("listing"."session_length" is null) = ("listing"."session_length_unit" is null)),
	CONSTRAINT "listing_fields_match_type" CHECK (
      ("listing"."type" = 'lend' or ("listing"."loan_length" is null))
      and ("listing"."type" = 'service' or ("listing"."session_length" is null and "listing"."sessions_available" is null and "listing"."sessions_remaining" is null))
      and ("listing"."type" <> 'service' or ("listing"."amount" is null))
      and ("listing"."type" in ('gift', 'trade') or "listing"."remaining" is null)),
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
CREATE TABLE "service_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
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
	"listing_id" uuid NOT NULL,
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
CREATE TABLE "proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"status" "proposal_status" DEFAULT 'open' NOT NULL,
	"closed_reason" "proposal_closed_reason",
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
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_closed_has_reason" CHECK (("proposal"."status" = 'closed') = ("proposal"."closed_reason" is not null)),
	CONSTRAINT "proposal_positive_numbers" CHECK (
      ("proposal"."loan_length" is null or "proposal"."loan_length" > 0) and ("proposal"."amount" is null or "proposal"."amount" > 0)
      and ("proposal"."own_offer_amount" is null or "proposal"."own_offer_amount" > 0)
      and ("proposal"."session_length" is null or "proposal"."session_length" > 0) and ("proposal"."sessions" is null or "proposal"."sessions" >= 1)),
	CONSTRAINT "proposal_units_with_numbers" CHECK (
      ("proposal"."loan_length" is null) = ("proposal"."loan_length_unit" is null)
      and ("proposal"."session_length" is null) = ("proposal"."session_length_unit" is null)
      and ("proposal"."own_offer_amount" is null) = ("proposal"."own_offer_unit" is null)),
	CONSTRAINT "proposal_text_lengths" CHECK (
      ("proposal"."own_offer" is null or char_length("proposal"."own_offer") <= 300)
      and ("proposal"."decision_note" is null or char_length("proposal"."decision_note") <= 500))
);
--> statement-breakpoint
CREATE TABLE "proposal_offer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"trade_accept_id" uuid NOT NULL,
	"amount" numeric(12, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_offer_amount" CHECK ("proposal_offer"."amount" is null or "proposal_offer"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid,
	"problem_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_proposalId_unique" UNIQUE("proposal_id"),
	CONSTRAINT "conversation_has_one_owner" CHECK (("conversation"."proposal_id" is null) <> ("conversation"."problem_report_id" is null))
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
	"proposed_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_body_length" CHECK (char_length("message"."body") <= 4000)
);
--> statement-breakpoint
CREATE TABLE "agreement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"other_member_id" uuid NOT NULL,
	"outcome" "agreement_outcome" NOT NULL,
	"starts_at" timestamp with time zone,
	"has_time" boolean DEFAULT false NOT NULL,
	"handover" "handover",
	"place" jsonb,
	"amount" numeric(12, 3),
	"sessions" integer,
	"session_length" integer,
	"session_length_unit" "session_length_unit",
	"offer" jsonb,
	"loan_starts_at" timestamp with time zone,
	"loan_ends_at" timestamp with time zone,
	"loan_period" "tstzrange" GENERATED ALWAYS AS (case when "loan_starts_at" is null then null else tstzrange("loan_starts_at", "loan_ends_at") end) STORED,
	"returned_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_proposalId_unique" UNIQUE("proposal_id"),
	CONSTRAINT "agreement_not_with_self" CHECK ("agreement"."owner_id" <> "agreement"."other_member_id"),
	CONSTRAINT "agreement_amount_positive" CHECK ("agreement"."amount" is null or "agreement"."amount" > 0),
	CONSTRAINT "agreement_sessions_positive" CHECK ("agreement"."sessions" is null or "agreement"."sessions" >= 1),
	CONSTRAINT "agreement_loan_has_period" CHECK (("agreement"."outcome" = 'lent') = ("agreement"."loan_starts_at" is not null and "agreement"."loan_ends_at" is not null and "agreement"."loan_starts_at" < "agreement"."loan_ends_at"))
);
--> statement-breakpoint
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
	"proposal_messages_shared_at" timestamp with time zone,
	"proposal_messages_shared_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_report_description_length" CHECK (char_length("problem_report"."description") between 1 and 2000),
	CONSTRAINT "problem_report_outcome_length" CHECK ("problem_report"."outcome_note" is null or char_length("problem_report"."outcome_note") <= 1000),
	CONSTRAINT "problem_report_resolved_has_note" CHECK ("problem_report"."status" <> 'resolved' or "problem_report"."outcome_note" is not null)
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
ALTER TABLE "listing" ADD CONSTRAINT "listing_owner_id_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_flag" ADD CONSTRAINT "listing_flag_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_flag" ADD CONSTRAINT "listing_flag_flagged_by_id_member_id_fk" FOREIGN KEY ("flagged_by_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photo" ADD CONSTRAINT "listing_photo_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_availability" ADD CONSTRAINT "service_availability_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_accept" ADD CONSTRAINT "trade_accept_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_requester_id_member_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_offer" ADD CONSTRAINT "proposal_offer_proposal_id_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_offer" ADD CONSTRAINT "proposal_offer_trade_accept_id_trade_accept_id_fk" FOREIGN KEY ("trade_accept_id") REFERENCES "public"."trade_accept"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_proposal_id_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_problem_report_id_problem_report_id_fk" FOREIGN KEY ("problem_report_id") REFERENCES "public"."problem_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participant" ADD CONSTRAINT "conversation_participant_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participant" ADD CONSTRAINT "conversation_participant_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_author_id_member_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_proposal_id_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_owner_id_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_other_member_id_member_id_fk" FOREIGN KEY ("other_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_agreement_id_agreement_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_reporter_id_member_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_reported_member_id_member_id_fk" FOREIGN KEY ("reported_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_resolved_by_id_member_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_proposal_messages_shared_by_id_member_id_fk" FOREIGN KEY ("proposal_messages_shared_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_invited_by_idx" ON "member" USING btree ("invited_by_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "notification_log_lookup_idx" ON "notification_log" USING btree ("member_id","conversation_id","sent_at");--> statement-breakpoint
CREATE INDEX "push_subscription_member_idx" ON "push_subscription" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "rate_limit_event_key_idx" ON "rate_limit_event" USING btree ("key","created_at");--> statement-breakpoint
CREATE INDEX "invitation_inviter_idx" ON "invitation" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "listing_search_idx" ON "listing" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "listing_status_created_idx" ON "listing" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "listing_type_idx" ON "listing" USING btree ("type");--> statement-breakpoint
CREATE INDEX "listing_owner_idx" ON "listing" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "listing_area_neighbourhood_idx" ON "listing" USING btree ("area_neighbourhood");--> statement-breakpoint
CREATE INDEX "listing_area_city_idx" ON "listing" USING btree ("area_city");--> statement-breakpoint
CREATE INDEX "listing_flag_listing_idx" ON "listing_flag" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_photo_listing_idx" ON "listing_photo" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "service_availability_listing_idx" ON "service_availability" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "trade_accept_listing_idx" ON "trade_accept" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_one_open_per_requester" ON "proposal" USING btree ("listing_id","requester_id") WHERE "proposal"."status" = 'open';--> statement-breakpoint
CREATE INDEX "proposal_requester_status_idx" ON "proposal" USING btree ("requester_id","status");--> statement-breakpoint
CREATE INDEX "proposal_listing_status_idx" ON "proposal" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "proposal_quiet_idx" ON "proposal" USING btree ("status","last_activity_at");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_offer_once" ON "proposal_offer" USING btree ("proposal_id","trade_accept_id");--> statement-breakpoint
CREATE INDEX "conversation_participant_member_idx" ON "conversation_participant" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "message_conversation_created_idx" ON "message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "agreement_owner_idx" ON "agreement" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "agreement_other_idx" ON "agreement" USING btree ("other_member_id");--> statement-breakpoint
CREATE INDEX "agreement_listing_idx" ON "agreement" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "problem_report_agreement_idx" ON "problem_report" USING btree ("agreement_id");--> statement-breakpoint
-- Written by hand: drizzle-kit can't express exclusion constraints. Two loans of the same listing that
-- haven't been marked returned may never overlap (002 FR-011a, research §4).
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_loans_dont_overlap" EXCLUDE USING gist ("listing_id" WITH =, "loan_period" WITH &&) WHERE ("returned_at" IS NULL);
