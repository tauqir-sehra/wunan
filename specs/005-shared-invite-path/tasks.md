---

description: "Task list for How You're Connected (feature 005)"
---

# Tasks: How You're Connected

**Input**: Design documents from `/specs/005-shared-invite-path/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included, as in 001 to 004: Vitest unit and route tests against the test database, and a
Playwright spec with axe scans in light and dark themes. Within each story, write the tests first
and confirm they fail.

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: User story from spec.md (US1–US3)
- Paths follow plan.md: `apps/api/`, `apps/web/`, `packages/shared/`

## Conventions for every task

- All earlier conventions hold (top of [004 tasks.md](../004-arrangements/tasks.md)) and
  [AGENTS.md](../../AGENTS.md): read the constitution first; thin routes calling one module; pages
  call the API only via `apps/web/src/lib/api.ts`; no animations; no new dependencies; every module
  starts with a comment saying what it's for.
- **Words**: the person at the top is the "common ancestor" in code comments and docs. Members read
  "You both trace back to {name}", never anything saying that person invited them both
  (spec Clarifications).
- **Database**: nothing is kept. After the schema change, delete `apps/api/drizzle/`, run
  `npm run db:generate -w apps/api` to produce one `0000_initial.sql`, re-apply its two hand edits
  exactly as 004 did (the `btree_gist` extension at the top, and the
  `arrangement_loans_dont_overlap` exclusion constraint with its comment), then
  `npm run db:reset -w apps/api` and `npm run db:reset -w apps/api -- --test`.
- **After each phase**: `npm run check`, `npm test`, and the relevant `npm run test:e2e -- <spec>`
  from `apps/web` must pass. Don't edit files while a browser test run is going.

---

## Phase 1: Setup

- [X] T001 Read [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md) and both [contracts](contracts/); confirm `.specify/feature.json` points at `specs/005-shared-invite-path`

---

## Phase 2: Foundation (blocks every story)

**Purpose**: every member row carries its invite line, written once and checked by the database.

- [X] T002 Add to `packages/shared/src/schemas/members.ts`: `ConnectionPerson` (`{ id, displayName, isFounder, isFormerMember }`), `Connection` (`{ kind: 'self' | 'shared' | 'theyAreAbove' | 'youAreAbove' | 'separate', top: ConnectionPerson | null, toYou: ConnectionPerson[], toThem: ConnectionPerson[] }`), and `connection: Connection` on the profile schema; export from `packages/shared/src/index.ts`
- [X] T003 Add `inviteLine: uuid().array().notNull()` to `member` in `apps/api/src/db/schema/members.ts` with the checks from data-model.md, verbatim: `member_invite_line_ends_with_self`: "`invite_line[cardinality(invite_line)] = id`"; `member_invite_line_matches_inviter`: "either `is_founder and invited_by_id is null and cardinality(invite_line) = 1`, or `invited_by_id is not null and cardinality(invite_line) >= 2 and invite_line[cardinality(invite_line) - 1] = invited_by_id`". No index on it. Comment: written once on joining, never updated, because an inviter never changes
- [X] T004 Write a failing test in `apps/api/src/routes/members.test.ts`: an account created by `createAccount` (founder, invitee, invitee's invitee) stores `invite_line` founder → self; inserting a row whose line doesn't end with itself, or whose second-to-last id isn't its inviter, is rejected by the database
- [X] T005 In `createAccount` (`apps/api/src/modules/members.ts`): generate the id with `crypto.randomUUID()` before inserting; for an invitee read the inviter's `inviteLine` in the same `tx` and store `[...inviter.inviteLine, id]`; for a founder store `[id]`. Throw if the inviter row isn't found
- [X] T006 [P] In `apps/api/scripts/seed-demo.ts`: give each member an id up front and build `inviteLine` in memory from its inviter's line (members are created in order, so the inviter's line is already known)
- [X] T007 Regenerate the migration and reset both databases as in the Conventions; run `npm test` (T004 now passes, nothing else broken)

**Checkpoint**: every member has a correct invite line; the app works as before.

---

## Phase 3: User Story 1 - See how I'm connected to someone on their profile (Priority: P1) 🎯 MVP

**Goal**: another member's profile shows the tree and sentences for two lines that branch below a
common ancestor.

**Independent Test**: Fay → Ben → you and Fay → Chloe → Faraz → Rosa; on Rosa's profile the side
column shows Fay with "You both trace back to Fay", Ben and "You" on one side, Chloe, Faraz and Rosa
on the other, with matching sentences and links.

### Tests for User Story 1

- [X] T008 [P] [US1] Write `apps/api/src/modules/connection.test.ts` for `connectionOf(viewerLine, memberLine)` (lines of ids, founder first): `shared` with branches of different lengths (the example-tree case), `shared` where the ancestor directly invited both, `top` is the last shared id, `toYou`/`toThem` exclude `top` and end with each member, order is top-down
- [X] T009 [P] [US1] Add route tests in `apps/api/src/routes/members.test.ts`: `GET /members/{id}` for Rosa as the viewer returns `connection` of kind `shared` with Fay at top and the right names; a person on a line who deleted their account shows with "(no longer a member)" and `isFormerMember: true`; opening the profile *of* a member who left still returns `connection`, with them at the end of `toThem`; `connection` never contains `email`, `sharePhone` or `shareEmail`
- [X] T010 [P] [US1] Write `apps/web/tests/e2e/members-connection.spec.ts` (shared case): the section heading "How you're connected"; the sentence "You both trace back to Fay. Fay invited Ben, who invited you. Fay invited Chloe, who invited Faraz, who invited Rosa."; each name in the sentences is a link to that profile; the drawing labels "You both trace back to Fay", "You" and "Whose profile this is" are visible; the drawing is `aria-hidden` and its links have `tabindex="-1"`; no sideways scroll at 320 px, nor at a 640 px viewport with the page zoomed to 200% (`document.documentElement.style.zoom = '2'`); the profile of a member who left still shows the section, with their name not a link; `expectAccessible` in light and dark themes. Wait for `networkidle` before checks

### Implementation for User Story 1

- [X] T011 [US1] Create `apps/api/src/modules/connection.ts`: pure `connectionOf(viewerLine: string[], memberLine: string[])` returning `{ kind, topId, toYouIds, toThemIds }` per the table in data-model.md (longest common prefix; no database). Module comment says what it's for and why it's a prefix
- [X] T012 [US1] In `apps/api/src/modules/members.ts`: `getProfile(memberId, viewerId)` reads both members' `inviteLine` and everyone on them in one query (`select … from member where id = any(line_a || line_b)`, with the two lines fetched in a CTE), calls `connectionOf`, and maps ids to `ConnectionPerson` using `shownName`. Take `invitedBy` from the profile member's line (its second-to-last person, already in that query) and drop the separate inviter query
- [X] T013 [US1] In `apps/api/src/routes/members.ts`: pass the signed-in member's id to `getProfile`; response schema includes `connection`
- [X] T014 [US1] Create `apps/web/src/lib/components/InviteConnection.svelte` per [contracts/pages.md](contracts/pages.md): `<section aria-labelledby="connection-heading">`, `h2` "How you're connected", the visible sentences with linked names (people who left are plain text), and the `aria-hidden` drawing: the top person with "You both trace back to {name}" under it, then one column per branch side by side, names stacked with a thin CSS line between, "You" and "Whose profile this is" labels as text with a border as extra emphasis, the existing "Founding member" badge text, links `tabindex="-1"`, names wrap (`break-words`), no motion. Top comment says why the drawing is hidden from screen readers
- [X] T015 [US1] In `apps/web/src/routes/members/[id]/+page.svelte`: switch to `page-columns`; main column keeps name, joined, badge, bio, "Invited by", "People they invited"; side column holds `InviteConnection` (after the main content on narrow screens) (FR-012). Remove the "See the full invite chain" link
- [X] T016 [US1] Run T008–T010 until they pass

**Checkpoint**: US1 works on its own.

---

## Phase 4: User Story 2 - The connection when one of us is in the other's line (Priority: P1)

**Goal**: single lines and your own profile read correctly.

**Independent Test**: your inviter's profile reads "Ben invited you."; the profile of someone your
invitee invited reads "You invited Sam, who invited Rosa."; your own profile reads "Your invite line"
and "Fay invited Ben, who invited you."; a founder's own profile reads "You started this community."

### Tests for User Story 2

- [X] T017 [P] [US2] Extend `apps/api/src/modules/connection.test.ts`: `theyAreAbove` (member is the viewer's inviter, and further up), `youAreAbove` (direct and further down), `self` for a member (top is the founder) and for a founder (`toYou` empty)
- [X] T018 [P] [US2] Extend `apps/web/tests/e2e/members-connection.spec.ts`: the four independent-test sentences; no "You both trace back to" label in the single-line cases; own profile heading "Your invite line"; axe scan on the own-profile state

### Implementation for User Story 2

- [X] T019 [US2] Finish `connectionOf` in `apps/api/src/modules/connection.ts` for `self`, `theyAreAbove`, `youAreAbove`
- [X] T020 [US2] In `apps/web/src/lib/components/InviteConnection.svelte`: one-column drawing for single lines, the words for each kind from contracts/pages.md (including "Fay invited you." for a one-person branch, "You invited Sam."), heading "Your invite line" on your own profile, "You started this community." for a founder; the viewed member at the top of a single line gets only "Whose profile this is"
- [X] T021 [US2] Run T017–T018 until they pass

---

## Phase 5: User Story 3 - Members with no common ancestor (Priority: P2)

**Goal**: lines that end at different founding members are shown truthfully and calmly.

**Independent Test**: founders Fay and Omar each invite someone; one invitee opens the other's
profile and sees two columns, each topped by its founder, and "You and {name} trace back to
different founding members."

- [X] T022 [P] [US3] Extend `apps/api/src/modules/connection.test.ts` and `apps/api/src/routes/members.test.ts` (a second founder created with `createAccount({ isFounder: true })`): `separate`, `top` null, each list the full line from its founder
- [X] T023 [P] [US3] Extend `apps/web/tests/e2e/members-connection.spec.ts` with the two-founder case and an axe scan
- [X] T024 [US3] Finish `separate` in `apps/api/src/modules/connection.ts` and in `apps/web/src/lib/components/InviteConnection.svelte` (two columns with no shared top, the sentence, then each line as a sentence)
- [X] T025 [US3] Run T022–T023 until they pass

---

## Phase 6: Removing the invite chain page (FR-009)

- [X] T026 Remove `GET /members/{id}/chain` from `apps/api/src/routes/members.ts`, `getChain` from `apps/api/src/modules/members.ts`, and `ChainLink` / `MemberChain` from `packages/shared/src/schemas/members.ts`; replace the "follows the chain up to a founder" test in `apps/api/src/routes/members.test.ts` with one that `/members/{id}/chain` is `404`
- [X] T027 [P] Delete `apps/web/src/routes/members/[id]/chain/`; in `apps/web/tests/e2e/us1-join.spec.ts` replace the "See the full invite chain" steps with a check of the "How you're connected" section; in `apps/web/tests/e2e/accessibility.spec.ts` drop `/members/${samId}/chain` from the scanned pages
- [X] T028 [P] Remove the `/members/{id}/chain` rows from `specs/001-community-resource-sharing/contracts/api.md` and `specs/001-community-resource-sharing/contracts/pages.md`, each with a note pointing to 005; note in 001 FR-004 that following the chain is now through the profile's names (005)
- [X] T029 Add `005-shared-invite-path` to the contract list in `apps/api/src/openapi.test.ts` and make it pass
- [X] T030 `grep -rn "/chain" apps/ packages/` finds nothing but the 404 test

---

## Phase 7: Polish and cross-cutting

- [X] T031 [P] Speed (SC-003): in `apps/api/src/routes/members.test.ts` build two lines 20 deep under one founder and check `GET /members/{id}` for the deepest returns all 40 people well within 2 s; log nothing personal
- [X] T032 [P] Add a 005 section to `docs/security-review.md`: `invite_line` is never written from input; `connection` carries only `id`, display name, founder and left flags; members-only as before
- [X] T033 [P] Check `README.md` "What it does" (invitations bullet) still reads true; no change expected, since it doesn't mention the chain page
- [X] T034 Reset and reseed the demo database (`wunan_demo`) with the new schema and restart the API (`touch apps/api/src/index.ts`)
- [X] T035 Run `npm run check`, `npm test`, and the full `npm run test:e2e`; fix what fails
- [ ] T036 Walk through [quickstart.md](quickstart.md) by hand, including keyboard, screen reader, 320 px and 200% zoom with a deep line, and dark theme

---

## Dependencies and order

- **Phase 2** blocks everything (the column must exist before the profile can read it).
- **US1 (Phase 3)** is the MVP. **US2** and **US3** extend the same pure function and component, so
  they follow US1, but each adds only its own cases and can be checked on its own.
- **Phase 6** can run any time after T015 (the profile no longer links to the page).
- **Polish** last.

## Parallel examples

- Phase 2: T006 (seed) alongside T005 (createAccount).
- US1: T008, T009, T010 (three test files) together, before T011–T015.
- US2: T017 and T018 together. US3: T022 and T023 together.
- Phase 6: T027 and T028 alongside T026.
- Polish: T031, T032, T033 together.

## Implementation strategy

1. Foundation, then US1: the profile shows the shared tree. Stop and check.
2. US2: single lines and your own profile.
3. US3: different founders.
4. Remove the chain page, polish, walk through the quickstart.

## Phase 8: Convergence

- [X] T037 Dropped (design changed: the maintainer removed the "Whose profile this is" label and the line sentences; spec and contracts updated to match). Was: CRITICAL: put back the word labels in the drawing in `apps/web/src/lib/components/InviteConnection.svelte`: "You" under the viewer's box and "Whose profile this is" under the profile member's box; today only a thicker border tells them apart, which is shape alone per FR-003 and Constitution (accessible: nothing by colour or shape alone) (contradicts)
- [X] T038 Dropped (same design change). Was: put back the line sentences in `apps/web/src/lib/components/InviteConnection.svelte`: `shared` adds "Fay invited Ben, who invited you." and the member's branch after "You both trace back to Fay."; `separate` adds each line from its founding member (`lineSentence(toYou[0], toYou.slice(1))`, same for `toThem`) per FR-005, FR-006 and contracts/pages.md (partial)
- [X] T039 Run `npm run test:e2e -- members-connection` (3 tests fail today), then `npm run check`, `npm test` and the full `npm run test:e2e` per T035 (partial)
- [X] T040 With the line sentences gone, make the drawing the accessible part in `apps/web/src/lib/components/InviteConnection.svelte`: no `aria-hidden` or `tabindex="-1"`; each branch an `<ol>` named "From Fay down to you"; names in the drawing are the only links (the sentence is plain text); the top label is `aria-hidden` since the sentence says it per FR-005 and Constitution IV (contradicts)
