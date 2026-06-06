---

description: "Task list for Proposals for Offerings (feature 002)"
---

# Tasks: Proposals for Offerings

**Input**: Design documents from `/specs/002-listing-proposals/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included, as in 001 (research §15 of 001): Vitest module and route tests against the test
database, and one Playwright spec per user story with axe scans in light and dark themes. Within each
story, write the tests first and confirm they fail.

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: User story from spec.md (US1–US7)
- Paths follow plan.md: `apps/api/`, `apps/web/`, `packages/shared/`

## Conventions for every task

- All 001 conventions hold (see the top of
  [001 tasks.md](../001-community-resource-sharing/tasks.md)): read the constitution first; thin
  routes calling one module; `ApiError` with plain-language messages; pages call the API only via
  `apps/web/src/lib/api.ts`; one primary button per screen; no animations; no unapproved
  dependencies (none are added by this feature).
- **Exception (research §10)**: the offering form and the proposal form need JavaScript; they still
  submit as normal form posts and show "This form needs JavaScript turned on." when it's off. Every
  other page keeps working without JavaScript.
- **Migrations**: existing data is not kept. Do not write conversion SQL. After any schema change
  run `npm run db:generate -w apps/api`; before merging, collapse everything into one
  `apps/api/drizzle/0000_initial.sql` (task T008).
- Places: never return an offering place in full except through `viewPlace()` (research §2).
- Changes to authorization, data storage, outside calls, or input handling get a **Security
  review** line before the phase checkpoint; record findings in `docs/security-review.md`.

---

## Phase 1: Setup

**Purpose**: Configuration and dev tooling used by every later phase

- [X] T001 Add `PLACES_URL` (default `https://photon.komoot.io`, empty = off), `PLACES_BIAS` (`lat,lon`, optional) and `PLACES_BBOX` (`minLon,minLat,maxLon,maxLat`, optional) to `apps/api/src/config.ts` (validated with Zod) and `.env.example` with one-line comments; pass them through in `compose.yaml` for the `api` service
- [X] T002 [P] Create `apps/api/scripts/reset-db.ts` (refuses when `NODE_ENV=production`; `drop schema public cascade; create schema public;` then runs `runMigrations()`), and add `"db:reset": "dotenv -e ../../.env -- node scripts/reset-db.ts"` to `apps/api/package.json`
- [X] T003 [P] Create a Photon stub for tests in `apps/api/src/test/places-stub.ts`: a tiny `node:http` server returning fixed GeoJSON features for "Riv…" (district Riverside, city Springfield; a house on 1 Mill Street in Riverside; a business "Riverside Library"), a slow mode (3 s) and an error mode; API tests start it in-process and point `config.PLACES_URL` at it (`apps/api/src/test/env.ts` turns suggestions off by default); the e2e run starts it as a `webServer` in `apps/web/playwright.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The new schema, shared types, and removal of the old agreement and inbox flows, with the
app still building and the remaining 001 tests passing

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create `packages/shared/src/schemas/places.ts`: `placeSchema` = `label` text 1–200 chars (required), `source` enum `suggestion|typed`, optional `name`, `street`, `houseNumber`, `postcode` (text ≤100, only for `suggestion`), optional `neighbourhood`, `city` (text ≤100, only for `suggestion`), optional `lat`, `lon` (numbers, only for `suggestion`); `placeViewSchema` = `{ display }` or full place; export from `packages/shared/src/index.ts`
- [X] T005 [P] Update `packages/shared/src/schemas/offerings.ts`: units list "item, kg, g, lb, oz, litre, hour, portion, bag, box, other"; session length units "minutes, hours, days, weeks"; `handovers` array of `to_requester|at_lister|elsewhere|online` (unique, default empty); `area` and `meetingPlace` as `placeSchema` (nullable); `accepts` (Trade only, ≤10 of `{ description 1–100 chars, amount? > 0, unit? set exactly when amount is }`); `availability` (Service only, ≤14 of `{ weekday 1–7, startTime, endTime }` with `startTime < endTime`); remove `wanted`, `wantedAmount`, `wantedUnit`, `openToOffers`; refinements: `area` required when `handovers` contains `at_lister`, `meetingPlace` required when it contains `elsewhere`; offering view adds `lentOut`, `takenPeriods`, `myOpenProposalId`, `openProposalCount`; status enum `available|paused|closed`
- [X] T006 [P] Create `packages/shared/src/schemas/proposals.ts`: create/update bodies as a discriminated union on offering type per contracts/api.md (all details optional; `place` placeSchema; `loanLength` integer > 0 + `loanLengthUnit` hours/days/weeks (Lend); `amount` decimal > 0 (Gift/Trade); `offers: [{ acceptId, amount? > 0 }]` or `ownOffer` text ≤300 + optional `ownOfferAmount` > 0 + `ownOfferUnit` (Trade, never both); `sessionLength` integer > 0 + unit, `sessions` integer ≥ 1 (Service); optional `message` ≤4000), `decisionNote` ≤500, accept body `{ version }`, proposal view, list item, and issue `{ field, message }`; update `packages/shared/src/schemas/agreements.ts` (remove record/confirm/dispute/cancel bodies; add agreement detail fields from data-model) and `packages/shared/src/schemas/messaging.ts` (new kinds `detail_changed`, `accepted`, `declined`, `withdrawn`, `closed`, `messages_shared`; remove conversation list/create)
- [X] T007 Rewrite the schema files per data-model.md: `apps/api/src/db/schema/offerings.ts` (unit enum + `lb`, `oz`; `session_length_unit` + `days`, `weeks`; `handover` enum and `handovers handover[] default '{}'`; `area` and `meeting_place` as `jsonb`; generated `area_neighbourhood` = `lower(area->>'neighbourhood')` and `area_city` = `lower(area->>'city')` with indexes (accent-insensitive comparison happens in `modules/places.ts`); remove `wanted*`, `open_to_offers`; status enum without `lent_out`; `search_vector` becomes a plain `tsvector` column; new tables `trade_accept` (`position` smallint 0–9, `description` 1–100 chars, `amount` numeric(12,3) > 0 nullable, `unit` set exactly when `amount` is) and `service_availability` (`weekday` 1–7, `start_time < end_time`)); new `apps/api/src/db/schema/proposals.ts` (`proposal` and `proposal_offer` with every column, check, and index in data-model.md, including the partial unique index on (`offering_id`, `requester_id`) where `status = 'open'` and `closed_reason` set exactly when `status = 'closed'`); `apps/api/src/db/schema/agreements.ts` (add `proposal_id` unique, `starts_at`, `has_time`, `handover`, `place`, `loan_starts_at`, `loan_ends_at`, generated `loan_period tstzrange`, `session_length`, `session_length_unit`, `offer jsonb`; remove `return_due`, `confirmation`, `note`; exclusion constraint `exclude using gist (offering_id with =, loan_period with &&) where (returned_at is null)`); `apps/api/src/db/schema/messaging.ts` (`conversation.proposal_id` unique nullable, remove `offering_id`, check exactly one of `proposal_id`/`problem_report_id`; new message kinds); `apps/api/src/db/schema/reports.ts` (`proposal_messages_shared_at`, `proposal_messages_shared_by_id`); export all from `apps/api/src/db/schema/index.ts`
- [X] T008 Delete every file in `apps/api/drizzle/` (including `meta/`), run `npm run db:generate -w apps/api` to produce one `0000_initial.sql`, add `create extension if not exists btree_gist;` at its top (drizzle-kit can't emit the exclusion constraint: add it to the same file by hand with a comment explaining why), and run `npm run db:reset -w apps/api` and `npm run db:reset-test -w apps/api`
- [X] T009 Create `apps/api/src/modules/places.ts` (lookup comes in US7): `normalise(text)` (lower-case, NFD, strip accents), `displayOf(place)` ("neighbourhood, city", whichever known, else typed `label`), `viewPlace(place, { full })` returning the full place or `{ display }`, and `sameArea(offeringArea, place)` (neighbourhoods equal, or cities equal when the offering area has no neighbourhood; `null` = can't tell when either is `typed`); unit tests in `apps/api/src/modules/places.test.ts`
- [X] T010 Update `apps/api/src/modules/offerings.ts` and `apps/api/src/routes/offerings.ts` for the new offering fields (handovers, places stored with normalised parts, units, session units; Trade `accepts` and Service `availability` saved as whole replacements in the same transaction; search vector set by the module from title (A) and description + accepted-thing descriptions (B)); "lent out" derived = has an agreement with `loan_starts_at <= now()` and `returned_at is null`; offering view uses `viewPlace` (full for the owner only for now); remove `lent_out` status transitions; update `apps/api/src/modules/search.ts` (`includeLent` uses the derived condition; area filter matches `area_neighbourhood`, `area_city`, or the display text) and fix `apps/api/src/routes/offerings.test.ts` and `apps/api/src/routes/search.test.ts`
- [X] T011 Strip the 001 agreement flow from `apps/api/src/modules/agreements.ts` and `apps/api/src/routes/agreements.ts`: remove record, agreement candidates, confirm, dispute, cancel; keep `GET /me/agreements`, `GET /agreements/{id}` (new detail fields, full place), `POST /agreements/{id}/returned`; `apps/api/src/modules/reminders.ts` uses `loan_ends_at` (the day after it, community time zone); rewrite `apps/api/src/routes/agreements.test.ts` and `apps/api/src/modules/reminders.test.ts` to create agreements through a test helper that inserts an accepted proposal + agreement directly (`apps/api/src/test/setup.ts`)
- [X] T012 Update `apps/api/src/modules/messaging.ts` and `apps/api/src/routes/conversations.ts`: remove `GET /conversations` and `POST /conversations`; keep the thread endpoints; add `createThread({ proposalId | problemReportId }, participantIds)` used by proposals and reports; update `apps/api/src/modules/reports.ts` to use it; update `GET /me/summary` (`proposalsWithNews` replaces `unreadConversations`) in `apps/api/src/routes/me.ts`; fix `apps/api/src/routes/conversations.test.ts`, `apps/api/src/routes/reports.test.ts`, `apps/api/src/modules/live.test.ts`
- [X] T013 Remove the old web flows so the web app builds: delete `apps/web/src/routes/messages/` and `apps/web/src/routes/offerings/[id]/agreements/`; remove confirm/dispute/cancel from `apps/web/src/routes/agreements/[id]/+page.server.ts` and `+page.svelte`; change the "Messages" nav entry in `apps/web/src/routes/+layout.svelte` to "Proposals" → `/proposals` using `summary.proposalsWithNews`; change "Message about this" on `apps/web/src/routes/offerings/[id]/+page.svelte` to a placeholder link to `/offerings/[id]/propose`; update `apps/web/src/lib/components/OfferingFields.svelte` for the units and session units and remove the wanted/open-to-offers fields; delete `apps/web/tests/e2e/us4-talk.spec.ts` and `us5-agree.spec.ts`, and update `apps/web/tests/e2e/helpers/members.ts` (`messageAbout` → `proposeOn`, added in US1)
- [X] T014 Run `npm run check` and `npm run test`; all remaining 001 tests pass

**Checkpoint**: New schema in place; old inbox and agreement-recording gone; app builds and tests pass

---

## Phase 3: User Story 1 - Make a proposal and have it accepted (Priority: P1) 🎯 MVP

**Goal**: A member makes a proposal on any offering with optional details and a message; only they
change the details; the lister accepts a complete proposal and it becomes the agreement; other
proposals react (closed when nothing is left, told when over what remains or dates overlap)

**Independent Test**: Two members, one offering of each type: propose with nothing filled in, exchange
a message, fill in all details as the requester, accept as the lister, see the agreement and the
offering's remaining amount or lent-out periods (quickstart 2–5)

### Tests for User Story 1 ⚠️

- [X] T015 [P] [US1] Module tests in `apps/api/src/modules/proposals.test.ts`: `proposalIssues` per type (each missing detail; loan length over the maximum; amount over `remaining`; `starts_at` in the past; offering paused; Lend overlap with a not-returned loan; an `online` handover needs no place); accept with wrong `version` → `proposal_changed`; accept with issues → `proposal_not_ready`; concurrent accepts of overlapping loans → one succeeds, the other `dates_taken` (exclusion constraint); gift accept to zero closes other open proposals (`nothing_left`) with a `closed` message; partial remaining keeps others open with an issue; Lend accept keeps others open
- [X] T016 [P] [US1] Route tests in `apps/api/src/routes/proposals.test.ts` for every endpoint in contracts/api.md "Proposals": access (lister can't PATCH; requester can't accept; others get 404), `409 proposal_exists` with `proposalId`, `400` with `fields` for values that don't fit, read-only thread after decline/withdraw (`409 thread_closed`), `detail_changed` message body text, notifications sent per contracts/notifications.md
- [X] T017 [P] [US1] E2E `apps/web/tests/e2e/proposals-us1-accept.spec.ts`: quickstart scenarios 2–5 (lend propose → details → accept; change before accept; overlapping loan; gift nothing-left), with axe scans of `/offerings/[id]/propose`, `/proposals/[id]` (open, accepted, declined), `/proposals` in both themes

### Implementation for User Story 1

- [X] T018 [US1] Create `apps/api/src/modules/proposals.ts` (purpose comment; plain functions): `createProposal` (offering must be `available`; never on own offering; Gift/Trade `amount` defaults to `remaining`; creates the thread via `createThread`; optional first message; notifies the lister), `updateProposal` (requester only, while open; ignores unchanged values; `version + 1`; posts one `detail_changed` message whose body lists each change in plain words, e.g. "Robin changed the pickup time to Saturday 6 June, 10:00"; updates `last_activity_at`), `proposalIssues(proposal, offering, loans, now)` returning `{ field, message }[]` per data-model "Issues" (handover/area/availability/offer rules are added by US2–US4), `acceptProposal` (one transaction: `select … for update` on the offering, version check, issues check, create the agreement copying details (`loan_starts_at` = `starts_at`, `loan_ends_at` = `starts_at` + loan length), update `remaining`/`sessions_remaining` and close the offering `used_up` at zero, close other open proposals `nothing_left` with a `closed` message each, post `accepted`, catch the exclusion-constraint violation as `dates_taken`; after commit notify the requester and affected other requesters), `declineProposal`, `withdrawProposal` (note ≤500; post `declined`/`withdrawn`; notify), `getProposal` (resolves `place`; `canAccept`, `canEdit`), `listProposals` (role, status open/ended, unread from thread read state)
- [X] T019 [US1] Create `apps/api/src/routes/proposals.ts` (thin, `createRoute` + shared schemas for OpenAPI) for `POST /offerings/{id}/proposals`, `GET /proposals`, `GET /proposals/{id}`, `PATCH /proposals/{id}`, `POST /proposals/{id}/accept`, `/decline`, `/withdraw`; mount in `apps/api/src/app.ts`
- [X] T020 [US1] In `apps/api/src/modules/messaging.ts` refuse new messages, contact shares, and calls on a thread whose proposal is `declined`, `withdrawn`, or `closed` (`409 thread_closed`, "This proposal has ended, so no new messages can be added."), and update the proposal's `last_activity_at` on every message
- [X] T021 [US1] Add the proposal notifications from contracts/notifications.md to `apps/api/src/notify/index.ts` (types `message` and `agreement` only; links to `/proposals/{id}` or `/agreements/{id}`; one per thread per hour still applies)
- [X] T022 [US1] Lend periods in `apps/api/src/modules/offerings.ts`: `takenPeriods(offeringId)` = agreements with `returned_at is null` and (`loan_ends_at > now()` or overdue), each `{ startsAt, endsAt, overdue }`; include in `GET /offerings/{id}` for Lend; `myOpenProposalId` for the caller and `openProposalCount` for the owner
- [X] T023 [P] [US1] Create `apps/web/src/lib/components/ProposalFields.svelte` (needs JavaScript; `<noscript>` note): per-type fields, every one optional with "Not decided yet" as the empty choice; when = native date input + optional native time input; how = radio list (all four values for now, labels per research §6); where = plain text input for now (sent as a `typed` place; replaced by PlaceField in US7); Lend loan length + unit with the offering's maximum shown; Gift/Trade amount prefilled with all that remains; Trade own-offer text for now (accepted things come in US3); Service session length + unit and number of times with limits shown; optional message box "Anything you'd rather talk about first?"
- [X] T024 [P] [US1] Create `apps/web/src/lib/components/ProposalDetails.svelte`: current details as a definition list, each empty one "Not decided yet", Lend taken periods ("Already lent: 8–11 Nov"), and issues as a plain list tied to their fields
- [X] T025 [US1] Create `apps/web/src/routes/offerings/[id]/propose/+page.server.ts` and `+page.svelte`: loads the offering (404 for own offering; redirects to the existing open proposal if any); action posts to `POST /offerings/{id}/proposals` and redirects to `/proposals/{id}`; field errors from the API shown next to fields; title and primary button per type ("Ask to borrow", "Ask for this", "Offer a trade", "Ask for this service"; button "Send proposal")
- [X] T026 [US1] Create `apps/web/src/routes/proposals/[id]/+page.server.ts` and `+page.svelte`: ProposalDetails at the top; primary action lister "Accept" (only when `canAccept`; posts `version`; on `proposal_changed` show "Robin changed the details. Please check them again." with the new details), requester "Change details"; secondary "Decline"/"Withdraw" with an optional note and a confirmation step; MessageList and message box below (send, call time actions moved from the old messages page); read-only notice when ended; link to the agreement when accepted; marks the thread read on open
- [X] T027 [US1] Create `apps/web/src/routes/proposals/[id]/edit/+page.server.ts` and `+page.svelte` (requester, open only): ProposalFields filled in; "Save changes" → `PATCH /proposals/{id}` → back to the proposal
- [X] T028 [US1] Create `apps/web/src/routes/proposals/+page.server.ts` and `+page.svelte`: "Asked by me" and "On my offerings" (`?role=` shows one), open first then ended, each with offering title, other member, state in words ("Waiting for Sam", "Needs details: when, where", "Agreed", "Closed: nothing left"), new-activity marker in text; calm empty state
- [X] T029 [US1] Update `apps/web/src/routes/offerings/[id]/+page.svelte` and `+page.server.ts`: per-type primary action to `/offerings/[id]/propose` or "See your proposal"; owner's "Proposals (n)" link; Lend "Already lent: …" periods and "Lent out until …" from `lentOut`
- [X] T030 [US1] Update `apps/web/src/routes/agreements/[id]/+page.svelte` (when, how, place, loan period, amount, offer, sessions; link to the proposal) and `apps/web/src/routes/agreements/+page.svelte` (overdue from `loanEndsAt`)
- [X] T031 [US1] Add `proposeOn(member, offeringId, details)` and `acceptProposal(member, proposalId)` to `apps/web/tests/e2e/helpers/members.ts` and update `apps/web/tests/e2e/us6-problem.spec.ts` and `accessibility.spec.ts` to create agreements through proposals
- [X] T032 [US1] **Security review**: proposal authorization (requester-only edit, lister-only accept/decline, 404 for others), version check, exclusion constraint, thread read-only rule; record in `docs/security-review.md`

**Checkpoint**: Proposals work end to end for all four types (handover options, trade items, service limits, and place suggestions come next)

---

## Phase 4: User Story 2 - Say how the handover happens when offering (Priority: P1)

**Goal**: Offerings carry handover options and a meeting place; proposals choose among them; offering
places show only "neighbourhood, city" until a proposal is accepted

**Independent Test**: Quickstart scenario 1, plus a proposal's "how" offering only the offering's
options and "where" filled from the offering for `at_lister`

### Tests for User Story 2 ⚠️

- [X] T033 [P] [US2] Add to `apps/api/src/routes/offerings.test.ts`: `at_lister` without area → 400 "Please add your area so people know roughly where to pick it up."; `elsewhere` without meeting place → 400; other members get `{ display }` for both places, the owner the full place; and to `apps/api/src/modules/proposals.test.ts`: handover not among the offering's → issue; `at_lister` place read from the offering and not editable (PATCH `place` ignored with `fields.place`); after acceptance the requester gets the full offering area on the proposal, agreement, and offering
- [X] T034 [P] [US2] E2E `apps/web/tests/e2e/proposals-us2-handover.spec.ts`: quickstart 1; proposal form shows only ticked options with type-specific labels; `at_lister` shows "At Sam's place (Riverside, Springfield)"; axe on the offering form step 2 in both themes (covered in `proposals-us1-accept.spec.ts`)

### Implementation for User Story 2

- [X] T035 [US2] In `apps/api/src/modules/offerings.ts` enforce `area` required with `at_lister` and `meetingPlace` with `elsewhere` (plain messages), and in the offering view return full places to the owner and to members with an accepted proposal on the offering, `{ display }` to everyone else (via `viewPlace`)
- [X] T036 [US2] In `apps/api/src/modules/proposals.ts`: handover must be among the offering's `handovers` when it has any (issue "Sam offered: picked up from Sam, or meet somewhere else."); `at_lister` → `place` not stored, resolved from the offering area (display only until accepted); `elsewhere` defaults to the offering's meeting place; `online` clears the place; copy the resolved full place into the agreement on accept
- [X] T037 [US2] In `apps/web/src/lib/components/OfferingFields.svelte` add "How the pickup happens" / "How the trade happens" / "How the service happens" checkboxes with labels per research §6, and a "Meeting place" field shown when the "somewhere else" option is ticked (plain text for now; PlaceField in US7); show both on `apps/web/src/routes/offerings/[id]/+page.svelte` in words
- [X] T038 [US2] In `apps/web/src/lib/components/ProposalFields.svelte` offer only the offering's handovers (all four when none), show "At <name>'s place (<display>)" for `at_lister`, prefill the meeting place for `elsewhere`, hide "where" for online
- [X] T039 [US2] **Security review**: place visibility (`viewPlace` used for every offering place in every response, including search results, member profiles, and export of other people's offerings); record in `docs/security-review.md`

**Checkpoint**: US1 + US2 work together; places are private until acceptance

---

## Phase 5: User Story 3 - List several things accepted in a trade (Priority: P2)

**Goal**: Trade offerings list up to 10 accepted things; no list means open to offers; requesters
choose from the list or describe their own offer

**Independent Test**: Quickstart scenario 6

### Tests for User Story 3 ⚠️

- [X] T040 [P] [US3] Add to `apps/api/src/routes/offerings.test.ts` (11 accepts → 400; replace-as-whole on PATCH; search finds an offering by an accepted thing's description) and `apps/api/src/modules/proposals.test.ts` (offers must belong to the offering; offer amount ≤ the accepted thing's amount; `ownOffer` refused when the offering has accepts and required-for-acceptance when it has none; both together → 400; accepted thing deleted by an offering edit → offer issue)
- [X] T041 [P] [US3] E2E `apps/web/tests/e2e/proposals-us3-trade.spec.ts`: quickstart 6 incl. adding/removing rows with the keyboard and focus moving to the new row; axe in both themes

### Implementation for User Story 3

- [X] T042 [US3] In `apps/api/src/modules/offerings.ts` save and return `accepts` (ordered by `position`), and in `apps/api/src/modules/proposals.ts` save `proposal_offer` rows (`trade_accept_id` unique per proposal; amount > 0 and ≤ the accepted thing's amount when it has one) or `own_offer` (text ≤300, optional amount + unit), add the offer issues, and snapshot the offer into `agreement.offer` on accept
- [X] T043 [P] [US3] Create `apps/web/src/lib/components/RepeatingRows.svelte`: rows from Svelte state, "Add another" (disabled at the limit with the reason in text) and "Remove" per row, indexed field names (`accepts[0].description`…), focus to the new row's first field, removal announced in a polite live region
- [X] T044 [US3] In `apps/web/src/lib/components/OfferingFields.svelte` add "What you'd accept in return" (RepeatingRows of what + amount + unit, ≤10) with the hint "Leave this empty if you're open to offers."; parse indexed fields in `apps/web/src/routes/offerings/new/+page.server.ts` and `apps/web/src/routes/offerings/[id]/edit/+page.server.ts`; offering page shows "Accepts: Eggs (6), Honey (1)" or "Open to offers: <name> hasn't listed anything specific"
- [X] T045 [US3] In `apps/web/src/lib/components/ProposalFields.svelte`: Trade with accepts → checkboxes per accepted thing with an optional amount each; open to offers → "What you offer" text + optional amount and unit

**Checkpoint**: Trades work with lists or open offers

---

## Phase 6: User Story 4 - Ask for a service within what's offered (Priority: P2)

**Goal**: Service offerings have weekly available times; service proposals must fit session length,
times remaining, available times, and area

**Independent Test**: Quickstart scenario 7

### Tests for User Story 4 ⚠️

- [X] T046 [P] [US4] Add to `apps/api/src/modules/proposals.test.ts`: start outside availability (wrong weekday, before start, end after window for hours/minutes; days/weeks only check the start) in the community time zone (`TZ=Europe/London` in the test, crossing a DST change); date without time when the offering has availability → issue; session length over the offering's; sessions over `sessions_remaining`; place in another neighbourhood → issue; offering area a whole city → same-city place OK; typed place → no issue but `areaUnchecked: true` in the view; accept decrements `sessions_remaining` and closes others at zero
- [X] T047 [P] [US4] E2E `apps/web/tests/e2e/proposals-us4-service.spec.ts`: quickstart 7; availability rows on the offering form; axe in both themes

### Implementation for User Story 4

- [X] T048 [US4] In `apps/api/src/modules/offerings.ts` save and return `availability` (≤14 rows, `weekday` 1 (Monday)–7 (Sunday), `start_time < end_time`) for Service offerings
- [X] T049 [US4] In `apps/api/src/modules/proposals.ts` add the service issues (research §5): time required when the offering has availability; start within a row for that weekday in the community time zone, end too for minutes/hours; session length ≤ the offering's (compare in minutes; days/weeks converted); sessions ≤ `sessions_remaining`; `sameArea(offering.area, place)` false → issue "Jo offers this in Riverside only."; `null` → no issue, `areaUnchecked` flag on the proposal view
- [X] T050 [US4] In `apps/web/src/lib/components/OfferingFields.svelte` add "When it's offered" (RepeatingRows of weekday `<select>` + from/to native time inputs, ≤14); show the times on the offering page ("Monday–Friday, 18:00–21:00", consecutive days grouped) and the limits in `ProposalFields.svelte`; show "wunan couldn't check this place against the offering's area" on the proposal page when `areaUnchecked`

**Checkpoint**: Services enforce their limits

---

## Phase 7: User Story 5 - Everything about an exchange on one page (Priority: P2)

**Goal**: The proposal page is the one place for details, messages, contact sharing, and call times;
live updates refresh details; mediators see proposal messages only when shared

**Independent Test**: Quickstart scenarios 8 and 11

### Tests for User Story 5 ⚠️

- [X] T051 [P] [US5] Add to `apps/api/src/routes/reports.test.ts`: mediators get 404 on the proposal thread until `POST /reports/{id}/share-proposal-messages` by the reporter or reported member (others 403/404); then read-only (POST message → 403); second share → `409 already_shared`; `messages_shared` message posted in the report thread; `GET /reports/{id}` returns `proposalConversationId` once shared
- [X] T052 [P] [US5] E2E `apps/web/tests/e2e/proposals-us5-one-page.spec.ts`: quickstart 8 and 11; a detail change by the requester appears on the lister's open page without reload and updates the details block; contact sharing from a proposal; screen-reader announcement text present in the polite live region

### Implementation for User Story 5

- [X] T053 [US5] In `apps/api/src/modules/reports.ts` and `apps/api/src/routes/reports.ts` add `POST /reports/{id}/share-proposal-messages` (sets `proposal_messages_shared_at` and `_by_id` once, confirmation done in the client, posts `messages_shared` in the report thread "Robin let the helpers read their messages about this agreement."); extend thread read access in `apps/api/src/modules/messaging.ts` to current mediators of a report whose proposal messages are shared (read-only)
- [X] T054 [US5] Create `apps/web/src/routes/proposals/[id]/share-contact/+page.server.ts` and `+page.svelte` (moved from the deleted `/messages/[id]/share-contact`, same review-then-confirm flow) and `apps/web/src/routes/proposals/[id]/live/+server.ts` (moved from `/messages/[id]/live`) (built as `/threads/[id]/share-contact` and `/threads/[id]/live`, shared with request-for-help threads)
- [X] T055 [US5] Update `apps/web/src/lib/components/MessageList.svelte`: render the new kinds as quiet history notes (not speech bubbles), and on a `detail_changed` event call `invalidate()` so the proposal page's details refresh, keeping scroll position and the 001 quiet rules (FR-018a)
- [X] T056 [US5] In `apps/web/src/routes/reports/[id]/+page.svelte` and `+page.server.ts` add "Let the helpers read your messages about this" for the reporter and reported member, with a plain explanation and a confirmation step; mediators see a read-only link to the shared messages (`apps/web/src/routes/reports/[id]/proposal-messages/+page.svelte`)

**Checkpoint**: One page per exchange; mediation sharing works

---

## Phase 8: User Story 6 - New units and lengths (Priority: P3)

**Goal**: lb and oz amounts; service lengths in days and weeks

**Independent Test**: Quickstart scenario 9

- [X] T057 [P] [US6] Add unit and length formatting cases to `apps/web/src/lib/format.ts` ("2 lb", "8 oz", "2 days each time", "1 week each time") with tests in `apps/web/src/lib/format.test.ts`, and add a round-trip case for `lb`, `oz`, `days`, `weeks` to `apps/api/src/routes/offerings.test.ts` (lb/oz and days/weeks checked in API and browser tests; no separate `format.test.ts`)
- [X] T058 [US6] Check the unit and session-unit `<select>` lists in `apps/web/src/lib/components/OfferingFields.svelte` and `ProposalFields.svelte` show the full lists in the data-model order; add the gift-in-lb and service-in-days steps to `apps/web/tests/e2e/us2-list.spec.ts`

**Checkpoint**: New units usable everywhere

---

## Phase 9: User Story 7 - Pick places easily (Priority: P3)

**Goal**: Every place field suggests addresses, neighbourhoods, cities, and businesses from the
operator's Photon server, called only by the API

**Independent Test**: Quickstart scenario 10, and the fallback with `PLACES_URL=` empty

### Tests for User Story 7 ⚠️

- [X] T059 [P] [US7] Add to `apps/api/src/modules/places.test.ts` and new `apps/api/src/routes/places.test.ts` (against the T003 stub): mapping of Photon features to places (district → neighbourhood, locality fallback, city, house, business name); `q` shorter than 3 or longer than 100 → 400; at most 8 items; cache hit doesn't call the stub again; slow stub (>2 s) or error → `503 places_unavailable`; `PLACES_URL` empty → 503; 61st lookup in a minute → 429; the outgoing request carries only `q`, `limit`, `lang`, and the configured bias/bbox (no cookies, no member data)
- [X] T060 [P] [US7] E2E `apps/web/tests/e2e/proposals-us7-places.spec.ts`: quickstart 10 in the offering area, meeting place, and proposal place fields; keyboard only; picking a full address on an offering area shows only "Riverside, Springfield" to another member; stub in error mode → field still saves typed text; axe on an open suggestion list in both themes

### Implementation for User Story 7

- [X] T061 [US7] Add `searchPlaces(q)` to `apps/api/src/modules/places.ts` (research §1): `fetch` to `${PLACES_URL}/api?q=&limit=8&lang=en` plus `lat`/`lon` from `PLACES_BIAS` and `bbox` from `PLACES_BBOX`, `AbortSignal.timeout(2000)`, no headers beyond `accept` and a generic `user-agent: wunan`; map features to places; 10-minute in-memory cache (`Map`, at most 500 entries, oldest dropped first); errors → `ApiError(503, 'places_unavailable', …)`; never log `q`
- [X] T062 [US7] Create `apps/api/src/routes/places.ts` (`GET /places`, member only, 60 per member per minute via `apps/api/src/lib/rate-limit.ts`) and mount it in `apps/api/src/app.ts`
- [X] T063 [US7] Create `apps/web/src/routes/places/+server.ts` (GET, signed-in member, same-origin; forwards `q` to `GET /api/v1/places`; passes 503 through as `{ items: [], unavailable: true }`)
- [X] T064 [US7] Create `apps/web/src/lib/components/PlaceField.svelte` (research §10): Bits UI Combobox over a text input with a visible label and hint; suggestions after 3 characters and a 300 ms pause; up to 8 with the label and a second line for the kind (address, neighbourhood, city, place); Enter picks, Escape closes; result count announced politely; the picked place in a hidden JSON input; typing after a pick turns it back into a `typed` place; when unavailable it stays a plain text field and says once, quietly, "Suggestions aren't available right now."; for offering places the hint "Only the neighbourhood and city are shown until you accept a proposal."
- [X] T065 [US7] Use PlaceField for the area and meeting place in `apps/web/src/lib/components/OfferingFields.svelte` and for "where" in `ProposalFields.svelte`; parse the hidden JSON with `placeSchema` in the offering and proposal form actions
- [X] T066 [US7] Add "Place suggestions" to `docs/operator.md`: what is sent (only the typed text, from the server), the default public server and its fair-use expectations, `PLACES_BIAS`/`PLACES_BBOX`, self-hosting Photon (link to its docs), turning suggestions off with `PLACES_URL=`
- [X] T067 [US7] **Security review**: places proxy (no member data in outgoing requests, timeout, response validated with Zod before use, rate limit, no `q` in logs); record in `docs/security-review.md`

**Checkpoint**: All stories complete

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T068 Quiet close (FR-020a): add `closeQuietProposals(now)` to `apps/api/src/modules/proposals.ts` (open proposals with `last_activity_at` older than 30 days → `closed`/`quiet`, a `closed` message "This proposal was closed after a quiet month.", both members notified) and call it from the hourly job in `apps/api/src/index.ts` and `apps/api/scripts/reminders-once.ts`; test in `apps/api/src/modules/proposals.test.ts` (quickstart 12)
- [X] T069 [P] Account deletion closes the member's open proposals (`member_left`, `closed` message, other member notified) in `apps/api/src/modules/members.ts`; test in `apps/api/src/routes/me-settings.test.ts`
- [X] T070 [P] Export: add `proposals.json` (every proposal made or received, details, state, its thread's messages) and the new agreement fields; keep only report threads in `conversations.json`, in `apps/api/src/modules/export.ts`; update the export test and the export page text in `apps/web/src/routes/settings/export/+page.svelte` (quickstart 13)
- [X] T071 [P] Rewrite help topics in `apps/web/src/lib/help/`: `Messages.svelte` → `Proposals.svelte` ("Proposals and messages"), `Agreements.svelte` ("Agreements and returns"), update `Offering.svelte` (handover options, trade list, service times, places), `YourData.svelte` (place suggestions: what is sent), and `index.ts`; fix `HelpLink` topics on changed pages
- [X] T072 [P] Update `apps/api/scripts/seed-demo.ts`: handovers, places with neighbourhood/city, trade accepts, service availability, a few open and accepted proposals instead of conversations and recorded agreements
- [X] T073 Point `apps/api/src/openapi.test.ts` at `specs/002-listing-proposals/contracts/api.md`; make every listed endpoint appear in the OpenAPI document
- [X] T074 [P] Update `apps/web/tests/e2e/accessibility.spec.ts` page list (remove `/messages…`, `/offerings/[id]/agreements/new`; add `/proposals`, `/proposals/[id]`, `/proposals/[id]/edit`, `/offerings/[id]/propose`, `/proposals/[id]/share-contact`) for 320 px and 200% zoom checks
- [X] T075 Final security review of the whole feature and `npm run audit`; record in `docs/security-review.md`
- [ ] T076 Run `npm run check`, `npm run test`, `npm run test:e2e`, and the manual [quickstart.md](quickstart.md) scenarios; note anything only checkable by hand

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup; blocks all stories. T004–T006 in parallel, then T007 → T008 → T009–T013 → T014
- **US1 (Phase 3)**: after Foundational. MVP
- **US2 (Phase 4)**: after US1 (extends `proposals.ts` and `ProposalFields.svelte`)
- **US3 (Phase 5)** and **US4 (Phase 6)**: after US1; independent of each other and of US2, but both edit `ProposalFields.svelte`, `OfferingFields.svelte` and `proposals.ts`, so run sequentially if one person works on them. US4 uses `RepeatingRows` from US3 (T043)
- **US5 (Phase 7)**: after US1
- **US6 (Phase 8)**: after Foundational (schema done there); any time
- **US7 (Phase 9)**: after US2 (offering place fields) — PlaceField replaces the plain inputs from US1/US2
- **Polish (Phase 10)**: after the stories it touches; T073 last among API changes

### Within Each User Story

- Tests first and failing → API module → routes → web components → pages → security review

### Parallel Opportunities

- Phase 1: T002, T003
- Phase 2: T004, T005, T006
- US1: T015, T016, T017 together; T023, T024 together once T018–T019 exist
- US2: T033, T034; US3: T040, T041, T043; US4: T046, T047; US5: T051, T052; US7: T059, T060
- US5 and US6 can run alongside US3/US4 (different files)
- Polish: T069, T070, T071, T072, T074

## Parallel Example: User Story 1

```text
Task: "Module tests in apps/api/src/modules/proposals.test.ts"   (T015)
Task: "Route tests in apps/api/src/routes/proposals.test.ts"     (T016)
Task: "E2E apps/web/tests/e2e/proposals-us1-accept.spec.ts"      (T017)
# after T018–T019:
Task: "ProposalFields.svelte"                                    (T023)
Task: "ProposalDetails.svelte"                                   (T024)
```

## Implementation Strategy

### MVP First (Setup + Foundational + US1)

1. Phases 1–2: new schema, old flows removed, tests green
2. Phase 3: proposals for all types with plain fields
3. **Stop and validate** with quickstart 2–5: the core workflow already replaces 001's messaging and
   agreement recording

### Incremental Delivery

US2 (handovers, place privacy) → US3 (trade lists) / US4 (service limits) → US5 (one page, mediation
sharing) → US6 (units) → US7 (place suggestions) → Polish. Each adds value without breaking the
previous ones.

---

## Phase 11: Convergence

- [X] T077 CRITICAL: keep one primary action per screen: restyle the header's "Share a new offering" button in `apps/web/src/routes/+layout.svelte` as a secondary (outline) button so each page's own main button (e.g. "Ask to borrow", "Accept", "Send proposal") stays the only primary one, and check every page in `apps/web/tests/e2e/accessibility.spec.ts` still passes per Constitution II (contradicts)
- [X] T078 Show an earlier loan that isn't back yet on the next loan: on `GET /proposals/{id}` and `GET /agreements/{id}` for Lend, include the overdue unreturned loan before this one (`apps/api/src/modules/proposals.ts`, `apps/api/src/modules/agreements.ts`), and show a calm note to the lister and the next borrower in `apps/web/src/lib/components/ProposalDetails.svelte` and `apps/web/src/routes/agreements/[id]/+page.svelte` ("The previous loan hasn't been marked returned yet."), with an API test per spec Edge Cases "Earlier loan not back in time" (partial)
- [X] T079 Align `specs/002-listing-proposals/contracts/api.md` with how proposals work: values that don't fit the offering (e.g. a loan longer than the maximum) are saved and reported as `issues`, not refused with `400`; only details that don't apply to the type, half-given pairs, and offers not from the offering are refused, per plan research §3 (contradicts)
- [X] T080 Update `specs/002-listing-proposals/contracts/pages.md` for the routes as built: `/` redirects to Find (no home page), Find's kind tick-boxes and `/offerings/more`, `/offerings/[id]/issue`, `/threads/[id]/call`, pop-up dialogs for contact sharing, call times and raising an issue, the header (account menu, "Share a new offering"), and the single-form `/settings` with a shared settings layout, per plan: Project Structure (unrequested)
- [X] T081 Record in `specs/002-listing-proposals/research.md` §10 that PlaceField is a small hand-written ARIA combobox rather than Bits UI Combobox (with the reason and its keyboard/screen-reader tests), per plan research §10 (contradicts)
