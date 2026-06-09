# Data Model: Proposals for Offerings

Changes to the [001 data model](../001-community-resource-sharing/data-model.md). Tables not
listed here are unchanged. Conventions are the same: Drizzle tables in `apps/api/src/db/schema/`,
every table has `id` (UUID) and `created_at`; clients see fields in camelCase through
[contracts/api.md](contracts/api.md). Existing data is not kept: the migrations are regenerated as a
single initial one (research §9).

## Place (value type, `jsonb`)

Shared Zod schema `placeSchema` in `packages/shared/src/schemas/places.ts`. Used by offering areas,
offering meeting places, proposals, and agreements.

| Field | Type | Rules |
|-------|------|-------|
| label | text, 1–200 chars | Required; the full text as picked or typed |
| source | enum | `suggestion` (picked from the place service) or `typed` |
| name, street, houseNumber, postcode | text ≤100, optional | Only for `suggestion` |
| neighbourhood, city | text ≤100, optional | Only for `suggestion`; used for display and area checks (research §2) |
| lat, lon | number, optional | Only for `suggestion` |

What others see is decided by `viewPlace()` in `apps/api/src/modules/places.ts` (research §2): a
offering place becomes `{ display }` ("neighbourhood, city", or the typed label) for anyone but the
owner and accepted requesters.

## offering (changed)

| Field | Change | Rules |
|-------|--------|-------|
| unit | enum gains `lb`, `oz` | Full list: item, kg, g, lb, oz, litre, hour, portion, bag, box, other (FR-007) |
| session_length_unit | enum gains `days`, `weeks` | minutes, hours, days, weeks (FR-008) |
| handovers | `handover[]`, default `{}` | Values `to_requester`, `at_lister`, `elsewhere`, `online` (research §6). Empty = to be agreed (FR-001–FR-004) |
| area | text → place `jsonb`, nullable | Required when `handovers` contains `at_lister` (FR-004) |
| area_neighbourhood, area_city | generated text | From `area`; lower-cased, accents removed; indexed for the area filter and checks |
| meeting_place | place `jsonb`, nullable | Required when `handovers` contains `elsewhere` (FR-004) |
| wanted, wanted_amount, wanted_unit, open_to_offers | **removed** | Replaced by `trade_accept` rows (FR-005, FR-006) |
| status | enum loses `lent_out` | `available`, `paused`, `closed`. "Lent out" is derived (research §4) |

Search vector: title (A), description and accepted-thing descriptions (B). Because accepted things
live in another table, the vector becomes a plain `tsvector` column updated by
`modules/offerings.ts` whenever the offering or its accepted things are saved.

Check constraints updated: `offering_fields_match_type` (no `trade_accept` rule here; enforced in the
module), area required for `at_lister`, meeting place required for `elsewhere`.

## trade_accept (new)

What a Trade offering accepts in return (FR-005). None = open to offers (FR-006).

| Field | Type | Rules |
|-------|------|-------|
| offering_id | FK → offering, cascade | Offering must be `trade` |
| position | smallint | 0–9; order shown; ≤10 per offering |
| description | text, 1–100 chars | Required |
| amount | numeric(12,3), nullable | > 0; with `unit` |
| unit | unit enum, nullable | Set exactly when `amount` is |

## service_availability (new)

Weekly times a Service offering is offered (FR-009), in the community time zone.

| Field | Type | Rules |
|-------|------|-------|
| offering_id | FK → offering, cascade | Offering must be `service` |
| weekday | smallint | 1 (Monday) – 7 (Sunday) |
| start_time, end_time | time | `start_time < end_time`; ≤14 rows per offering |

## proposal (new)

| Field | Type | Rules |
|-------|------|-------|
| offering_id | FK → offering, restrict | |
| requester_id | FK → member | Never the offering owner (FR-010) |
| status | enum | `open`, `accepted`, `declined`, `withdrawn`, `closed` |
| closed_reason | enum, nullable | `nothing_left`, `quiet`, `member_left`; set exactly when `status = closed` |
| version | integer, default 1 | +1 on each detail change; accept must send the version shown (research §3) |
| starts_at | timestamptz, nullable | "When" (pickup, trade, or service time) |
| has_time | boolean, default false | False = date only (midnight, community time zone) |
| handover | handover enum, nullable | Must be one of the offering's `handovers` when it has any |
| place | place `jsonb`, nullable | Not stored for `at_lister` (read from offering) or `online` (research §6) |
| loan_length, loan_length_unit | integer > 0, enum (hours/days/weeks), nullable | Lend only; ≤ offering's maximum loan length |
| amount | numeric(12,3) > 0, nullable | Gift/Trade with an amount; starts at offering's `remaining` (FR-012, FR-013) |
| own_offer | text ≤300, nullable | Trade with no accepted things: what the requester offers (FR-013) |
| own_offer_amount, own_offer_unit | numeric > 0, unit enum, nullable | Optional, with `own_offer` |
| session_length, session_length_unit | integer > 0, enum, nullable | Service only (FR-014) |
| sessions | integer ≥ 1, nullable | Service only; ≤ `sessions_remaining` |
| decision_note | text ≤500, nullable | Optional note when declined or withdrawn (FR-020) |
| last_activity_at | timestamptz | Updated on every message and detail change; quiet close after 30 days (FR-020a) |
| accepted_at | timestamptz, nullable | |
| updated_at | timestamptz | |

Indexes: unique (`offering_id`, `requester_id`) where `status = 'open'` (one open proposal per
requester per offering); (`requester_id`, `status`); (`offering_id`, `status`); (`status`,
`last_activity_at`) for the quiet-close job.

Fields not matching the offering's type must be null (check constraint plus Zod discriminated union).

### proposal_offer (new)

The accepted things a Trade requester chose (FR-013).

| Field | Type | Rules |
|-------|------|-------|
| proposal_id | FK → proposal, cascade | |
| trade_accept_id | FK → trade_accept, cascade | Must belong to the proposal's offering; unique per proposal |
| amount | numeric(12,3) > 0, nullable | How much of it; ≤ the accepted thing's amount when it has one |

A Trade proposal offers either `proposal_offer` rows (offering has accepted things) or `own_offer`
(offering open to offers), never both.

### Proposal states

```text
open ──accept (lister, no issues, same version)──▶ accepted   (creates the agreement)
  ├──decline (lister) ──────────────────────────▶ declined   (read-only)
  ├──withdraw (requester) ──────────────────────▶ withdrawn  (read-only)
  └──nothing left / 30 days quiet / member left ▶ closed     (read-only)
```

**Issues** (computed by `proposalIssues()`, never stored; research §3). A proposal can be accepted
only with none:

- a required detail is empty: when, handover, place (unless `online` or `at_lister`), and per type:
  loan length (Lend), amount (Gift/Trade with an amount), offer (Trade with accepted things),
  session length and sessions (Service);
- handover not among the offering's handovers; loan length over the maximum; amount over
  `remaining`; sessions over `sessions_remaining`; session length over the offering's;
- service time outside availability; service meeting place (`elsewhere`) outside the offering's area; a drop-off place (`to_requester`) is never checked (research §2, §5);
- `starts_at` in the past;
- Lend: loan period overlaps a loan not yet returned (FR-011a);
- offering not `available`.

## agreement (changed)

| Field | Change | Rules |
|-------|--------|-------|
| proposal_id | new, FK → proposal, unique | Every agreement comes from an accepted proposal (FR-018) |
| owner_id, other_member_id | kept | Lister and requester |
| starts_at, has_time, handover, place | new | Copied from the proposal at acceptance; `place` copied from the offering for `at_lister` |
| loan_starts_at, loan_ends_at | new, timestamptz, nullable | Lend only; `starts_at` and `starts_at` + loan length |
| loan_period | new, generated `tstzrange(loan_starts_at, loan_ends_at)` | Exclusion constraint: no two loans of the same offering with `returned_at is null` overlap (research §4) |
| return_due | **removed** | Reminders use `loan_ends_at` |
| sessions, amount | kept | Copied from the proposal |
| session_length, session_length_unit, offer | new | Copied (offer as `jsonb` snapshot: chosen things with amounts, or own offer) |
| confirmation | **removed** | Agreements are confirmed when created (FR-021) |
| note | **removed** | Notes live in the proposal thread |

## conversation (changed)

| Field | Change | Rules |
|-------|--------|-------|
| offering_id | **removed** | |
| proposal_id | new, FK → proposal, cascade, unique, nullable | |
| problem_report_id | kept | |

Check: exactly one of `proposal_id`, `problem_report_id` is set. Participants of a proposal thread
are the requester and the lister. A proposal thread accepts new messages only while the proposal is
`open` or `accepted` (FR-022b).

## message (changed)

`message_kind` gains `detail_changed`, `accepted`, `declined`, `withdrawn`, `closed`,
`messages_shared`. These are written by the API with a plain-language `body` ("Robin changed the
pickup time to Saturday 6 June, 10 am"); `author_id` is the member who acted, or null for
automatic closes.

Contact details and call times are added to an ordinary `text` message with the composer's "+"
(no separate kinds): `shared_phone` and `shared_email` (text, nullable) hold a snapshot of exactly
what was chosen, and `proposed_time` a suggested call. `body` may be empty when something was added.
The kinds `contact_shared` and `call_proposed` are gone; `call_accepted` stays.

## problem_report (changed)

| Field | Change | Rules |
|-------|--------|-------|
| proposal_messages_shared_at | new, timestamptz, nullable | Set once; can't be unset (FR-022a) |
| proposal_messages_shared_by_id | new, FK → member, nullable | Reporter or reported member |

## Data export (FR-033)

`my-wunan-data.json` in the export gains `proposals`: every proposal the member made or received,
with details, state, and its thread's messages. `conversations` keeps only report threads. Agreements gain the
new fields.
