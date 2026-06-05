CREATE TYPE "public"."push_platform" AS ENUM('web');--> statement-breakpoint
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
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscription_member_idx" ON "push_subscription" USING btree ("member_id");