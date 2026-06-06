# Data Model: Requests for Things

Additions and changes to the [002 data model](../002-listing-proposals/data-model.md). Nothing is
kept: the single initial migration is regenerated and the database rebuilt (research §10). Column names are snake_case
in the database and camelCase in code, as before.

## New enums

| Enum | Values |
|------|--------|
| `request_kind` | `borrow`, `receive`, `trade`, `service` (answered by listing types `lend`, `gift`, `trade`, `service`) |
| `request_status` | `open`, `closed` |
| `request_closed_reason` | `by_asker`, `agreed`, `account_deleted` |
| `notification_type` (changed) | adds `request`, `public_message` |

## `request` (new)

| Column | Type | Rules |
|--------|------|-------|
| `id` | uuid PK | |
| `asker_id` | uuid → member, cascade | |
| `kind` | `request_kind` | required |
| `title` | text | required, 1–100 characters |
| `description` | text | optional, ≤ 2,000 characters |
| `needed_after` | date | optional (FR-002a) |
| `needed_by` | date | optional; `needed_by >= needed_after` when both set |
| `area` | jsonb `Place` | optional; full place kept, others see neighbourhood and city (FR-028) |
| `area_neighbourhood`, `area_city` | text, generated | lower-cased parts for filters and suggestions (as on `listing`) |
| `handovers` | `handover[]` | optional ways it could happen; same values as listings (002 research §6) |
| `loan_length`, `loan_length_unit` | integer, `loan_length_unit` | Borrow only; both or neither; > 0 |
| `amount`, `unit` | numeric(12,3), `unit` | Receive and Trade only; both or neither; > 0 |
| `session_length`, `session_length_unit` | integer, `session_length_unit` | Service only; both or neither; > 0 |
| `sessions` | integer | Service only; ≥ 1 |
| `status` | `request_status` | default `open` |
| `closed_reason` | `request_closed_reason` | set exactly when `status = 'closed'` |
| `closed_by_agreement_id` | uuid → agreement, set null | set when `closed_reason = 'agreed'` |
| `search_vector` | tsvector | title (A), description and give-back items (B); set on every save; GIN index |
| `created_at`, `updated_at` | timestamptz | |

Indexes: `(status, created_at)`, `kind`, `asker_id`, GIN on `search_vector`.

Check constraints mirror `listing`'s: lengths, positive numbers, units with numbers, fields match
kind, closed has reason.

## `request_give_back` (new)

What a Trade asker could give back (FR-005); up to 10 per request, ordered.

| Column | Type | Rules |
|--------|------|-------|
| `id` | uuid PK | |
| `request_id` | uuid → request, cascade | |
| `position` | integer | 0–9 |
| `description` | text | 1–100 characters |
| `amount`, `unit` | numeric(12,3), `unit` | optional, both or neither |

## `request_availability` (new)

Weekly times that suit a Service asker (FR-006); same shape as `service_availability` (002): weekday
0–6, `start_time` < `end_time`, up to 14 rows.

## `request_link` (new)

| Column | Type | Rules |
|--------|------|-------|
| `id` | uuid PK | |
| `request_id` | uuid → request, cascade | |
| `listing_id` | uuid → listing, cascade | listing type must answer the request kind (checked in the module) |
| `linked_by_id` | uuid → member, set null | the helper, or the asker (clarification 1) |
| `created_at` | timestamptz | |

Unique `(request_id, listing_id)`. Removable by `linked_by_id` or the listing's owner.

## `public_message` (new)

| Column | Type | Rules |
|--------|------|-------|
| `id` | uuid PK | |
| `request_id` | uuid → request, cascade | exactly one of `request_id`, `listing_id` |
| `listing_id` | uuid → listing, cascade | |
| `author_id` | uuid → member, cascade | |
| `body` | text | 1–240 characters while shown; emptied on removal |
| `removed_at` | timestamptz | set when the author removes it ("Message removed") |
| `created_at` | timestamptz | |

Indexes: `(request_id, created_at)`, `(listing_id, created_at)`, `author_id`.

## Changed tables

- **`proposal`**: adds `request_id` uuid → request, set null. Set only when the requester is the
  request's asker and the listing is linked to it (research §3).
- **`listing_flag` → `flag`**: replaced by a `flag` table with nullable `listing_id`, `request_id`,
  and `public_message_id` (cascade); `check` exactly one of the three set. `seen_by_owner_at` becomes
  `seen_at` (seen by the recipient: listing owner, asker, or message author).
- **`notification_log`**: adds nullable `subject_id` (uuid of a request or listing) for the one
  notice per public thread per member per day rule (FR-023e).

## Request states

```text
           post                close (asker, confirmed)
 (none) ────────▶ Open ─────────────────────────────▶ Closed (by_asker)
                   │  ▲                                   │
                   │  └──────────── reopen (asker) ◀──────┤
                   │                                      │
                   ├─ asker's proposal on a linked ─────▶ Closed (agreed, closed_by_agreement_id)
                   │  listing is accepted
                   └─ asker deletes account ────────────▶ Closed (account_deleted; not shown)
```

- Reopening clears `closed_reason` and `closed_by_agreement_id`; links stay.
- Only Open requests can be edited, answered, linked to, or posted in.
- No quiet close (FR-008).

## Export (FR-026)

`requests.json`: the member's requests with details, give-back items, availability, links (listing
id and title), and state. `public_messages.json`: the member's own public messages with where they
were posted (request or listing id and title).

## Account deletion (FR-026)

In the same transaction as `deleteAccount()` in `modules/members.ts` (members are soft-deleted):
close open requests with `account_deleted` and clear their description and area (like listings);
delete the member's public messages outright. Their listings are deleted or closed by the existing
rules, so links from them show as "No longer available"; links stay so the asker's history still
makes sense. Requests closed this way are never shown to others.
