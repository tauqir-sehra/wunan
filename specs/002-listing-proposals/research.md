# Research: Proposals for Listings

Decisions for [spec.md](spec.md). The stack, structure, and rules from
[001 research](../001-community-resource-sharing/research.md) stay as they are; only what changes or
is new is recorded here.

## 1. Place suggestions (FR-027 to FR-030)

**Decision**: The API calls a [Photon](https://github.com/komoot/photon) place-search server
(OpenStreetMap data) over HTTPS with plain `fetch`. The operator sets `PLACES_URL` (default
`https://photon.komoot.io`) and an optional `PLACES_BIAS` (`lat,lon`) and `PLACES_BBOX` so
suggestions favour the community's own area. A member's browser asks the web app, the web app asks
`GET /api/v1/places?q=`, and only the API talks to Photon. Only the typed text (at least 3
characters, at most 100) and the operator's fixed bias go out: no member id, no cookies, no client IP
(the request comes from the server). Results are cached in memory for 10 minutes (a small `Map`
with a size cap) so repeated typing doesn't repeat lookups. Limit: 60 lookups per member per minute.
If `PLACES_URL` is empty, or Photon fails or takes longer than 2 s, the API answers
`503 places_unavailable` and the field quietly stays plain text (spec edge case).

Each suggestion is turned into a **place**: `label` (full text as shown), `name`, `street`,
`houseNumber`, `postcode`, `neighbourhood` (Photon `district`, else `locality`, else the name
when the result itself is a district or locality), `city` (Photon `city`, else the name when the
result is a city or town), `lat`, `lon`, and `source: "suggestion"`. Typed text that wasn't picked
becomes `{ label, source: "typed" }`.

**Rationale**: Photon is built for search-as-you-type, returns the address parts needed to show
"neighbourhood, city" and to compare areas, and can be self-hosted from a published data dump when
an operator doesn't want to rely on komoot's public server (FR-027 "replaceable, including a
self-hosted one"). No new npm package is needed. Calling from the server keeps the member's IP and
session away from the service.

**Alternatives considered**: Nominatim's public server forbids autocomplete in its usage policy.
Commercial geocoders (Google, Mapbox) need accounts and keys, track usage, and can't be self-hosted.
A browser-side call would leak members' IP addresses. A community-only list of places (rejected in
clarification) can't suggest addresses or businesses.

## 2. How places are shown and compared (FR-029, FR-014)

**Decision**: Places are stored whole (one `jsonb` value per place, validated by a shared Zod
schema). The API decides what each viewer sees:

- Listing places (area, meeting place): other members get `{ display }` only, where `display` is
  "neighbourhood, city" (or whichever is known). The owner, and a requester whose proposal on the
  listing was accepted, get the full place. A typed place has no parts, so its `display` is its
  label as typed; the field keeps the 001 hint "Your neighbourhood, not your address" for that case.
- Proposal and agreement places: visible in full to the two members, and to mediators of a report on
  that agreement (agreement details).

"Within the listing's area" (FR-014, checked only for a service's meeting place, never for a drop-off at
the recipient's): when both places came from suggestions, they match if the
neighbourhoods are equal (case- and accent-insensitive), or, when the listing area has no
neighbourhood (it's a whole city), if the cities are equal. If either place was typed, wunan can't
tell, so the check is skipped and the lister decides; the proposal page says "wunan couldn't check
this place against the listing's area".

Search's area filter (FR-016) matches the area's neighbourhood, city, or display text; generated
columns `area_neighbourhood` and `area_city` on `listing` keep it indexed.

**Rationale**: One place shape everywhere; privacy decided in one function (`viewPlace`) rather than
spread across pages.

**Alternatives considered**: Distance radius (rejected in clarification). Storing only the coarse
parts (rejected: the full place is revealed after acceptance).

## 3. Proposal workflow and conflicts (FR-010 to FR-021)

**Decision**: A proposal has `status`: `open` → `accepted` | `declined` | `withdrawn` | `closed`
(with `closedReason`: `nothing_left`, `quiet`, `member_left`). Only the requester edits details;
each edit bumps `version` and posts a `detail_changed` message summarising the change in plain
words. Accepting sends the `version` the lister saw; if it differs, `409 proposal_changed` and the
page reloads showing the new details (spec edge case "Change just before accepting").

Whether a proposal can be accepted is **computed, not stored**: `proposalIssues(proposal, listing,
now)` returns a list of `{ field, message }` (missing detail, doesn't fit the listing, time passed,
dates taken, not enough left). The page shows them; accept is refused while any remain. Listing
edits therefore need no fix-up step ("Needs a new choice" is just an issue).

Accepting runs in one transaction that locks the listing row (`select … for update`), re-checks
issues, creates the agreement, updates the listing, and closes other open proposals when nothing is
left (amount or sessions at zero), posting a `closed` message and notifying each requester.

One open proposal per requester per listing (partial unique index); a requester amends instead of
opening a second one.

**Rationale**: Computed issues keep one source of truth and work identically for every client. The
version check is the simplest safe answer to concurrent edit + accept.

**Alternatives considered**: Storing an "acceptable" flag (goes stale when the listing changes).
Allowing several open proposals per requester (confusing lists, no benefit).

## 4. Loans as periods and overlap (FR-011, FR-011a, FR-019a)

**Decision**: A loan agreement stores `loanStartsAt` and `loanEndsAt` (pickup time and pickup time
plus loan length) and a generated `tstzrange` column `loan_period`. PostgreSQL enforces no overlap
with an exclusion constraint: `exclude using gist (listing_id with =, loan_period with &&) where
(returned_at is null)`, which needs the `btree_gist` extension (part of PostgreSQL, enabled in the
migration). The application checks first to give the plain message "Those dates are already taken:
…"; the constraint is the backstop under concurrency.

"Lent out" is no longer a stored listing status. A Lend listing is lent out when it has a loan with
`loanStartsAt <= now` and `returnedAt is null` (an overdue loan stays lent out). Listing status
becomes `available | paused | closed`; search's `includeLent` filters on that derived condition.
`GET /listings/{id}` returns `takenPeriods` (loans not returned and not yet ended, plus overdue ones)
for Lend listings.

Return reminders keep the 001 rule, keyed on `loanEndsAt` in the community time zone. An overdue
earlier loan shows on the next loan's page (spec edge case).

**Rationale**: A database guarantee is the only reliable overlap check under concurrent accepts;
`btree_gist` ships with PostgreSQL, so it's not a new dependency.

**Alternatives considered**: Application-only check with a lock (works, but one missed code path
breaks it). A separate bookings table (duplicates agreements).

## 5. Times and service availability (FR-009, FR-014)

**Decision**: "When" is stored as `startsAt timestamptz` plus `hasTime boolean`; a date without a
time is midnight in the community time zone (`TZ`, already set in `compose.yaml`). Service
availability is rows of `(weekday 1–7, startTime, endTime)` in the community time zone, up to 14 per
listing. A service proposal fits when its start falls inside a row for that weekday, and, for
session lengths in minutes or hours, its end does too. Lengths in days or weeks only check the start.
When a listing has availability, a service proposal must include a time.

**Rationale**: Matches the clarified "weekly days + hours"; one time zone per community matches one
community per installation.

## 6. Handover values (FR-001 to FR-004a)

**Decision**: One enum for all types, labelled per type in the UI:

| Value | Lend / Gift | Trade | Service |
|-------|-------------|-------|---------|
| `to_requester` | Dropped off to the recipient | At the recipient's | At the recipient's |
| `at_lister` | Picked up from the lister | At the lister's | At the lister's |
| `elsewhere` | Meet somewhere else | Meet somewhere else | Somewhere else |
| `online` | Online | Online | Online |

A listing stores `handovers` (array, empty = to be agreed). A proposal stores one `handover`. Its
place: `to_requester` → the requester enters it; `at_lister` → copied from the listing's area when
the proposal is read, not editable (FR-004a); `elsewhere` → defaults to the listing's meeting place,
the requester may change it; `online` → no place.

## 7. Messages and threads (FR-022 to FR-026)

**Decision**: Keep the 001 `conversation` + `message` tables as the thread mechanism, and attach each
thread to **either a proposal or a problem report** (check constraint: exactly one). A proposal's
thread is created with the proposal. The general inbox (`GET /conversations`, `POST
/conversations`, `/messages` pages) is removed; thread endpoints (`/conversations/{id}/messages`,
`/read`, `/contact-share`, `/calls`, `/live`) stay, used by proposal and report pages. New message
kinds: `detail_changed`, `accepted`, `declined`, `withdrawn`, `closed`, `messages_shared`.
Proposal threads become read-only when the proposal is declined, withdrawn, or closed (FR-022b).

Sharing a proposal's messages with mediators (FR-022a): `POST /reports/{id}/share-proposal-messages`
by the reporter or reported member sets `problem_report.proposal_messages_shared_at/_by` and posts a
`messages_shared` message in the report thread. Mediators can then read (not write) the proposal
thread.

**Rationale**: Reuses the tested live updates, contact sharing, call times, and read tracking, so
"messages belong to proposals" is a change of ownership, not a rewrite.

## 8. Quiet proposals (FR-020a)

**Decision**: `proposal.lastActivityAt` is updated with every thread message and detail change. The
existing hourly job closes open proposals with `lastActivityAt` older than 30 days (`closedReason
quiet`), posts a `closed` message, and notifies both members.

## 9. Database reset (FR-031)

**Decision**: Delete `apps/api/drizzle/*` and regenerate a single `0000_initial.sql` from the new
schema (with `create extension if not exists btree_gist`). Developers run `npm run db:reset -w
apps/api` (drops and recreates the public schema, then migrates) once after pulling. No conversion
scripts.

## 10. Web form patterns

**Decision**: The listing form and the proposal form need JavaScript (decided by the project owner
on 2026-06-05). 001's rule that every flow works without JavaScript still holds for all other
pages. These two forms still submit as normal form posts, so validation and errors stay on the
server. Without JavaScript they show a plain note: "This form needs JavaScript turned on."

- **Repeating rows** (accepted things, availability): client-side Svelte state; "Add another" and
  "Remove" act in place. Rows are sent as indexed fields (`accepts[0].description`, …). Focus moves
  to the new row's first field; removal is announced in a polite live region.
- **Place field** (`PlaceField.svelte`): a small hand-written ARIA combobox (`role="combobox"` on
  the text input, `aria-activedescendant` into a `role="listbox"`) instead of Bits UI Combobox, as
  first planned. Bits UI's Combobox owns the input's value and filters its own item list, which
  fought free typing, the hidden JSON field and the no-JavaScript text fallback; the hand-written one
  is about 100 lines with no new dependency. Its keyboard and screen-reader behaviour is covered by
  `apps/web/tests/e2e/proposals-us7.spec.ts` and the axe checks in `accessibility.spec.ts`.
  Suggestions after 3 characters with a 300 ms pause; up to 8; arrow keys move, Enter picks, Escape
  closes; the count and the pick are announced in a polite live region. The picked
  place goes in a hidden JSON input; typing again after a pick turns it back into typed text.
  When the place service is unavailable, it works as a plain text field (FR-028).
- **Proposal form**: one page per type (`/listings/[id]/propose`), every field optional, "Not
  decided yet" as the empty choice; a message box for "anything you'd rather talk about".

## Dependency summary (constitution VII)

No new npm packages. New: the `btree_gist` PostgreSQL extension (bundled with PostgreSQL) and an
outside service, Photon, reached with `fetch`. Using an outside place service was approved by the
project owner in clarification on 2026-06-05; the operator can point it at a self-hosted Photon or
turn it off (`PLACES_URL=`).
