---

description: "Task list for Arrangements (feature 004)"
---

# Tasks: Arrangements

**Input**: Design documents from `/specs/004-arrangements/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included, as in 001 to 003: Vitest module and route tests against the test database, and
Playwright specs per user story with axe scans in light and dark themes. Within each story, write
the tests first and confirm they fail.

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: User story from spec.md (US1–US4)
- Paths follow plan.md: `apps/api/`, `apps/web/`, `packages/shared/`

## Conventions for every task

- All 001 to 003 conventions hold (top of [003 tasks.md](../003-member-requests/tasks.md)) and
  [AGENTS.md](../../AGENTS.md): read the constitution first; thin routes calling one module;
  `ApiError` with plain-language messages; pages call the API only via `apps/web/src/lib/api.ts`;
  one filled primary button per screen; no animations; no new dependencies.
- **Names**: the code says "arrangement" everywhere. No file, function, field, route, error code or
  visible page name keeps "proposal" or "agreement" as the name of the thing, except: the words
  "proposal" and "agreement" in sentences members read (spec FR-023), the `agreement` notification
  type, and `agreed…` field names.
- **Rules don't change**: what blocks accepting, versions, loans not overlapping, amounts left,
  closing others, the quiet month, place privacy, and request closing are moved, not rewritten. Move
  their tests with them and keep them passing.
- **Database (research §8)**: nothing is kept. After schema changes, delete `apps/api/drizzle/`,
  run `npm run db:generate -w apps/api` to produce one `0000_initial.sql`, re-apply its hand edits
  (the `btree_gist` extension at the top and the loan exclusion constraint, now
  `ALTER TABLE "arrangement" ADD CONSTRAINT "arrangement_loans_dont_overlap" EXCLUDE USING gist
  ("offering_id" WITH =, "loan_period" WITH &&) WHERE ("returned_at" IS NULL);` with its comment),
  then `npm run db:reset -w apps/api` and `npm run db:reset -w apps/api -- --test`. No conversion
  SQL.
- **In-place actions**: every form action on the arrangement page uses `stayPut` from
  `apps/web/src/lib/stay-put.ts`, shows its result beside the button pressed, has an `#anchor`
  action for no JavaScript, and confirmations use `use:reveal`.
- **After each phase**: `npm run check`, `npm test`, and the relevant `npm run test:e2e -- <spec>`
  from `apps/web` must pass. Don't edit files while a browser test run is going (the test servers
  reload and tests fail falsely).

---

## Phase 1: Setup

**Purpose**: A branch, and the contract test knowing about this feature.

- [ ] T001 Create and switch to branch `004-arrangements` from the current branch (`git switch -c 004-arrangements`); confirm `.specify/feature.json` names `specs/004-arrangements`
- [ ] T002 Add `'004-arrangements'` to the list of contracts read by `apps/api/src/openapi.test.ts` (update its comment), so every endpoint in `specs/004-arrangements/contracts/api.md` must exist in the OpenAPI document. Add a small named list `notBuiltYet` in the test holding `POST /arrangements/{id}/done` and `POST /arrangements/{id}/not-done` (comment: removed in T037), which the check skips; expect the test to fail until Phase 2 is done

---

## Phase 2: Foundation (blocks every story)

**Purpose**: One `arrangement` in the database, the API and the shared schemas, with today's
behaviour under the new names and one address per exchange. No new behaviour yet.

**Checkpoint**: everything a member could do before still works, at `/arrangements/…`; all existing
tests pass under their new names.

### Shared schemas

- [ ] T003 Create `packages/shared/src/schemas/arrangements.ts` (purpose comment) from `schemas/proposals.ts` and `schemas/agreements.ts`, then delete those two and update `packages/shared/src/index.ts`: `ArrangementStatus` = `open | agreed | declined | withdrawn | closed`; `ArrangementClosedReason` = `nothing_left | quiet | member_left`; `ArrangementDetailsInput` and `CreateArrangement` (the 002 inputs unchanged, with 003's optional `requestId`); `Arrangement` and `ArrangementSummary` exactly as the two shapes in [contracts/api.md](contracts/api.md) "Shapes" (`agreed: null | { at, place, offer, loanStartsAt, loanEndsAt, overdue, returnedAt, doneAt, doneBy }`, `myRole: requester | lister | helper`); leave `stage`, `needsMe`, `timeline`, `canAskAgain` and `ArrangementList` for T022 but declare them optional now so later tasks only tighten them
- [ ] T004 [P] Rename fields in the other shared schemas per [data-model.md](data-model.md) "Shared schemas": in `packages/shared/src/schemas/offerings.ts` `myOpenProposalId` → `myArrangement: { id, status } | null` and `openProposalCount` → `openArrangementCount`; in `schemas/requests.ts` `closedByAgreementId` → `closedByArrangementId` and `myOtherOpenProposals` → `myOtherOpenArrangements`; in `schemas/messaging.ts` add message kinds `asked`, `returned`, `done`, `not_done`; in the reports schema `agreementId` → `arrangementId`, `proposalMessagesShared` → `messagesShared`, `proposalConversationId` → `arrangementConversationId`; in the summary schema replace `proposalsWithNews` and `agreementsNeedingAttention` with `arrangementsNeedingYou`

### Database

- [ ] T005 Create `apps/api/src/db/schema/arrangements.ts` (purpose comment) replacing `proposals.ts` and `agreements.ts` (delete both; update `db/schema/index.ts`): table `arrangement` with every field in [data-model.md](data-model.md) "arrangement", enums `arrangement_status` and `arrangement_closed_reason`, and these checks, each as its own named `check(...)`: closed has a reason and only closed does; the 002 number, unit and text-length checks (`ownOffer` ≤ 300, `decisionNote` ≤ 500); `agreedAt is not null` exactly when `status = 'agreed'`; `agreedPlace`, `agreedOffer`, `loanStartsAt`, `loanEndsAt`, `returnedAt`, `reminderSentAt`, `doneAt` null unless `status = 'agreed'`; `loanStartsAt` and `loanEndsAt` both set or both null and start < end; `returnedAt` only with a loan period; `doneAt` only without one; `doneAt` and `doneById` both or neither. Generated `loanPeriod` as today's `agreement.loanPeriod`. Indexes: unique `(offeringId, requesterId) where status <> 'agreed'`; `(requesterId, status)`; `(offeringId, status)`; `(status, lastActivityAt)`. Table `arrangement_offer` = `proposal_offer` with `arrangementId` (`on delete cascade`), unique `(arrangementId, tradeAcceptId)`. Drop `agreement_outcome`
- [ ] T006 Point the other tables at it: in `apps/api/src/db/schema/messaging.ts` `conversation.proposalId` → `arrangementId` (unique, `on delete cascade`; keep the exactly-one-owner check) and add `asked`, `returned`, `done`, `not_done` to `message_kind`; in `db/schema/reports.ts` `agreementId` → `arrangementId`, `proposalMessagesSharedAt/ById` → `messagesSharedAt/ById`; in `db/schema/requests.ts` `closedByAgreementId` → `closedByArrangementId` (`on delete set null`, check renamed)
- [ ] T007 Regenerate the migration per "Database" in the conventions (delete `apps/api/drizzle/`, generate, re-apply `btree_gist` and the `arrangement_loans_dont_overlap` constraint by hand, reset the dev and test databases)

### API module and routes

- [ ] T008 Move the 002 issue rules unchanged from `apps/api/src/modules/proposals.ts` into `apps/api/src/modules/arrangement-issues.ts` (purpose comment): `proposalIssues` → `arrangementIssues`, `handoverWords`, `describeTimes`, and the helpers only they use; move their unit tests from `modules/proposals.test.ts` into `modules/arrangement-issues.test.ts`
- [ ] T009 Create `apps/api/src/modules/arrangements.ts` (purpose comment) from the rest of `modules/proposals.ts` and all of `modules/agreements.ts`, then delete both: `createArrangement` (new row only for now; `409 already_open` with the existing id), `updateArrangement`, `acceptArrangement` (sets `status = 'agreed'`, `agreedAt`, `agreedPlace` = today's resolved place, `agreedOffer` = today's offer snapshot, and `loanStartsAt` / `loanEndsAt` for Lend, on the same row inside today's transaction; keeps the `23P01` → `dates_taken` handling), `declineArrangement`, `withdrawArrangement`, `closeArrangements`, `closeQuietArrangements`, `markReturned` (also posts a `returned` note via `postEvent` and moves `lastActivityAt`), `getArrangement` (returns `agreed` as an object when agreed; `myRole` `helper` replaces `mediator`; helpers only when `status = 'agreed'`, else not found), `listArrangements` (flat for now: `?side=asked|offered`, newest activity first), `openArrangementsOf`, `overdueLoansCondition`, and the hooks `setHelperCheck` / `setReportsLookup` (renamed from `setMediatorCheck`). Error codes `arrangement_ended`, `arrangement_changed`, `arrangement_not_ready`. Notification links become `/arrangements/{id}`
- [ ] T010 Create `apps/api/src/routes/arrangements.ts` replacing `routes/proposals.ts` and `routes/agreements.ts` (delete both; update `app-router.ts`): the endpoints in [contracts/api.md](contracts/api.md) "Arrangements" except `done` and `not-done` (T024), with OpenAPI summaries; `POST /arrangements/{id}/reports` moves here from `routes/reports.ts`
- [ ] T011 [P] Re-point `apps/api/src/modules/reports.ts` and `apps/api/src/routes/reports.ts` at arrangements: `arrangementId`, `messagesSharedAt`, `shareMessages` and `POST /reports/{id}/share-messages`, `setHelperCheck`; report responses per "Changed elsewhere" in the API contract; a report can only be made while the arrangement is `agreed`
- [ ] T012 [P] Re-point `apps/api/src/modules/messaging.ts` and `apps/api/src/routes/conversations.ts`: `conversation.arrangementId`; `canWrite` true while the arrangement is `open` or `agreed`; the new kinds pass through `toJson`; previews and `acceptedProposals`-style helpers renamed
- [ ] T013 [P] Re-point `apps/api/src/modules/offerings.ts`, `routes/offerings.ts`, `modules/requests.ts`, `routes/requests.ts`, `modules/search.ts`: amounts and sessions left, taken loan periods, `myArrangement`, `openArrangementCount`, `closedByArrangementId`, `myOtherOpenArrangements`, and request closing inside the accept transaction, all reading `arrangement`
- [ ] T014 [P] Re-point `apps/api/src/modules/reminders.ts`, `modules/members.ts` (leaving closes open arrangements with `member_left`), `modules/export.ts` (one `arrangements` section per [data-model.md](data-model.md) "Export", README text updated), `routes/me.ts` (`arrangementsNeedingYou` = today's two counts added together for now; T021 gives it its real rule), and `apps/api/scripts/seed-demo.ts`
- [ ] T015 Rename and update the API tests so they pass against the new names with their assertions otherwise unchanged: `modules/proposals.test.ts` and `routes/proposals.test.ts`, `routes/agreements.test.ts` → `modules/arrangements.test.ts`, `routes/arrangements.test.ts`; update `modules/earlier-loan.test.ts`, `reminders.test.ts`, `request-closing.test.ts`, `routes/reports.test.ts`, `conversations.test.ts`, `me-settings.test.ts`, `offerings.test.ts`, `requests.test.ts`, and `apps/api/src/test/` helpers
- [ ] T016 Take the replaced rows out of the older contracts so the contract test matches the code: in `specs/002-listing-proposals/contracts/api.md` the "Proposals" table rows, the `/me/agreements`, `/agreements/{id}`, `/agreements/{id}/returned`, `/agreements/{id}/reports` and `/reports/{id}/share-proposal-messages` rows, and the `/me/summary` row's field names; in `specs/003-member-requests/contracts/api.md` the three proposal rows; each replaced by one line pointing to `specs/004-arrangements/contracts/api.md`. `npm test` passes, including `openapi.test.ts`

### Web app, same behaviour at the new addresses

- [ ] T017 Rename in `apps/web/src/lib/`: `proposal-thread.ts` → `arrangement-thread.ts`; `components/ProposalMessages.svelte` → `ArrangementMessages.svelte` (its "ended" line says "This arrangement has ended, so no new messages can be added."); `components/ProposalFields.svelte` → `ArrangementFields.svelte`; `components/ProposalDetails.svelte` → `ArrangementDetails.svelte`, which when `arrangement.agreed` is set shows the heading "What was agreed", the agreed place in full and what is given in return, and loan dates, as today's agreement page does; update every import
- [ ] T018 Create `apps/web/src/routes/arrangements/[id]/+page.server.ts` and `+page.svelte` from `routes/proposals/[id]/` and `routes/agreements/[id]/`: one page that shows the header, `ArrangementDetails`, the existing proposal actions while open (`accept`, `decline`, `withdraw`), and once agreed the existing agreement parts (earlier-loan note, `returned`, requests for help, "Ask for help"), with the messages panel on the right (`page-columns`); accepting stays on the page (no redirect). Move `proposals/[id]/edit/` → `arrangements/[id]/edit/` and `agreements/[id]/report/` → `arrangements/[id]/report/`. Delete `routes/proposals/` and `routes/agreements/`
- [ ] T019 Create `apps/web/src/routes/arrangements/+page.server.ts` and `+page.svelte` as a plain list for now (today's proposals list markup over `GET /arrangements`), and re-point everything that linked to the old pages: `routes/+layout.svelte` (one "Arrangements" link with `arrangementsNeedingYou`), `routes/+layout.server.ts`, `routes/offerings/[id]/+page.svelte` and `propose/+page.server.ts` (posts to `/offerings/{id}/arrangements`, lands on `/arrangements/{id}`), `routes/requests/[id]/+page.svelte`, `routes/reports/[id]/` (`share` action → `/share-messages`), `routes/threads/[id]/`, `lib/format.ts`
- [ ] T020 Update the browser tests to the new routes and API with their assertions otherwise unchanged: `apps/web/tests/e2e/helpers/members.ts` (`proposeOn` posts to `/arrangements`), `proposals-us1-accept`, `proposals-us3-trade`, `proposals-us4-service`, `proposals-us5-one-page`, `proposals-us7-places`, `requests-us4-agree`, `us6-problem`, `stay-put`, `accessibility` specs (after accepting, the same page shows the agreed record instead of a new address). Run the full suite: `npm run check`, `npm test`, `npm run test:e2e` all pass

---

## Phase 3: User Story 1 - See everything I'm arranging in one list (Priority: P1) 🎯 MVP

**Goal**: One "Arrangements" list grouped as Needs you / In progress / Finished, with a filter and
one count in the header.

**Independent Test**: With one arrangement being arranged, one agreed, and one loan past its end,
open "Arrangements" and check each appears once, with the right stage words, under the right
heading, and that the header count equals the number under "Needs you".

### Tests for User Story 1

- [ ] T021 [P] [US1] Create `apps/api/src/modules/arrangement-stage.test.ts`: unit tests for `stageOf(row, offeringType, now)` covering every row of "Stage" in [research.md](research.md) §2 (`arranging`; agreed loan before start `agreed`, after start `on_loan`, marked `returned`; agreed gift `agreed`, marked `done`; declined, withdrawn, closed `ended`) and for `needsMe(...)`: requester with issues → true; lister with no issues → true; owner of a loan past `loanEndsAt` and not returned → true, the borrower → false; an unread message written by the other member (`text`, `call_accepted`) → true, but unread notes that wunan writes (`done`, `not_done`, `returned`, `accepted`, `detail_changed`, …) → false; an agreed gift not marked as done → false for both; a loan out but not yet past `loanEndsAt` → false for the owner; ended → false unless there is an unread message from the other member
- [ ] T022 [P] [US1] Add to `apps/api/src/routes/arrangements.test.ts`: `GET /arrangements` returns `{ needsYou, inProgress, finished, finishedNext }` with each of a member's arrangements in exactly one group and `stage` / `needsMe` on every summary; ordered by `lastActivityAt` newest first; `?side=asked` and `?side=offered` narrow it; with 25 finished, `finished` has 20 and `?group=finished&cursor=` returns the other 5 with `finishedNext: null`; an arrangement the caller only helps with never appears; `GET /me/summary.arrangementsNeedingYou` equals `needsYou.length`
- [ ] T023 [P] [US1] Create `apps/web/tests/e2e/arrangements-us1-list.spec.ts`: Sam asks for two of Fay's offerings (one with nothing filled in, one complete) and Fay has a loan to Sam past its end; as Sam the list shows "Needs you" with "Needs details: when, how" and "In progress" with "Waiting for Fay"; as Fay "Ready for you to accept" and "It was due back …" are under "Needs you"; the header shows one "Arrangements" link whose count equals the cards under "Needs you" and has no "Proposals" or "Agreements" link; "I asked" / "On my offerings" / "All" filter by link with `aria-current`, without JavaScript too; an empty filter says so calmly; a member with nothing sees "You're not arranging anything yet." with links to Offerings and "Request something"; whole cards are links; axe scans (`expectAccessible`) for the grouped list, a filtered list, and the empty state

### Implementation for User Story 1

- [ ] T024 [US1] Create `apps/api/src/modules/arrangement-stage.ts` (purpose comment): pure `stageOf` and `needsMe` per [research.md](research.md) §2 and `groupOf` (`needsYou` when `needsMe`, else `finished` for `returned` / `done` / `ended`, else `inProgress`); tighten `stage` and `needsMe` to required in `packages/shared/src/schemas/arrangements.ts` and add `ArrangementList`
- [ ] T025 [US1] In `apps/api/src/modules/arrangements.ts` make `listArrangements` return the three groups per [contracts/api.md](contracts/api.md) and [research.md](research.md) §7 (issues computed only for open ones; `finished` 20 at a time by cursor on `lastActivityAt, id`; never arrangements the caller only helps with) and add `countNeedingMe(memberId)`; "unread" for `needsMe` counts only messages written by the other member (kinds `text`, `call_accepted`), never wunan's notes; use it for `arrangementsNeedingYou` in `apps/api/src/routes/me.ts`; put `stage` and `needsMe` on `getArrangement` too
- [ ] T026 [P] [US1] Add `stageWords(arrangement)` and `sideWords(arrangement)` to `apps/web/src/lib/format.ts` per "Stage words" in [contracts/pages.md](contracts/pages.md) (reusing today's "Needs details: …" / "Ready for you to accept" / "Waiting for <name>" wording; "It was due back …", never "late" or "overdue"), replacing the proposals list's `state()` and `agreementSentence()` where they were used for lists; unit-free, covered by T023
- [ ] T027 [P] [US1] Create `apps/web/src/lib/components/ArrangementCard.svelte` (purpose comment): a `surface` card that is one link (title underlined, chevron), showing `sideWords`, "With <name>", `stageWords`, "New activity" when `unread`, and the latest message's first line (truncated)
- [ ] T028 [US1] Rewrite `apps/web/src/routes/arrangements/+page.server.ts` and `+page.svelte` per [contracts/pages.md](contracts/pages.md) `/arrangements`: heading, one line, Help; the `segmented` filter (`?side=`); the three groups, each only when non-empty, cards in two columns on wide screens; "Show more" for Finished that adds below without moving the page (a plain link without JavaScript), served by a new `apps/web/src/routes/arrangements/more/+server.ts`; the empty states; no filled button
- [ ] T029 [US1] In `apps/web/src/routes/+layout.svelte` read the count to screen readers as "N need you" (`countText`), and make the phone "Menu" dot follow it; confirm T021–T023 pass

**Checkpoint**: the list is complete and testable on its own.

---

## Phase 4: User Story 2 - Follow one arrangement from start to finish on one page (Priority: P1)

**Goal**: One page with a stage, a timeline, the details, one filled action per stage and role, and
the messages; plus asking again, marking as done, and the helper's read-only view.

**Independent Test**: Make an arrangement, fill in the details, accept it as the lister, and mark the
loan returned, checking after each step that the same address shows the new stage and a new timeline
line; do the same with a gift and "Mark as done" / "Not done yet"; decline one and ask again.

### Tests for User Story 2

- [ ] T030 [P] [US2] Add to `apps/api/src/modules/arrangement-stage.test.ts`: `timelineOf(notes, row, reports, now)` returns, oldest first, `asked`, only the latest `details_changed` since the most recent ask, `agreed`, `lent` and `due_back` from the loan dates, `returned`, `done` with who marked it (and no `done` after a later `not_done`), `help_asked` / `help_outcome`, `declined` / `withdrawn` / `closed`; after a reopen the earlier `asked` and how it ended stay; expected steps follow with `at: null` (`agreed` while arranging, `returned` for a loan out, `done` for an agreed gift not marked); no step ever carries note text
- [ ] T031 [P] [US2] Add to `apps/api/src/routes/arrangements.test.ts`: **ask again**: after decline (and after withdraw, and after a quiet-month close) `POST /offerings/{id}/arrangements` by the same requester returns `200` with the same `id`, `status: open`, `version + 1`, `decisionNote` and `closedReason` null, the conversation writable again with its earlier messages, an `asked` note, and the lister notified; a second ask while open is `409 already_open`; after an agreement a new ask makes a new `id` (`201`); the database refuses a second non-agreed row for the same requester and offering. **Done**: `POST /arrangements/{id}/done` by either member on an agreed gift sets `agreed.doneAt` and `doneBy`, `stage: done`, writes a `done` note and sends no notification (assert nothing queued); `not-done` clears it (`stage: agreed`) with a `not_done` note; `409 is_a_loan` on a loan, `409 not_agreed` while open, `409 already_done`, `409 not_done`; amounts left and the request are unchanged by either. **Returned**: writes a `returned` note. **Fixed**: `PATCH` on an agreed arrangement is `409 arrangement_ended`. **Helper**: a helper gets `myRole: helper` only once agreed, `canAccept: false`, `conversationId: null` until messages are shared and read-only after, the timeline without note text, and `404` from every action endpoint; an unrelated member gets `404`
- [ ] T032 [P] [US2] Create `apps/web/tests/e2e/arrangements-us2-page.spec.ts`: (a) Sam asks to borrow, the page shows "Being arranged", a timeline "Asked · <date>" then "Agreed · not yet", "Still to settle", **Change details** as the only filled button; Sam fills in the details; Fay sees **Accept** as the only filled button, accepts: same URL, page not scrolled, "Agreed for …", timeline gains "Agreed", details headed "What was agreed" with no "Change details", messages still there; Fay's only filled button is **Mark returned**; marking returned shows "Returned on …" and the card moves to Finished, and it is not under Sam's "Needs you" just because of the "returned" note. (b) a gift: after accepting, both see **Mark as done**; Sam presses it: stays put, "Done on …", "Marked as done. You can take this back." under the button, Finished for both and not under Fay's "Needs you" (the header count doesn't change); "Not done yet" puts it back. (c) Fay declines with a note: Sam sees "Declined", the note, read-only messages, and **Ask again**; asking again lands on the same URL with the earlier messages and a timeline "Asked, Declined, Asked". (d) the timeline is an ordered list whose items read as text with dates. axe scans at each stage for both roles
- [ ] T033 [P] [US2] Add to `apps/web/tests/e2e/us6-problem.spec.ts`: the helper opens the arrangement from the request for help and sees "You're seeing this to help.", the stage, timeline and what was agreed, no buttons and no messages panel; after the messages are shared the panel appears read-only; the arrangement is not in the helper's Arrangements list or header count; axe scan of the helper view
- [ ] T034 [P] [US2] Add to `apps/web/tests/e2e/stay-put.spec.ts`: accepting, "Mark as done", "Not done yet" and "Mark returned" each keep the page where it was (measure right before the click) and show their result in the viewport

### Implementation for User Story 2

- [ ] T035 [US2] Add `timelineOf` to `apps/api/src/modules/arrangement-stage.ts` per [research.md](research.md) §3 and the step list in [contracts/api.md](contracts/api.md); in `apps/api/src/modules/arrangements.ts` write an `asked` note in `createArrangement`, load the conversation's event notes (kind, time, author only) in `getArrangement`, and return `timeline`; add `TimelineStep` to the shared schema and make `timeline` required
- [ ] T036 [US2] Ask again in `apps/api/src/modules/arrangements.ts` per [research.md](research.md) §4: when the requester's arrangement on this offering has `status` `declined`, `withdrawn` or `closed`, reopen it in one transaction (status `open`, new details and offers replaced as a whole, `version + 1`, `decisionNote` and `closedReason` null, `lastActivityAt` now), write `asked`, notify the lister with "… asked again …" per [contracts/notifications.md](contracts/notifications.md), and answer `200`; return `canAskAgain` from `getArrangement` (requester, ended without agreement, offering `available`)
- [ ] T037 [US2] Mark as done in `apps/api/src/modules/arrangements.ts` and `routes/arrangements.ts` per [research.md](research.md) §5: `markDone` and `markNotDone` (either member; agreed; not a loan), each writing its note with `postEvent`, moving `lastActivityAt`, and sending no notification; add the two routes, and empty and remove the `notBuiltYet` list in `apps/api/src/openapi.test.ts` (T002)
- [ ] T038 [P] [US2] Create `apps/web/src/lib/components/Timeline.svelte` (purpose comment): an `<ol aria-label="What has happened">`; each `<li>` is a line of text, the step in words then " · " and its date (`when`/`shortDay` from `lib/format.ts`), or " · not yet" in muted text for expected steps; a filled or hollow dot before each as decoration (`aria-hidden`); `done` and `returned` say who where the contract does ("Done · 15 Nov · marked by Sam")
- [ ] T039 [US2] Rebuild `apps/web/src/routes/arrangements/[id]/+page.svelte` and `+page.server.ts` per "The arrangement page" in [contracts/pages.md](contracts/pages.md): header with `sideWords`; left column in order: stage (`Badge` + `stageWords`, and why), `Timeline`, `ArrangementDetails`, "Still to settle", actions in `#decision`, help from the invite chain; right column `ArrangementMessages`. Actions `accept`, `decline`, `withdraw`, `returned`, `done`, `notDone`, all with `stayPut` and `#decision` anchors, results beside the button, confirmations with `use:reveal`. Exactly one filled button per stage and role, from the table in the contract; when none is filled, pass `sendVariant="default"` to the messages, otherwise `"outline"`
- [ ] T040 [US2] "Ask again": on an ended arrangement show the filled link to `/offerings/[id]/propose`; in `apps/web/src/routes/offerings/[id]/propose/+page.svelte` and `+page.server.ts`, when the offering's `myArrangement` has ended, set the heading to "Ask again" with the note "This continues your earlier arrangement, with its messages." and prefill the form from it
- [ ] T041 [US2] Helper view in `apps/web/src/routes/arrangements/[id]/+page.svelte`: when `myRole === 'helper'` show the note "You're seeing this to help. Only <A> and <B> can change it.", no actions, and the messages panel only when `conversationId` is set (read-only); `apps/web/src/routes/reports/[id]/+page.svelte` links to the arrangement
- [ ] T042 [US2] Confirm T030–T034 pass, and that `apps/web/tests/e2e/proposals-us*.spec.ts` still pass against the rebuilt page (update selectors only where the page's structure changed, never the behaviour asserted)

**Checkpoint**: Stories 1 and 2 together are the whole feature for the two members.

---

## Phase 5: User Story 3 - Everything in wunan leads to the arrangement (Priority: P2)

**Goal**: Every link, in the app and in notifications, opens the arrangement; the old addresses are
gone.

**Independent Test**: Follow the link in each kind of notification and from each page that points
to an exchange; each lands on the arrangement. Old addresses show "couldn't find that page".

### Tests for User Story 3

- [ ] T043 [P] [US3] Add to `apps/api/src/routes/arrangements.test.ts` (or `me-settings.test.ts` where notices are already asserted): every notification sent for asking, asking again, a message, a detail change, accept, decline, withdraw, the three closes, and the return reminder has `url` `/arrangements/{id}` and the titles in [contracts/notifications.md](contracts/notifications.md); marking done and not done send none
- [ ] T044 [P] [US3] Create `apps/web/tests/e2e/arrangements-us3-links.spec.ts`: the link in the "accepted" email (read from Mailpit as other specs do) opens the arrangement; an offering shows "See your arrangement" while the member's is open and "Ask again" when it ended; the owner's "Arrangements (N)" opens `/arrangements?side=offered`; a request closed by an agreement links to the arrangement and says "arrangement"; `/proposals`, `/agreements`, `/proposals/<id>` and `/agreements/<id>` show "We couldn't find that page" with a way back; no link on the list, page, offering, request or report pages has an `href` starting with `/proposals` or `/agreements`

### Implementation for User Story 3

- [ ] T045 [US3] Notification words in `apps/api/src/modules/arrangements.ts` (and `reminders.ts`) per [contracts/notifications.md](contracts/notifications.md): "… changed what they asked for …", "… declined what you asked for …", "Your arrangement for … was closed after a quiet month", "… accepted: you've agreed on …"; every `url` is `/arrangements/{id}`; system notes in the conversation say "arrangement" where they named the page ("It's now agreed." instead of "It's now an agreement." is fine; keep them plain and blame-free)
- [ ] T046 [P] [US3] Link words in `apps/web/src/routes/offerings/[id]/+page.svelte` ("See your arrangement" / "Ask again" from `myArrangement.status`; owner's "Arrangements (N)"), `apps/web/src/routes/requests/[id]/+page.svelte` ("See the arrangement"; other open arrangements), `apps/web/src/routes/reports/[id]/+page.svelte`, `apps/web/src/routes/members/[id]/+page.svelte`, and `apps/web/src/routes/+error.svelte`, wherever they name or link to either old page
- [ ] T047 [US3] Search `apps/web/src` and `apps/api/src` for `/proposals` and `/agreements` in links, redirects and notification urls and remove every one left; confirm T043–T044 pass

**Checkpoint**: nothing in wunan leads to a page that no longer exists.

---

## Phase 6: User Story 4 - Words and help match the one idea (Priority: P3)

**Goal**: Help, titles, notices and settings talk about arrangements as one thing with stages.

**Independent Test**: Read the help pages, navigation, page titles, notices and notification
settings; none names a "Proposals" or "Agreements" page.

### Tests for User Story 4

- [ ] T048 [P] [US4] Add to `apps/web/tests/e2e/accessibility.spec.ts` (which already walks the help topics): `/help/arrangements` exists and is scanned; `/help/proposals` and `/help/agreements` show "couldn't find that page"; the help index, the header, and `/settings/notifications` contain no text "Proposals" or "Agreements" as a page name

### Implementation for User Story 4

- [ ] T049 [US4] Create `apps/web/src/lib/help/Arrangements.svelte` replacing `Proposals.svelte` and `Agreements.svelte` (delete both; update `lib/help/index.ts` with slug `arrangements`, title "Arranging and agreeing"): what an arrangement is; its stages in the exact words of "Stage words"; that details are fixed once agreed; marking a loan returned; "Mark as done" (optional, either of you, can be taken back, nobody is reminded); asking again continues the same arrangement; sharing a phone number, email or call time with "+". Plain short sentences
- [ ] T050 [P] [US4] Reword mentions of the old pages in `apps/web/src/lib/help/AskingForHelp.svelte`, `Requests.svelte`, `Offering.svelte`, `Notifications.svelte`, `YourData.svelte`, the `HelpLink` topics used on the arrangement pages, page `<title>`s, and any description under the switches in `apps/web/src/routes/settings/notifications/+page.svelte` (labels stay)
- [ ] T051 [US4] Confirm T048 passes and read every changed sentence against constitution II and V (plain, no blame, no urgency)

**Checkpoint**: all four stories work on their own and together.

---

## Phase 7: Polish and cross-cutting

- [ ] T052 [P] Update `apps/api/scripts/seed-demo.ts` so the demo has arrangements at every stage for the two named members (being arranged with and without issues, agreed, on loan, due back passed, returned, done, declined with a note, closed) and at least one member with more than 20 finished
- [ ] T053 [P] Export: assert in `apps/api/src/routes/me-settings.test.ts` that `my-wunan-data.json` has an `arrangements` section with details, the agreed record, `returnedAt`, `doneAt` and messages, and no `proposals` or `agreements` sections; update `specs/001-community-resource-sharing/contracts/export-format.md` where it lists them (FR-025)
- [ ] T054 [P] Add a "004 Arrangements" section to `docs/security-review.md` covering the checkpoints in the plan's constitution table: helper access to `GET /arrangements/{id}` and to the shared conversation; reopening (same requester only, ended only); `done` / `not-done` authorization; the timeline carrying no note text; export
- [ ] T055 [P] Update [README.md](../../README.md) and [AGENTS.md](../../AGENTS.md) where they name proposals and agreements as pages or modules ("Propose and agree" paragraph; layout notes), and `specs/002-listing-proposals/contracts/pages.md` / `specs/003-member-requests/contracts/pages.md` with one line each pointing to the 004 pages contract for the replaced routes
- [ ] T056 Performance check (SC-007): with the demo seed, time `GET /arrangements` for a member with 200 arrangements; it must answer in well under 2 s; add an index only if the query plan shows a scan
- [ ] T057 Run the whole suite (`npm run check`, `npm test`, `npm run test:e2e`) and fix anything left; confirm no file under `apps/` or `packages/` still has `proposal` or `agreement` in a file name, route, endpoint, table or exported identifier except as allowed in the conventions
- [ ] T058 Walk through [quickstart.md](quickstart.md) by hand, including the hand checks (keyboard and screen reader, stay put, one filled button, 320 px and 200% zoom, dark theme)

---

## Dependencies and order

- **Setup (Phase 1)** → **Foundation (Phase 2)** blocks everything. Inside Phase 2: T003–T004 →
  T005–T007 → T008 → T009 → T010 → T011–T014 (parallel) → T015–T016 → T017 → T018–T019 → T020.
- **US1 (Phase 3)** needs only the foundation.
- **US2 (Phase 4)** needs the foundation, and T024 (stage) from US1. Its list assertions ("moves to
  Finished") need US1's list.
- **US3 (Phase 5)** needs US2's page (ask again, link words on it).
- **US4 (Phase 6)** needs the stage words (T026) and the page (US2) so the help can match them.
- **Polish (Phase 7)** after the stories; T052–T055 are independent of each other.

Within each story: tests first (they must fail), then API, then web, then the "confirm" task.

## Parallel examples

```text
# Phase 2, once T010 is in:
T011 reports   |  T012 messaging  |  T013 offerings/requests  |  T014 reminders/members/export/me

# US1 tests together:
T021 stage unit tests  |  T022 list route tests  |  T023 list browser spec

# US2 tests together:
T030  |  T031  |  T032  |  T033  |  T034

# Polish:
T052 seed  |  T053 export  |  T054 security review  |  T055 docs
```

## Implementation strategy

- **MVP**: Phases 1–3. After the foundation the app already has one address per exchange with
  today's behaviour; US1 adds the one list. That alone removes "which of two lists do I look in".
- **Then** US2 (the page, asking again, done), which is the other half of the feature's value, then
  US3 and US4, which are small.
- Stop at any checkpoint to check by hand; each phase leaves all three test commands passing.
