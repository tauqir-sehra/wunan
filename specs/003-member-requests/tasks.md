---

description: "Task list for Requests for Things (feature 003)"
---

# Tasks: Requests for Things

**Input**: Design documents from `/specs/003-member-requests/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included, as in 001 and 002: Vitest module and route tests against the test database, and
one Playwright spec per user story with axe scans in light and dark themes. Within each story, write
the tests first and confirm they fail.

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: User story from spec.md (US1–US7)
- Paths follow plan.md: `apps/api/`, `apps/web/`, `packages/shared/`

## Conventions for every task

- All 001 and 002 conventions hold (top of [002 tasks.md](../002-listing-proposals/tasks.md)): read
  the constitution first; thin routes calling one module; `ApiError` with plain-language messages
  (and `details` offering each problem); pages call the API only via `apps/web/src/lib/api.ts`; one
  filled primary button per screen; no animations; no new dependencies.
- **JavaScript (research §11)**: the request form needs JavaScript like the offering and proposal
  forms, submits as a normal form post, and shows "This form needs JavaScript turned on." when it's
  off. Every other new page and action works without JavaScript.
- **Database (research §10)**: nothing is kept. After schema changes, delete `apps/api/drizzle/`,
  run `npm run db:generate -w apps/api` to produce one `0000_initial.sql`, re-apply its hand edits
  (the `btree_gist` extension at the top and the `agreement_loans_dont_overlap` exclusion
  constraint, exactly as in the current file), then `npm run db:reset -w apps/api` and
  `npm run db:reset -w apps/api -- --test`. No conversion SQL.
- **Places**: request areas go out only through `viewPlace()` (full for the asker only).
- **Kinds**: request kind ↔ offering type is one constant, `requestKindFor` / `offeringTypeFor`
  (`borrow`↔`lend`, `receive`↔`gift`, `trade`↔`trade`, `service`↔`service`) in
  `packages/shared/src/schemas/requests.ts`; never spell the mapping out elsewhere.
- Changes to authorization, data storage, or input handling get a **Security review** line before
  the phase checkpoint; record findings in `docs/security-review.md` (new "003" section).

---

## Phase 1: Setup

**Purpose**: Shared types and tooling every later phase uses

- [X] T001 [P] Create `packages/shared/src/schemas/requests.ts`: `RequestKind` enum (`borrow`, `receive`, `trade`, `service`), `RequestStatus` (`open`, `closed`), `RequestClosedReason` (`by_asker`, `agreed`, `account_deleted`), the kind ↔ type map (`requestKindFor`, `offeringTypeFor`), create/update bodies as a discriminated union on `kind` (title "required, 1–100 characters"; description "optional, ≤ 2,000 characters"; `neededAfter`/`neededBy` YYYY-MM-DD with "`needed_by >= needed_after` when both set"; `area` Place; `handovers`; Borrow `loanLength`+`loanLengthUnit` "both or neither; > 0"; Receive/Trade `amount`+`unit` "both or neither; > 0"; Trade `giveBack` ≤10 `{ description 1–100 characters, amount?, unit? }`; Service `sessionLength`+`sessionLengthUnit` "both or neither; > 0", `sessions` "≥ 1", `availability` ≤14 `{ weekday 0–6, startTime < endTime }`), `Request`, `RequestSummary`, `RequestLink` read shapes per [contracts/api.md](contracts/api.md); export from `packages/shared/src/index.ts`
- [X] T002 [P] Create `packages/shared/src/schemas/public-messages.ts`: `PostPublicMessage` (`body` plain text, "1–240 characters" after trimming, with the message "Please keep it to 240 characters; this is N."), `PublicMessage` (`id, author, body, removed, createdAt, mine, flags?`) and `PublicThread` (`items, hasEarlier, canPost`); export from `packages/shared/src/index.ts`
- [X] T003 [P] Add `request` and `public_message` to `notificationTypes` in `packages/shared/src/schemas/settings.ts` and to the plain names used by the settings page (`"Someone offers something for your request"`, `"Public messages on your requests and offerings"`) in `apps/web/src/lib/format.ts`
- [X] T004 [P] Add `neededText(neededAfter, neededBy)` to `apps/web/src/lib/format.ts` per FR-002a ("No fixed date", "Needed by 8 Nov", "Any time after 8 Nov", "Needed between 8 and 9 Nov", "Needed on Sat 8 Nov") and request kind labels (`Borrow`, `Receive`, `Trade`, `Service`) with one-line explanations; unit tests in `apps/web/src/lib/format.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The new schema and the shared hooks every story needs, with the app building and all
existing tests passing

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create `apps/api/src/db/schema/requests.ts` per [data-model.md](data-model.md): enums `request_kind`, `request_status`, `request_closed_reason`; table `request` (all columns, generated `area_neighbourhood`/`area_city` as on `offering`, `search_vector` tsvector; checks for title "1–100 characters", description "≤ 2,000 characters", `needed_by >= needed_after`, positive numbers, units with numbers, fields match kind, "`closed_reason` set exactly when `status = 'closed'`", `closed_by_agreement_id` only with `agreed`; indexes `(status, created_at)`, `kind`, `asker_id`, GIN on `search_vector`); `request_give_back` (`position` "0–9", description "1–100 characters", amount+unit both or neither); `request_availability` (same shape as `service_availability`: weekday 0–6, `start_time < end_time`); `request_link` (unique `(request_id, offering_id)`, `linked_by_id` → member set null); export from `apps/api/src/db/schema/index.ts`
- [X] T006 [P] Create `apps/api/src/db/schema/public-messages.ts`: `public_message` with `request_id` and `offering_id` (cascade; check exactly one set), `author_id` (cascade), `body` text "1–240 characters while shown; emptied on removal" (check: `removed_at is not null or char_length(body) between 1 and 240`), `removed_at`, `created_at`; indexes `(request_id, created_at)`, `(offering_id, created_at)`, `author_id`; export from the schema index
- [X] T007 Replace `offering_flag` with `flag` in `apps/api/src/db/schema/offerings.ts` (nullable `offering_id`, `request_id`, `public_message_id`, cascade; check exactly one set; `request` text 1–500 characters; `seen_at` instead of `seen_by_owner_at`), and update every use in `apps/api/src/modules/offerings.ts`, `apps/api/src/modules/export.ts`, `apps/api/src/modules/members.ts`, and the my-offerings count, keeping current behaviour for offering flags; fix `apps/api/src/routes/offerings.test.ts`
- [X] T008 [P] Add `request_id` (→ request, set null) to `proposal` in `apps/api/src/db/schema/proposals.ts`, and `subject_id` (nullable uuid) to `notification_log` plus the two new enum values in `apps/api/src/db/schema/notifications.ts`
- [X] T009 Regenerate the database per the Conventions (delete `apps/api/drizzle/`, `db:generate`, re-apply the `btree_gist` line and the loan exclusion constraint by hand, `db:reset` and `db:reset -- --test`); run `npm run check` and `npm test` and fix fallout
- [X] T010 Generalise `apps/api/src/modules/live.ts` from a conversation id to a channel key (`channelFor(key)`; existing callers pass `conversation_<id>`, new ones `public_<request or offering id>`), with no behaviour change for proposal threads; extend `apps/api/src/modules/live.test.ts` with a public channel
- [X] T011 [P] Create the module skeleton `apps/api/src/modules/requests.ts` (purpose comment; `loadRequest(id)` → 404 `That request` when missing or closed with `account_deleted`; `viewRequest(row, viewerId)` using `viewPlace` full only for the asker; `setSearchVector()` from title (A), description and give-back descriptions (B)) and `apps/api/src/routes/requests.ts` mounted at `/api/v1/requests` with OpenAPI docs in `apps/api/src/app.ts`
- [X] T012 [P] Point `apps/api/src/openapi.test.ts` at both `specs/002-listing-proposals/contracts/api.md` and `specs/003-member-requests/contracts/api.md` (it should fail until the endpoints exist)

**Checkpoint**: Schema rebuilt; flags generalised; live streams keyed by channel; everything still passes

---

## Phase 3: User Story 1 - Request something (Priority: P1) 🎯 MVP

**Goal**: A member posts, edits, closes, and reopens a request of any kind with only a title required.

**Independent Test**: Post one request of each kind with and without optional details, view each as
another member, edit one, and close and reopen one as the asker.

### Tests for User Story 1

- [X] T013 [P] [US1] API tests in `apps/api/src/routes/requests.test.ts`: create each kind with title only and with all details; title missing/101 characters → 400 with `fields.title`; `neededBy` before `neededAfter` → 400 naming both; Borrow with `amount` → 400 (fields match kind); `giveBack` 11 items → 400; `GET /requests/{id}` as another member shows area as `{ display }` only; `PATCH` by non-asker → 403/404, after close → 409; close, reopen, close again; editing, closing by the asker, and reopening each send a `request` notice (with what changed, for edits) to members who linked an offering, and nothing to the asker; `datePassed` true when `neededBy` is yesterday (community time zone)
- [X] T014 [P] [US1] Playwright spec `apps/web/tests/e2e/requests-us1-ask.spec.ts`: header shows "Request something" and "Offer something" (both outlined); post a Borrow request with only a title; post a Trade request with two give-back items and one with none ("open to talking about what to give back"); edit dates and see "Needed on …"; close with confirmation and reopen; axe in light and dark

### Implementation for User Story 1

- [X] T015 [US1] Implement `createRequest`, `updateRequest` (whole replacement of give-back items and availability in one transaction; sets `updated_at` and the search vector), `closeRequest` (`by_asker`; open only), `reopenRequest` (from `by_asker` or `agreed`; clears `closed_reason` and `closed_by_agreement_id`; links stay), each of the three notifying members who linked an offering (`request` type, per [contracts/notifications.md](contracts/notifications.md); edits list what changed; at most one per request per member per hour via `notification_log.subject_id`), and `getRequest` (with `datePassed`, `canEdit`, `canAnswer`) in `apps/api/src/modules/requests.ts`
- [X] T016 [US1] Add `POST /requests`, `GET /requests/{id}`, `PATCH /requests/{id}`, `POST /requests/{id}/close`, `POST /requests/{id}/reopen` to `apps/api/src/routes/requests.ts` per [contracts/api.md](contracts/api.md)
- [X] T017 [P] [US1] Create `apps/web/src/lib/request-form.ts` (form fields ↔ API body, like `lib/offering-form.ts`; indexed `giveBack[0].description` rows and availability rows) with unit tests in `apps/web/src/lib/request-form.test.ts`
- [X] T018 [US1] Create `apps/web/src/lib/components/RequestFields.svelte`: Step 1 kind (radio with one line each) and title; Step 2 all optional: description, **Needed after**, **Needed by** (hint "Leave both empty if there's no fixed date"), area (PlaceField), handover options for the kind (reuse the offering handover words), and per kind: how long (Borrow), how much (Receive/Trade), "What you could give back" with RepeatingRows ≤10 and the empty-means-open note (Trade), how long each time / how many times / times that suit you (Service); field errors via FieldProblems; no-JS note
- [X] T019 [US1] Create routes `apps/web/src/routes/requests/new/` (+page.svelte, +page.server.ts: "Post request" → `/requests/[id]`) and `apps/web/src/routes/requests/[id]/edit/` ("Save changes")
- [X] T020 [US1] Create `apps/web/src/routes/requests/[id]/` (+page.svelte, +page.server.ts with `close` and `reopen` actions): title, kind, "Asked by <name>", description in the quoted box, details table using `neededText`, "The date has passed" InfoNote for the asker, state line ("Closed by you" / "Closed: settled by an agreement"); asker primary **Edit request**, secondary "Close request" with confirmation, "Reopen" when closed; HelpLink to `requests`
- [X] T021 [US1] Update `apps/web/src/routes/+layout.svelte`: header buttons **Request something** (→ `/requests/new`) and **Offer something** (→ `/offerings/new`, replacing "Share a new offering"), both outlined, "Request" / "Offer" below `sm`; main links gain **Requests** after Find; update the header comment and any tests that look for "Share a new offering" (`apps/web/tests/e2e/*.spec.ts`)
- [X] T022 [P] [US1] Help topic `apps/web/src/lib/help/Requests.svelte` ("Asking for things": what a request is, the dates, how others answer it, how it closes) registered in `apps/web/src/lib/help/index.ts`

**Checkpoint**: Requests can be posted, seen by others, edited, closed, and reopened

---

## Phase 4: User Story 2 - See what's already available while asking (Priority: P1)

**Goal**: While typing a request title, up to 5 existing offerings that might answer it are shown.

**Independent Test**: With a few offerings in place, start a request whose title matches one; the
suggestion appears, opens the offering, and the unfinished request is still there on return.

### Tests for User Story 2

- [X] T023 [P] [US2] API tests in `apps/api/src/routes/requests.test.ts` (suggestions block): matching Lend offering suggested for Borrow; Gift offering not suggested for Borrow; own, paused, closed, and lent-out offerings excluded; `q` under 3 characters → `{ items: [] }`; at most 5; area match ordered first; suggestions over 20,000 offerings return in under 2 s (SC-004), checked by `npm run seed:demo` like 001 SC-006
- [X] T024 [P] [US2] Playwright spec `apps/web/tests/e2e/requests-us2-suggestions.spec.ts`: typing "drill" shows the box with the offering; the count is in a polite live region; open it, go back, the form keeps title and details; "zzzz" shows no box; axe

### Implementation for User Story 2

- [X] T025 [US2] Implement `suggestOfferings({ kind, q, area }, viewerId)` in `apps/api/src/modules/requests.ts` using `searchOfferings()` from `apps/api/src/modules/search.ts` (type from `offeringTypeFor`, available only, not lent out, excluding the viewer's own; limit 5; area-matching rows first by `area_neighbourhood`/`area_city`), and `GET /requests/suggestions` in `apps/api/src/routes/requests.ts` (declared before `/{id}`)
- [X] T026 [US2] Create `apps/web/src/lib/components/RequestSuggestions.svelte` ("These might already have what you need": up to 5 links with title, type, area; asks `/requests/suggestions` through a same-origin `+server.ts` at `apps/web/src/routes/requests/suggestions/+server.ts` after a 400 ms pause once the title has 3+ characters; polite announcement "N offerings might already have what you need"; nothing shown when empty) and use it under the title in `RequestFields.svelte`
- [X] T027 [US2] Keep the unfinished request in `sessionStorage` (key `wunan:request-draft`, wrapped in try/catch, restored on load of `/requests/new`, cleared after a successful post) in `apps/web/src/lib/components/RequestFields.svelte`

**Checkpoint**: Asking points members at what already exists

---

## Phase 5: User Story 3 - Answer a request with an offering (Priority: P1)

**Goal**: A helper answers a request with a new prefilled offering or one of their own offerings; the
offering is an ordinary offering that says which request it was made for.

**Independent Test**: As another member, answer one request of each kind; the offering form is
prefilled, the offering is created as a normal offering and linked, and the asker is told.

### Tests for User Story 3

- [X] T028 [P] [US3] API tests in `apps/api/src/routes/requests.test.ts` (links block): `POST /offerings` with `forRequest` links it and returns `linked: true`; with a request closed meanwhile → offering created, `linked: false, linkProblem: "request_closed"`; `POST /requests/{id}/links` with own available offering of the matching type → 201; wrong type → 400 `wrong_type`; paused offering → 409 `not_available`; someone else's offering (not asker) → 403; duplicate → 409 `already_linked`; asker answering own request with "I can help" → 403; asker linking an offering they found → 201; `DELETE` by linker and by offering owner → 204, by others → 403/404; `GET /offerings/{id}` shows `answers`; `GET /offerings` items carry `answersRequest`; the asker gets a `request` notice only when turned on
- [X] T029 [P] [US3] Playwright spec `apps/web/tests/e2e/requests-us3-answer.spec.ts`: "I can help with this" opens the Lend form prefilled (title, area, handovers, loan length as the maximum) with the type fixed; post → offering page says "Fulfills <asker>'s request"; request shows it under "Offered for this request"; "Link one of your offerings" pop-up and its no-JS page; remove a link; as the asker, link an offering found on its own page with "Link to my request"; axe

### Implementation for User Story 3

- [X] T030 [US3] Implement `linkOffering(requestId, offeringId, memberId)` and `unlinkOffering(requestId, linkId, memberId)` in `apps/api/src/modules/requests.ts` per research §2 (owner or asker may link; type must answer the kind; offering available; request open; helper can't link to their own request; remover is the linker or the offering owner), with `request` notices to the asker via `apps/api/src/notify/index.ts` (at most one per request per member per hour, keyed by `subject_id`)
- [X] T031 [US3] Add `POST /requests/{id}/links` and `DELETE /requests/{id}/links/{linkId}` to `apps/api/src/routes/requests.ts`; include `links` (with `available`, `canRemove`) in `getRequest`
- [X] T032 [US3] In `apps/api/src/modules/offerings.ts` and `apps/api/src/routes/offerings.ts`: accept optional `forRequest` on create and link after the offering is saved (never failing the offering; return `{ id, linked, linkProblem? }`); add `answers` and `myOpenRequestsLinked` to the single-offering view and `answersRequest: { asker } | null` to offering summaries in `describe()`; update `packages/shared/src/schemas/offerings.ts`
- [X] T033 [P] [US3] Add `offeringPrefillFromRequest(request)` to `apps/web/src/lib/request-form.ts` per spec FR-012 (title, description, area, handovers; Borrow loan length → maximum loan; Receive/Trade amount; Trade give-back → accepted things; Service session length, times, number of times) with unit tests
- [X] T034 [US3] Update `apps/web/src/routes/offerings/new/+page.server.ts` and `+page.svelte` for `?forRequest=<id>`: load the request, fix the type, prefill via `offeringPrefillFromRequest`, show "You're answering <asker>'s request: <title>", send `forRequest`; on `linked: false` show the calm note on the offering page ("The request was closed, so this offering wasn't linked to it. Your offering is up as usual.")
- [X] T035 [US3] On `apps/web/src/routes/requests/[id]/+page.svelte`: "Offered for this request" cards (helper, state, "No longer available"); for others primary **I can help with this** → `/offerings/new?forRequest=<id>` and a PopupDialog "Link one of your offerings" with fallback page `apps/web/src/routes/requests/[id]/link/` (radio list of matching available offerings, "Link this offering"; none → link to make one); `unlink` action; hide both on closed requests and for the asker; for the asker, each linked card's "Ask to borrow" / "Ask for this" / … is an outlined button (or link) to the offering page, so **Edit request** stays the only filled button (constitution II)
- [X] T035a [US3] "Link to my request" for the asker on `apps/web/src/routes/offerings/[id]/+page.svelte` (+page.server.ts `linkToRequest` action): an outlined button shown when the viewer has open requests of the kind this offering's type answers and the offering isn't theirs; one request → links straight away with a confirmation note; several → a short radio list "Which request does this fulfil?"; uses `POST /requests/{id}/links` (spec FR-017a)
- [X] T036 [P] [US3] "Fulfills <asker>'s request: <title>" line with a link on `apps/web/src/routes/offerings/[id]/+page.svelte` and in `apps/web/src/lib/components/OfferingCard.svelte`
- [X] T037 [US3] **Security review**: link authorization (own offering or asker only, type and availability checks), `forRequest` on offering create, request place privacy; record in `docs/security-review.md`

**Checkpoint**: Requests can be answered; linked offerings behave exactly like other offerings

---

## Phase 6: User Story 4 - From request to agreement (Priority: P1)

**Goal**: The asker proposes on a linked offering from its page, prefilled from the request; when it's
accepted, the request closes automatically and linked offerings are untouched.

**Independent Test**: Answer a request, propose on the linked offering as the asker, accept it; the
request closes, the offering follows its normal lifetime, other linkers are told.

### Tests for User Story 4

- [X] T038 [P] [US4] API tests in `apps/api/src/modules/request-closing.test.ts`: asker's proposal on a linked offering is tied (`request` on `GET /proposals/{id}`); accepting it closes the request (`agreed`, `closedByAgreementId`) in the same transaction; offering unchanged except by the agreement; other linkers notified; another member's accepted proposal on the linked offering leaves it open; the asker's accepted proposal on an unlinked offering leaves it open; offering linked to two of the asker's open requests without `requestId` → 409 `choose_request` with both; wrong `requestId` → 400; request closed by hand before acceptance → acceptance works, request stays closed `by_asker`; reopen after `agreed` works
- [X] T039 [P] [US4] Playwright spec `apps/web/tests/e2e/requests-us4-agree.spec.ts`: from the request, open the linked offering, "Ask to borrow" shows the proposal prefilled with the "Needed after" date and loan length and the line "When it's accepted, your request closes."; lister accepts; the request shows "Closed: settled by an agreement"; the offering is still up; the "Which request is this for?" step when linked to two; axe

### Implementation for User Story 4

- [X] T040 [US4] In `apps/api/src/modules/proposals.ts` `createProposal`: find the caller's open requests linked to the offering; none → no tie; one → tie; several → require `requestId` (409 `choose_request` with `{ requests: [{ id, title }] }`); validate a given `requestId` (400 otherwise); store `proposal.request_id`; add `requestId` to `packages/shared/src/schemas/proposals.ts` and `request` to the proposal read shape and `getProposal`
- [X] T041 [US4] In `apps/api/src/modules/proposals.ts` `acceptProposal`: inside the existing transaction, if `request_id` is set and the request is open, call `closeForAgreement(tx, requestId, agreementId)` from `apps/api/src/modules/requests.ts` (sets `closed`, `agreed`, `closed_by_agreement_id`); after commit, notify other linkers (`request` type)
- [X] T042 [US4] Add `proposalPrefillFromRequest(request, offering)` to `apps/web/src/lib/request-form.ts` per research §3 (`neededAfter` → date; first request handover the offering offers; area → place only for handovers that take one; loan length; amount; give-back matched to accepted things by exact description → `offers`, the rest → `ownOffer`; session length and sessions) with unit tests
- [X] T043 [US4] Update `apps/web/src/routes/offerings/[id]/+page.svelte` and `apps/web/src/routes/offerings/[id]/propose/` for `?request=<id>`: the proposal button carries the request from `myOpenRequestsLinked` (with a "Which request is this for?" choice first when there are several), the form is prefilled via `proposalPrefillFromRequest`, shows "This is for your request: <title>. When it's accepted, your request closes.", and sends `requestId`
- [X] T044 [P] [US4] Show the closing agreement on `apps/web/src/routes/requests/[id]/+page.svelte` (link "See the agreement" for the asker) and the request on `apps/web/src/lib/components/ProposalDetails.svelte` ("For <asker>'s request: <title>")
- [X] T044a [US4] On a request closed by an agreement, show the asker a quiet note offering their other open proposals on its linked offerings ("You still have these proposals open:") with links to each, where they can withdraw (spec Edge Cases "Asker has open proposals when the request closes"); `getRequest` returns `myOtherOpenProposals: [{ id, offeringTitle }]` for the asker in `apps/api/src/modules/requests.ts`; test in `apps/api/src/modules/request-closing.test.ts`
- [X] T045 [US4] **Security review**: proposal tie (only the asker's own open, linked requests), closing inside the accept transaction; record in `docs/security-review.md`

**Checkpoint**: The full loop works: request → offering → proposal → agreement → request closed

---

## Phase 7: User Story 5 - Browse requests and help (Priority: P2)

**Goal**: Members browse open requests by words, kind, and area on their own Requests page, and see
their own under "My requests".

**Independent Test**: With requests of each kind and area, filter by words, kind, and area; only open
requests from others appear, newest first, with "Show more"; "My requests" lists one's own.

### Tests for User Story 5

- [X] T046 [P] [US5] API tests in `apps/api/src/routes/requests.test.ts` (list block): open requests by others only, newest first; `q`, `kind=borrow,service`, `area` filters; closed and `account_deleted` never listed; `mine=true` lists own open first then closed (not `account_deleted`); `linkCount`; cursor paging; 20,000 requests stay under 2 s, checked by `npm run seed:demo` (T067)
- [X] T047 [P] [US5] Playwright spec `apps/web/tests/e2e/requests-us5-browse.spec.ts`: Requests in the main nav; kind tick-boxes all ticked by default; area filter; "Showing:" chips and "Clear filters"; "Show more" appends in place; "My requests" tab; calm empty states; an offering never appears on Requests and a request never appears in Find (FR-020); axe

### Implementation for User Story 5

- [X] T048 [US5] Implement `listRequests(query, viewerId)` in `apps/api/src/modules/requests.ts` (full-text on `search_vector`, kinds, area parts, open only, not the viewer's own, newest first, cursor) and `mine=true`; add `GET /requests` to `apps/api/src/routes/requests.ts`
- [X] T049 [P] [US5] Create `apps/web/src/lib/components/RequestCard.svelte` (title, kind, area display, `neededText`, asker, "2 offers")
- [X] T050 [US5] Create `apps/web/src/routes/requests/` (+page.svelte, +page.server.ts) and `apps/web/src/routes/requests/more/+server.ts` mirroring Find (`apps/web/src/routes/offerings/+page.svelte`): heading "What people are asking for" with HelpLink, search form, tabs **All requests** / **My requests**, results section, "Show more" in place, primary **Request something**; empty states "Nobody's asking for anything that matches." / "You haven't asked for anything yet."

**Checkpoint**: Helpers can find requests

---

## Phase 8: User Story 6 - Ask and answer in public (Priority: P2)

**Goal**: Every request and offering has a public thread of short messages that all members can read
and post in, updating live; only authors can remove their own.

**Independent Test**: Post, read, and remove messages on a request and an offering as different
members; check the 240-character limit, live delivery, notices, and read-only when closed.

### Tests for User Story 6

- [X] T051 [P] [US6] API tests in `apps/api/src/routes/public-messages.test.ts`: post on a request and on an offering (any member); 241 characters → 400 with the count; whitespace only → 400; closed request / removed offering → 409 `thread_closed`, still readable; newest 20 returned oldest first, `before` cursor and `hasEarlier`; author removes → body emptied, `removed: true`; non-author `DELETE` → 403/404; shares the `message:` rate limit (61st in an hour → 429); `public_message` notices to asker/lister and earlier posters, not the author, at most one per thread per member per day; the live stream delivers the id on post and removal
- [X] T052 [P] [US6] Playwright spec `apps/web/tests/e2e/requests-us6-public.spec.ts`: counter counts down and is announced at 20 and 0; post on a request and an offering; a second browser context sees the message arrive without reloading; remove own message with confirmation → "Message removed"; others' messages offer only "Raise an issue"; closed request shows the read-only line; works with JavaScript off (form post, "Up to 240 characters"); axe

### Implementation for User Story 6

- [X] T053 [US6] Create `apps/api/src/modules/public-messages.ts`: `listThread(subject, viewerId, before?)`, `postMessage(subject, authorId, body)` (trim; 1–240; open check; `checkRateLimit('message:' + authorId, 60, 60)`; insert; `NOTIFY public_<id>` with the message id; notices per [contracts/notifications.md](contracts/notifications.md) using `notification_log.subject_id`), `removeMessage(id, authorId)` (author only; empty body, set `removed_at`; NOTIFY); `subject` is `{ requestId } | { offeringId }`
- [X] T054 [US6] Create `apps/api/src/routes/public-messages.ts`: `GET`/`POST /requests/{id}/messages`, `GET`/`POST /offerings/{id}/messages`, the two `…/messages/live` Server-Sent Events streams (using `subscribe('public_<id>')` from `modules/live.ts`, heartbeat as the conversation stream), `DELETE /public-messages/{id}`; mount in `apps/api/src/app.ts`
- [X] T055 [US6] Create `apps/web/src/lib/components/PublicThread.svelte`: heading **Public messages** with a refresh button; messages oldest first with author and time; "Show earlier messages" (`?before=` link without JavaScript); "Remove" on own (confirmation); "Raise an issue" on others' (PopupDialog; fallback page in US7); the box with label "Write a public message", hint "Everyone in wunan can read this. Please don't share phone numbers or addresses here.", live counter (polite, at 20 and 0 left; "Up to 240 characters" without JavaScript), outlined "Post"; read-only line when closed; live updates via EventSource appending or updating in place with a polite announcement "New message from <name>"
- [X] T056 [US6] Add `post` and `removeMessage` actions and the thread load to `apps/web/src/routes/requests/[id]/+page.server.ts` and `apps/web/src/routes/offerings/[id]/+page.server.ts`; render `PublicThread` below the details on both pages; add stream pass-throughs `apps/web/src/routes/requests/[id]/messages/live/+server.ts` and `apps/web/src/routes/offerings/[id]/messages/live/+server.ts` (like `routes/threads/[id]/live`)
- [X] T057 [US6] **Security review**: public thread posting and removal authorization, output encoding (plain text only, no HTML), rate limit, live stream access; record in `docs/security-review.md`

**Checkpoint**: Questions can be asked and answered in public, live

---

## Phase 9: User Story 7 - Keep requests safe and tidy (Priority: P3)

**Goal**: Issues can be raised about requests and public messages; export and account deletion cover
the new data.

**Independent Test**: Raise an issue about a request and a message; export data and find requests
and public messages; delete an account and check its open requests and messages are gone.

### Tests for User Story 7

- [X] T058 [P] [US7] API tests: `POST /requests/{id}/flags` (non-asker; 1–500 characters; goes to the asker; request unchanged; `flag` notice) and `POST /public-messages/{id}/flags` (non-author; goes to the author; message unchanged) in `apps/api/src/routes/requests.test.ts` and `apps/api/src/routes/public-messages.test.ts`; export contains `requests.json` and `public_messages.json` with the fields in [data-model.md](data-model.md) "Export" in `apps/api/src/routes/me-settings.test.ts`; deleting an account closes open requests with `account_deleted` (description and area cleared, `404` to others, not in lists), deletes public messages, and leaves links showing "No longer available" in `apps/api/src/routes/members.test.ts`
- [X] T059 [P] [US7] Playwright spec `apps/web/tests/e2e/requests-us7-safety.spec.ts`: raise an issue about a request (pop-up and no-JS page) and about a message; the asker sees it on the request and the author under their message; settings show the two new notification switches, off by default; axe

### Implementation for User Story 7

- [X] T060 [US7] Implement request and public-message flags in `apps/api/src/modules/requests.ts` and `apps/api/src/modules/public-messages.ts` (reuse the offering flag logic and its `checkRateLimit('flag:…', 10, 24 * 60)`), with routes `POST /requests/{id}/flags` and `POST /public-messages/{id}/flags`; include `flags` for the asker in `getRequest` and on the author's own messages in `listThread`; mark seen when viewed
- [X] T061 [US7] Pages: `apps/web/src/routes/requests/[id]/issue/` and `apps/web/src/routes/public-messages/[id]/issue/` (no-JS fallbacks), "Raise an issue" PopupDialog on the request page for others; flags shown to the asker on the request and to the author under the message; a count of unseen request flags on the **My requests** tab and on the **Requests** nav link (like "My offerings"), from a new `unseenRequestFlags` in `GET /me/summary` (`apps/api/src/routes/me.ts` and its module) and `apps/web/src/routes/+layout.svelte`
- [X] T062 [P] [US7] Export: add `requests.json` and `public_messages.json` to `apps/api/src/modules/export.ts` and add both files to the file list in `specs/001-community-resource-sharing/contracts/export-format.md` (one line each, marked "added in 003")
- [X] T063 [US7] Account deletion in `apps/api/src/modules/members.ts` `deleteAccount`: in the same transaction, close open requests with `account_deleted` and clear their description and area; delete the member's public messages; update the function's comment list
- [X] T064 [P] [US7] Settings: the two new types on `apps/web/src/routes/settings/notifications/+page.svelte` with their plain names (already in the shared list from T003), off until turned on; add the emails/device titles per [contracts/notifications.md](contracts/notifications.md) in `apps/api/src/notify/index.ts`
- [X] T065 [US7] **Security review**: flags on requests and messages, export contents, deletion; record in `docs/security-review.md`

**Checkpoint**: All stories complete

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T066 [P] Extend `apps/web/tests/e2e/accessibility.spec.ts` to scan `/requests`, `/requests/new`, `/requests/[id]` (asker and other), `/requests/[id]/link`, and an offering page with a public thread, in light and dark, at 320 px width and 200% zoom
- [X] T067 [P] Seed demo data in `apps/api/scripts/seed-demo.ts`: requests of each kind (one with dates, one Trade with give-back items, one closed by agreement), a linked offering, and a few public messages on a request and an offering
- [X] T068 [P] Update help: `apps/web/src/lib/help/Requests.svelte` (public messages: who can read them, what not to share, removing your own), `Offering.svelte` (public messages on offerings, "Offer something"), `Finding.svelte` (requests live on their own page), `Notifications.svelte` (the two new types); HelpLink on `/requests`, `/requests/new`, `/requests/[id]`
- [X] T069 [P] Update `docs/operator.md` (nothing new to configure; note public threads use the same live connection as proposal messages) and `CONTRIBUTING.md` if it lists modules
- [ ] T070 Run `npm run lint`, `npm run check`, `npm test`, `npm run test:e2e`, and the manual [quickstart.md](quickstart.md) scenarios 1–8; fix anything found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: after Setup; blocks every story
- **US1 (Phase 3)**: after Foundational; the MVP
- **US2 (Phase 4)**: after US1 (adds to the request form)
- **US3 (Phase 5)**: after US1 (answers a request)
- **US4 (Phase 6)**: after US3 (needs linked offerings)
- **US5 (Phase 7)**: after US1; independent of US2–US4
- **US6 (Phase 8)**: after Foundational (offering threads) and US1 (request threads); independent of US2–US5
- **US7 (Phase 9)**: after US1 and US6 (flags on messages)
- **Polish (Phase 10)**: after the stories you ship

### Within Each Story

- Tests first (confirm they fail), then module, then routes, then pages
- Security review before the checkpoint

### Parallel Opportunities

- T001–T004 together
- T006, T008, T011, T012 alongside T005/T007
- After US1: US2, US3, US5, and US6 can proceed in parallel (different files), then US4, then US7

---

## Parallel Example: User Story 3

```bash
# Tests together:
Task: "API link tests in apps/api/src/routes/requests.test.ts"            # T028
Task: "Playwright spec apps/web/tests/e2e/requests-us3-answer.spec.ts"     # T029
# Then, alongside the module work:
Task: "offeringPrefillFromRequest in apps/web/src/lib/request-form.ts"      # T033
Task: "Fulfills line in OfferingCard.svelte and offerings/[id]"              # T036
```

## Parallel Example: User Story 6

```bash
Task: "API tests in apps/api/src/routes/public-messages.test.ts"           # T051
Task: "Playwright spec apps/web/tests/e2e/requests-us6-public.spec.ts"     # T052
```

---

## Implementation Strategy

### MVP First

1. Phases 1–2: schema rebuilt, shared types, live channels generalised
2. Phase 3 (US1): requests can be posted and seen
3. **Stop and validate** with quickstart scenario 1

### Incremental Delivery

US1 → US2 (suggestions) → US3 (answer) → US4 (close on agreement: the full loop) → US5 (browse) →
US6 (public threads) → US7 (safety and data) → Polish. Each adds value without breaking the
previous ones.

## Phase 11: Convergence

- [X] T071 CRITICAL: make the remaining plain form posts on 003 pages update in place with `use:enhance` (keep the scroll position, show the result next to the control or in the pop-up it came from, close pop-ups on success), with `#anchor` actions or redirects as the no-JavaScript fallback: `apps/web/src/routes/requests/[id]/+page.svelte` (close, confirm close, reopen, unlink, flag), `apps/web/src/lib/components/HelpChoices.svelte` (offer an existing offering), `apps/web/src/lib/components/PublicThread.svelte` (flagMessage), and `apps/web/src/routes/offerings/[id]/+page.svelte` (pause, resume, remove, confirm remove, reopen, flag); add a Playwright check that one of them keeps the page where it was, per Constitution V "things on screen stay put" (contradicts)
- [X] T072 Let the asker take any link off their own request ("Not for my request"), not only links they made: allow it in `removeLink` and `canRemove` in `apps/api/src/modules/requests.ts`, keep the offering unchanged, cover it in `apps/api/src/routes/requests.test.ts` and `apps/web/tests/e2e/requests-us3-answer.spec.ts`, per FR-017a (partial)

## Phase 12: Convergence

- [X] T073 CRITICAL: make saving notification settings and removing a device in `apps/web/src/routes/settings/notifications/+page.svelte` update in place with `stayPut` from `apps/web/src/lib/stay-put.ts` (keep the scroll position; show "Your notification settings are saved." / "That device won't get notifications any more." and errors next to the Save button or the device list instead of at the top; `#anchor` actions for the no-JavaScript fallback), and extend `apps/web/tests/e2e/requests-us7-safety.spec.ts` (the new switches) to check the page stays where it was, per Constitution V "things on screen stay put" (contradicts)

## Phase 13: Convergence

- [X] T074 CRITICAL: make Decline / Withdraw (both the first press and the "Yes, decline it" / "Yes, withdraw it" confirmation) on `apps/web/src/routes/proposals/[id]/+page.svelte` update in place with `stayPut` from `apps/web/src/lib/stay-put.ts` (keep the scroll position; show the confirmation box, "You declined this proposal." / "You withdrew your proposal.", the "changed" notice and errors next to those buttons instead of at the top; "Keep it open" with `data-sveltekit-reset="false"` (SvelteKit 3 replaced `data-sveltekit-noscroll`); `#anchor` actions for the no-JavaScript fallback), and add a check to `apps/web/tests/e2e/stay-put.spec.ts` that withdrawing a proposal tied to a request keeps the page where it was, per Constitution V "things on screen stay put" (contradicts)

## Phase 14: Convergence

- [X] T075 CRITICAL: keep the "+" panel and the Send row where they are when a pill is added or taken out in `apps/web/src/lib/components/MessageComposer.svelte` / `apps/web/src/lib/components/MessageBox.svelte` (today ticking "My phone number" or setting a call time inserts the pills strip at the top of the text box, so the box, the "+" button and its open panel jump down under the pointer; e.g. move the scroll position by the strip's change in height so what the member is working on stays still, or keep the strip's space while the panel is open), and add a check to `apps/web/tests/e2e/stay-put.spec.ts` that the "+" button doesn't move when a pill is added, per Constitution V "things on screen stay put" (contradicts)
- [X] T076 CRITICAL: give the agreement page one primary action: pass `sendVariant="outline"` to `ProposalMessages` in `apps/web/src/routes/agreements/[id]/+page.svelte` while "Mark returned" is shown (owner, loan not yet returned), as the proposal page does while it's open, per Constitution II "one clear primary action" (contradicts)
- [X] T077 CRITICAL: update "Sharing your phone number or email" in `apps/web/src/lib/help/Proposals.svelte` to describe the "+" beside Send (add your phone number, email or a time to call; they go with your message and show as small labels), replacing the removed "Share your phone number or email" and "suggest a time to call" wording, per Constitution VI "user-facing features MUST be documented in plain language" (contradicts)
