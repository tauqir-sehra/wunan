# Research: Requests for Things

Decisions for [spec.md](spec.md). Each: what was chosen, why, and what else was considered. The
architecture is unchanged from 001/002: the API owns every rule; the web app only renders.

## 1. Requests are their own table, not a listing with a flag

**Decision**: A new `request` table (with `request_give_back` for Trade), separate from `listing`.
Request kinds are their own enum (`borrow`, `receive`, `trade`, `service`) mapped one-to-one to
listing types (`lend`, `gift`, `trade`, `service`) by a small constant in `modules/requests.ts`.

**Rationale**: A request has different words, a different life (open/closed, reopenable, never quiet-
closed), different details (needed-after/needed-by dates, no photos, no "remaining"), and must never
show up in Find (FR-020). Folding it into `listing` would add a "direction" column that every listing
query, check constraint, and page would then have to filter on, which is how bugs creep into the
core workflow (constitution II).

**Alternatives**: A `direction` column on `listing` (rejected for the reasons above); reusing listing
types as request kinds (rejected: "Gift" and "Lend" are the giver's words; the asker "receives" and
"borrows").

## 2. Linking requests and listings

**Decision**: A `request_link` join table (`request_id`, `listing_id`, `linked_by_id`, unique pair).
A link is made in three ways: the helper posts a new listing from "I can help with this" (the listing
form carries `forRequest`), the helper picks one of their own available listings of the matching
type, or the asker links a listing they found (spec clarification 1). A link can be removed by the
member who made it or the listing's owner (undoable, constitution II). Links are never removed when
the request closes (FR-019); a removed or paused listing keeps its link and shows as "No longer
available".

**Rationale**: Many-to-many is what the spec describes (several helpers; a listing can answer more
than one request). Keeping it in a join table leaves `listing` unchanged except through this table.

**Alternatives**: `listing.request_id` (rejected: one request per listing only, and the asker's own
link would need to edit someone else's listing).

## 3. How an accepted proposal closes a request

**Decision**: `proposal` gains a nullable `request_id`. When the asker makes a proposal on a listing
linked to one of their open requests, the API sets it (if the listing is linked to several of the
asker's open requests, the body must name one with `requestId`; otherwise `409 choose_request` with
the choices). In `acceptProposal()`, inside the same transaction that creates the agreement: if
`proposal.request_id` is set and the request is still open, close it with
`closed_reason = 'agreed'` and `closed_by_agreement_id`, then notify the other linkers after commit.
Proposals by other members never get a `request_id` (FR-018); proposals on unlinked listings never
close a request (FR-016).

**Rationale**: The decision is made once, at the moment the asker proposes, and stored, so
acceptance doesn't have to guess. It reuses the existing transaction and listing lock.

**Alternatives**: Working out at acceptance time whether the listing is linked (rejected: a link
added or removed between proposing and accepting would change the outcome silently).

**Prefill**: The proposal form is prefilled from the request (FR-017) by the web app reading
`GET /requests/{id}` and mapping fields; nothing is stored until the asker sends it. Mapping:
`neededAfter` → `date`; `handovers[0]` if the listing offers it → `handover`; area → `place` (only
for handovers that take a place); `loanLength` → `loanLength` (Lend); `amount` → `amount`
(Gift/Trade); give-back items matching the listing's accepted things by exact description →
`offers`, the rest → `ownOffer` text (Trade); `sessionLength`, `sessions` (Service).

## 4. When it's needed

**Decision**: Two nullable `date` columns, `needed_after` and `needed_by`, with
`check (needed_after is null or needed_by is null or needed_by >= needed_after)`. Dates only, no
time; the community time zone (001) is used to show "The date has passed" when `needed_by` is before
today. Words come from one helper in the web app (`neededText()`), per FR-002a.

**Rationale**: Exactly the spec's clarification; dates without times avoid time-zone surprises.

**Alternatives**: A `tstzrange` (rejected: open-ended ranges read worse in code and in exports for no
gain; no overlap checks are needed).

## 5. Suggestions while asking

**Decision**: `GET /requests/suggestions?kind=&q=&area=` returns up to 5 listings using the existing
listing search (`searchListings()` with the request kind's listing type, `q`, excluding the viewer's
own listings, available only, lent-out excluded). When `area` is given, results whose area
neighbourhood or city matches come first (the same lower-cased area parts Find uses), then the rest
by search rank. The web app asks after a 400 ms pause once the title has 3+ characters, and
announces "N listings might already have what you need" in a polite live region (FR-010). The
unfinished request is kept in the form's own state and in `sessionStorage` (cleared on post), so
opening a suggestion and coming back restores it (FR-011).

**Rationale**: No new search machinery; Find already meets the 2 s target at 20,000 listings.

**Alternatives**: Trigram similarity (rejected: a new extension and index for marginal gain).

## 6. Browsing requests

**Decision**: `request.search_vector` (tsvector: title A, description and give-back items B), set by
`modules/requests.ts` on every save, exactly as listings do (001 research §13); GIN index. `GET
/requests` filters by `q`, `kind` (comma list like Find's `type`), `area` (neighbourhood/city parts),
open only, newest first, cursor paging like `GET /listings`. `GET /requests?mine=true` lists the
viewer's own, open first, including closed.

**Rationale**: Same patterns and limits as Find, so it's familiar in code and on screen.

## 7. Public threads

**Decision**: A new `public_message` table belonging to exactly one request or one listing
(`check` one of the two set), with `author_id`, `body` (1–240 characters, plain text), `created_at`,
and `removed_at` (author removal). Not the 001/002 `conversation` machinery.

**Rationale**: Conversations are private by design: participants, read markers, contact sharing,
call times, live streams, mediator sharing. Public threads have none of that: everyone may read and
post, there are no read markers, and only text. Bending `conversation` to allow "everyone" would
weaken the privacy checks that protect proposal messages (constitution III). A small separate table
keeps both simple.

- Readable by every signed-in member who can see the request or listing; postable while the request
  is open, or the listing is not closed/removed (FR-023d). Posting works without JavaScript (plain
  form post).
- **Live updates** (FR-023g): reuse `modules/live.ts`. Its LISTEN/NOTIFY fan-out is generalised from
  "conversation id" to a channel key, so a public thread uses `public_<request or listing id>`.
  Posting or removing a public message runs `NOTIFY` with the message id; a Server-Sent Events
  stream per thread (`GET /requests/{id}/messages/live`, `GET /listings/{id}/messages/live`) passes
  ids to open pages, which fetch the message and append or update it in place, announced in a polite
  live region. Any member who can see the page may subscribe; nothing is marked read. A refresh
  button beside the heading stays as the fallback, as on proposals.
- Paging: newest 20, "Show earlier messages" with a `before` cursor (FR-023b), shown oldest first.
- Removal: the author only; the row keeps its place and shows "Message removed"; the body is
  cleared (FR-023c). No hiding by anyone else (clarification 5). No per-thread posting limit
  (clarification 3). As a safety backstop only, public messages share the existing private-message
  limit of 60 per member per hour (`checkRateLimit('message:…', 60, 60)` in `modules/messaging.ts`),
  which no ordinary conversation reaches; past it the member sees 001's plain "slow down" message.
  **Check with the project owner**: drop the backstop if "no limit" was meant literally.
- Account deletion deletes the member's public messages outright (FR-026).

**Alternatives**: Reusing `conversation` with an "open" flag (rejected above); one thread table plus
messages (rejected: one row per request/listing adds nothing a foreign key doesn't give).

## 8. Raising an issue about a request or a public message

**Decision**: Generalise `listing_flag` into `flag` with exactly one of `listing_id`, `request_id`,
`public_message_id` set. The flag goes to whoever can act: the listing's owner, the asker, or the
message's author. As in 001, a flag never hides or changes anything; it is a written request. The
recipient sees it on My listings, My requests, or under their own message, and the existing `flag`
notification type is used.

**Rationale**: One flag flow for three kinds of thing keeps the code and the help text simple.

**Alternatives**: Three separate flag tables (rejected: three copies of the same code).

## 9. Notifications

**Decision**: Two new notification types, `request` ("Someone offers something for your request")
and `public_message` ("Public messages on your requests and listings"), both off until turned on
(clarification 4). `notification_log` gains a nullable `subject_id` (request or listing id) so public
thread notices are kept to one per thread per member per day (FR-023e), the same way conversation
notices are kept to one per hour.

## 10. Database change

**Decision**: Nothing needs keeping (clarification 2026-06-06), as in 002 research §9: change the
schema files, regenerate the single `0000_initial.sql` (re-applying its hand edits with the same
script as 002), and rebuild with `npm run db:reset -w apps/api` (and `-- --test`). `listing_flag` is
simply replaced by `flag`; no rename or data migration.

## 11. Forms and JavaScript

**Decision**: The request form uses the same building blocks as the listing form (PlaceField,
RepeatingRows for give-back items, weekly times) and so needs JavaScript, like the listing and
proposal forms (owner decision 2026-06-05, 002 research §10). It says so plainly when JavaScript is
off. Every other new page works without JavaScript: Requests, a request, My requests, linking a
listing, closing/reopening, and public threads. Suggestions are a progressive extra on the form.

**Note for the project owner**: this extends the 002 decision to one more form. If the request form
must work without JavaScript, it can drop the place suggestions and the "Add another" rows to plain
fields; the plan would otherwise be unchanged.

## 12. Header and navigation

**Decision**: The main navigation gains **Requests** after Find. The header's buttons become
**Request something** (→ `/requests/new`) and **Offer something** (→ `/listings/new`, replacing
"Share a new listing"), both outlined (constitution II: each page keeps one filled primary button);
on narrow screens they read "Request" and "Offer". "My requests" is a tab on the
Requests page (`/requests?mine=true`), not another nav item.

## Dependency summary (constitution VII)

No new npm packages and no new outside services. Place suggestions reuse 002's Photon proxy.
