# Data Model: Community Resource Sharing

Entities from [spec.md](spec.md) Key Entities, as PostgreSQL tables defined with Drizzle in
`apps/api/src/db/schema/` (one file per area). Only the API reads or writes these tables; clients see them through
[contracts/api.md](contracts/api.md). Every table has `id` (UUID, random) and `created_at` (timestamptz).
"FK" means a foreign key. Tables owned by Better Auth (`session`, `account`, `verification`) follow
its standard schema and are not repeated here.

## member (Better Auth `user` table, extended)

| Field | Type | Rules |
|-------|------|-------|
| email | text, unique | Required; sign-in only; never shown to other members (FR-001a) |
| email_verified | boolean | Set true when the confirmation link is opened (FR-001b); founders: set by the setup command. Unverified accounts cannot sign in, and are deleted once their invitation's hold passes |
| display_name | text, 1–60 chars | Required; shown on profile and listings |
| bio | text, ≤500 chars | Optional |
| invited_by_id | FK → member, nullable | Null only when `is_founder` (FR-001, FR-003) |
| is_founder | boolean | Set only by the `create-founder` command; final mediators (FR-029a) |
| share_phone, share_email | text, nullable | Private; revealed only via contact sharing (FR-019). Stored encrypted (AES-256-GCM, research §14) |
| deleted_at | timestamptz, nullable | Set on account deletion; personal fields cleared except `display_name`; shown as "<name> (no longer a member)" |

Password hashes live in Better Auth's `account` table. There is no field for removal, suspension, or
penalty (FR-029b). Invite chain = follow `invited_by_id` until a founder.

## notification_preference

One row per member per notification type (FR-031).

| Field | Type | Rules |
|-------|------|-------|
| member_id | FK → member | |
| type | enum | `message`, `agreement`, `reminder`, `report`, `flag` |
| email | boolean | Default false; set from the join-form choice (FR-031) |
| device | boolean | Default false (FR-031a) |

Unique on (`member_id`, `type`).

## push_subscription

| Field | Type | Rules |
|-------|------|-------|
| member_id | FK → member | |
| platform | enum | `web` now; other values (e.g., `unifiedpush`) reserved for future native clients |
| endpoint | text, unique | Push endpoint URL |
| p256dh, auth | text, nullable | Web Push subscription keys (required for `web`) |
| label | text | Friendly device name shown in Settings ("iPhone Safari") so members can remove it |

Deleted when the member turns device notifications off on that device, when a push send returns
"gone", or on account deletion.

## invitation

| Field | Type | Rules |
|-------|------|-------|
| token_hash | text, unique | SHA-256 of a 32-byte random token; the raw token is only in the link |
| inviter_id | FK → member | Required |
| status | enum | `unused` → `pending_confirmation` → `used`; `unused` → `cancelled`; treated as expired when `expires_at` has passed |
| reserved_until | timestamptz, nullable | Set when sign-up starts: now + 7 days. After it passes, the unconfirmed account is deleted and a `pending_confirmation` invitation returns to `unused` |
| expires_at | timestamptz | `created_at` + 14 days (FR-002) |
| used_by_id | FK → member, nullable | |

Starting to join requires `status = unused` or `pending_confirmation`, and `expires_at` in the
future. Starting again on a `pending_confirmation` invitation (e.g., to fix a mistyped email)
deletes the earlier unconfirmed account and starts a new 7-day hold; it creates an unverified account and sends a confirmation email. Opening
the confirmation link verifies the email and marks the invitation `used`, in one transaction.
Joining with an email that belongs to a confirmed account is refused.

**Expired holds**: an unconfirmed account whose hold has passed is deleted (with its notification
preferences and sessions), and its invitation returns to `unused`. This runs before every new
sign-up attempt, so the same email can try again straight away, and in the hourly job, so
unconfirmed personal data is not kept. A confirmation link keeps working until `reserved_until`,
even if the invitation's own 14-day expiry passes in the meantime.

## listing

| Field | Type | Rules |
|-------|------|-------|
| owner_id | FK → member | |
| type | enum | Required: `lend`, `gift`, `trade`, `service` (FR-007) |
| title | text, 1–100 chars | Required |
| description | text, ≤2000 chars | Optional; handoff details go here |
| amount | numeric, nullable | > 0 (FR-008); not used for Service |
| unit | enum, nullable | Required when `amount` is set: `item`, `kg`, `g`, `litre`, `hour`, `portion`, `bag`, `box`, `other` |
| remaining | numeric, nullable | Gift/Trade only; starts at `amount`; never below 0 |
| loan_length | integer, nullable | Lend only; > 0 (FR-009) |
| loan_length_unit | enum, nullable | `hours`, `days`, `weeks`; required with `loan_length` |
| wanted | text, ≤300 chars, nullable | Trade only: what's wanted in return (FR-010) |
| wanted_amount | numeric, nullable | Trade only; > 0 |
| wanted_unit | enum, nullable | Same list as `unit`; required with `wanted_amount` |
| open_to_offers | boolean | Trade only; default false. Trade needs `wanted` or `open_to_offers` |
| session_length | integer, nullable | Service only; > 0 (FR-010a) |
| session_length_unit | enum, nullable | `minutes`, `hours`; required with `session_length` |
| sessions_available | integer, nullable | Service only; ≥ 1 |
| sessions_remaining | integer, nullable | Starts at `sessions_available`; never below 0 |
| area | text, ≤60 chars, nullable | Approximate area only (FR-011); hint text says "not your address" |
| status | enum | `available`, `lent_out`, `paused`, `closed` (FR-014) |
| closed_reason | enum, nullable | `removed` (owner removed it) or `used_up` (nothing remains); set when `status = closed`. Only `removed` listings can be reopened (FR-013b) |
| search_vector | tsvector, generated | Title (weight A) + description + wanted (weight B); GIN index |
| updated_at | timestamptz | |

Fields that don't apply to the listing's `type` must be null (enforced by a check constraint and the
Zod schema, which is a discriminated union on `type`).

Indexes: `search_vector` (GIN); (`status`, `created_at`); `type`; `owner_id`.

**States**:

```text
available ──(loan agreement, Lend)──▶ lent_out ──(marked returned)──▶ available
available ──(remaining reaches 0, Gift/Trade)──▶ closed
available ──(agreement on a listing without an amount, Gift/Trade)──▶ closed
available ──(sessions_remaining reaches 0, Service)──▶ closed
(a Service without `sessions_available` stays available until the owner removes it)
available ⇄ paused (owner pauses / resumes)
any except closed ──(owner removes)──▶ closed (closed_reason = removed)
closed (removed) ──(owner reopens)──▶ available
(automatic closes set closed_reason = used_up)
```

Only the owner can change a listing's content or status (FR-013a).

## listing_photo

| Field | Type | Rules |
|-------|------|-------|
| listing_id | FK → listing, cascade delete | Max 6 per listing |
| file_key | text | Random file name on the photos volume |
| alt_text | text, ≤200 chars | Optional |
| position | smallint | Display order |

## listing_flag

| Field | Type | Rules |
|-------|------|-------|
| listing_id | FK → listing | Cannot flag your own listing |
| flagged_by_id | FK → member | |
| request | text, 1–500 chars | Required |
| seen_by_owner_at | timestamptz, nullable | |

No effect on the listing's visibility (FR-013a).

## conversation

| Field | Type | Rules |
|-------|------|-------|
| listing_id | FK → listing, nullable | When started from "Message about this" |
| problem_report_id | FK → problem_report, nullable | For mediation conversations |

**conversation_participant**: `conversation_id`, `member_id`, `last_read_at`. Unique pair. Two
participants normally; more for mediation.

## message

| Field | Type | Rules |
|-------|------|-------|
| conversation_id | FK → conversation | |
| author_id | FK → member | Must be a participant |
| kind | enum | `text`, `contact_shared`, `call_proposed`, `call_accepted`, `system` |
| body | text, ≤4000 chars | For `contact_shared`, a snapshot of exactly what the author confirmed |
| proposed_time | timestamptz, nullable | For call messages (FR-020) |

Index (`conversation_id`, `created_at`). Saving a message triggers `NOTIFY` for live delivery
(FR-018a).

## agreement

| Field | Type | Rules |
|-------|------|-------|
| listing_id | FK → listing | Recorded by the listing owner only |
| owner_id | FK → member | |
| other_member_id | FK → member | ≠ owner |
| outcome | enum | `lent`, `gifted`, `traded`, `provided`; set from the listing's `type` |
| amount | numeric, nullable | Gift/Trade with an amount: required, ≤ listing `remaining`. Lend: null; a loan covers the whole listing. Service: null |
| sessions | integer, nullable | Service only; default 1; ≤ listing `sessions_remaining` when that is set |
| return_due | date, nullable | Required when `outcome = lent` |
| returned_at | timestamptz, nullable | Set by owner (FR-025) |
| reminder_sent_at | timestamptz, nullable | Guarantees one reminder |
| confirmation | enum | `pending` → `confirmed` / `disputed` / `cancelled` (FR-023, FR-024a); only the owner cancels, only while `pending` |
| note | text, ≤500 chars | Optional |

**Effects on listing** (FR-024), applied in the same transaction (row-locked listing, so two
agreements can't over-allocate): `lent` → `lent_out`; `gifted`/`traded` with an amount →
`remaining -= amount`, and `closed` at 0; without an amount → `closed`. `provided` →
`sessions_remaining -= sessions`, `closed` at 0; without `sessions_available` → unchanged. Marked returned →
`available`. **Cancelling** a pending agreement (FR-024a) reverses these effects in the same locked
transaction: `remaining` / `sessions_remaining` restored, status back to `available`, `closed_reason`
cleared.

## problem_report

| Field | Type | Rules |
|-------|------|-------|
| agreement_id | FK → agreement | |
| reporter_id | FK → member | A party to the agreement |
| reported_member_id | FK → member | The other party |
| description | text, 1–2000 chars | |
| escalation_level | enum | `inviter` → `inviters_inviter` → `founders` |
| status | enum | `open` → `resolved`; may stay open indefinitely |
| outcome_note | text, ≤1000 chars, nullable | Required to resolve |
| resolved_by_id | FK → member, nullable | |

Mediators are not stored on the report: they are the participants of its mediation conversation
(`conversation.problem_report_id`) other than the reporter and the reported member.

**Escalation** (FR-029a): on creation, the reported member's nearest active inviter joins the
mediation conversation. First escalation adds that inviter's nearest active inviter; if that would be
a founder or nobody, it goes straight to `founders`. Second escalation adds all active founders. No
further steps. Reports never affect access (FR-029b).

## Relationships at a glance

```text
member ─invited_by─▶ member
member 1─* invitation, listing, agreement, push_subscription, notification_preference
listing 1─* listing_photo, listing_flag, agreement, conversation
conversation 1─* message; *─* member (conversation_participant)
agreement 1─* problem_report 1─1 conversation
```
