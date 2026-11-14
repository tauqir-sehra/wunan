# Tasks: A home page of what needs you

**Input**: Design documents from `specs/007-home-needs-you/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/pages.md](contracts/pages.md), [quickstart.md](quickstart.md)

**Tests**: Written first (AGENTS.md: "When implementing, write tests first").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (US1–US5)

---

## Phase 1: Setup

- [X] T001 Confirm the branch is `007-home-needs-you` (made from `006-fill-details-in-place`, which isn't merged yet; say so in the PR)

---

## Phase 2: Foundation (blocks every story)

- [X] T002 [P] In new `packages/shared/src/schemas/home.ts` (module comment first) add Zod schemas per data-model.md: `DueBack` (`arrangementId`, `myRole: 'requester' | 'lister'`, `otherMember: memberRef`, `offering: { id, title }`, `loanEndsAt` ISO string, `overdue: boolean`), `OffersOnRequest` (`request: { id, title }`, `count` "≥ 1", `helpers: memberRef[]` "distinct, oldest first", `firstOffering: { id, title }`, `since` ISO), `AskedToChange` (`subject: 'offering' | 'request'`, `id`, `title`, `count`, `since`), `Home` (`arrangements: ArrangementSummary[]`, `dueBack`, `offers`, `askedToChange`) and `HomePressed` (a union: `{ kind: 'offers', requestId }` or `{ kind: 'askedToChange', subject: 'offering' | 'request', id }`); export them from the shared index
- [X] T003 [P] Add `homePressedAt: timestamp({ withTimezone: true })` (nullable, with a one-line comment: "When the asker pressed the Home line covering this; null: still listed (007)") to `requestLink` in `apps/api/src/db/schema/requests.ts` and to `flag` in `apps/api/src/db/schema/flags.ts` ("independent of `seenAt`")
- [X] T004 Add the two columns to the single initial migration `apps/api/drizzle/0000_initial.sql` (by hand: it has hand-written parts) and its `meta/` snapshot, check `drizzle-kit generate` finds no changes, and rebuild the development and test databases from scratch (research §8)
- [X] T005 Add `007-home-needs-you` to the contracts read by `apps/api/src/openapi.test.ts` (update its comment); it fails until the endpoints exist
- [X] T006 Create `apps/api/src/modules/home.ts` (module comment first) with `homeFor(memberId, now = new Date())` returning an empty `Home`, and `markPressed(memberId, body)`; add routes `GET /me/home` (→ `Home`) and `POST /me/home/pressed` (body `HomePressed` → `204`) to `apps/api/src/routes/me.ts` with OpenAPI descriptions, so T005 passes

**Checkpoint**: shapes, columns and empty endpoints exist; the contract test passes.

---

## Phase 3: User Story 1 - See what's waiting on me in one place (P1) 🎯 MVP

**Goal**: Signed-in members land on Home, which lists the arrangements waiting on them, exactly as "Waiting on you" on Arrangements.

**Independent Test**: With one arrangement waiting on the member and one not, sign in: Home lists only the waiting one, linking to it; after acting on it, it's gone.

### Tests first

- [X] T007 [P] [US1] New `apps/api/src/routes/home.test.ts`: `GET /me/home` lists exactly the caller's arrangements where `needsMe` is true (same ids as `GET /arrangements` `needsYou`), oldest `lastActivityAt` first; never another member's; never ones the caller only helps with; signed out → `401`
- [X] T008 [P] [US1] New `apps/web/tests/e2e/home.spec.ts`: signing in lands on `/` with `h1` "Waiting on you"; the header shows "Home" first and marked current (`aria-current="page"`), and the wunan name links to `/`; a lister with an asked arrangement ready to accept sees an "Arrangements" group with a line in the same words as the Arrangements list linking to `/arrangements/{id}`; an in-progress arrangement isn't listed; after accepting, back on Home the line is gone; signed out, `/` goes to `/offerings` as before; `expectAccessible` light and dark; fits 320 px. Wait for `networkidle` before clicking the phone "Menu"

### Implementation

- [X] T009 [US1] In `apps/api/src/modules/home.ts` fill `arrangements`: the caller's arrangements via the existing `summarise` (from `apps/api/src/modules/arrangements.ts`, exported if needed) filtered by `needsMe`, ordered by `lastActivityAt` ascending (research §2)
- [X] T010 [US1] Replace the redirect in `apps/web/src/routes/+page.server.ts`: signed out → `redirect(307, '/offerings' + search)` as today; signed in → load `GET /api/v1/me/home` and `?all=` (comma-separated group ids). Update the module comment
- [X] T011 [P] [US1] New `apps/web/src/lib/components/HomeLine.svelte` (top comment): one `<li>` with a link whose text is the line's words; for arrangements "{offering}: {other} asked you | you asked {other}. {stageWords}" plus "New message" when unread, reusing `stageWords` from `apps/web/src/lib/format.ts` as `ArrangementCard.svelte` does (so a loan listed here still shows its due day; contracts/pages.md)
- [X] T012 [US1] New `apps/web/src/routes/+page.svelte` (top comment): `h1` "Waiting on you" with `HelpLink` to the new help topic; the "Arrangements" group (`<section aria-labelledby>` + `h2` + `ul`, `id="arrangements"`) only when it has lines; no filled button, no live updates (research §9)
- [X] T013 [US1] In `apps/web/src/routes/+layout.svelte`: add `{ href: '/', label: 'Home' }` first in `main`; make `isCurrent('/')` true only on `/` exactly; check the wunan name links to `/`; update the top comment
- [X] T014 [P] [US1] New `apps/web/src/lib/help/Home.svelte` (short, plain words: what Home lists, that lines go when dealt with or pressed) and register it where the other help topics are
- [X] T015 [US1] Run `npm run check`, `npm test` and `npm run test:e2e -- home`

**Checkpoint**: Home exists and shows what Arrangements calls "Waiting on you".

---

## Phase 4: User Story 2 - Nothing needs me (P1)

**Goal**: With nothing waiting, Home says "Nothing right now." under the heading, and nothing else.

**Independent Test**: As a member with nothing waiting, Home shows the heading and "Nothing right now." only.

- [X] T016 [US2] Extend `apps/web/tests/e2e/home.spec.ts`: a new member sees `h1` "Waiting on you" and "Nothing right now."; no `h2`, no search box, no filled button; Offerings and Requests are links in the header; `expectAccessible` light and dark; 320 px
- [X] T017 [US2] In `apps/web/src/routes/+page.svelte` show "Nothing right now." when all four groups are empty (FR-008)

---

## Phase 5: User Story 3 - Things due back (P2)

**Goal**: Borrower and lender see a loan from 2 days before it's due, with weekday and date; the borrower also when late; the lender's late loan stays under Arrangements only.

**Independent Test**: A loan ending the day after tomorrow is listed for both; one ending in 4 days isn't; marked returned → gone.

- [X] T018 [P] [US3] New `apps/api/src/modules/home.test.ts` (with a fixed `now`): `dueBack` includes agreed loans not returned with `loanEndsAt < start of the community's day 3 days from today` (due today, tomorrow, the day after, or past) for borrower and lender; excludes due in 3+ days, returned, not agreed; excludes any already in `arrangements` (the lender's late loan, or one with an unread message); `overdue` true when past; ordered by `loanEndsAt`; a loan due at 10:00 shows from the start of the day two days before
- [X] T019 [P] [US3] Extend `apps/web/tests/e2e/home.spec.ts`: an agreed loan ending in 2 days → the borrower sees "Fay's drill is due back on {weekday day month}" and the lender "Sam is due to bring back your drill on {weekday day month}", each linking to the arrangement under a "Due back" group; marked returned → gone
- [X] T020 [US3] In `apps/api/src/modules/home.ts` fill `dueBack` per data-model.md "Due back", using the community day from `apps/api/src/lib/time.ts` (add a `startOfLocalDay(date, plusDays)` helper there if there isn't one)
- [X] T021 [US3] In `apps/web/src/lib/format.ts` add `dueDay(iso)` → "Thursday 20 November" (`en-GB`, year only if not this year); in `HomeLine.svelte` and `+page.svelte` add the "Due back" group (`id="due-back"`) with the borrower, lender and late wording from contracts/pages.md

---

## Phase 6: User Story 4 - New offers on my requests (P2)

**Goal**: New linked offerings on open requests are listed, one line per request, until pressed on Home.

**Independent Test**: Answer an asker's request: Home lists it; opening the request elsewhere leaves it; pressing the line lands on the request and removes it; another answer brings it back.

- [X] T022 [P] [US4] Extend `apps/api/src/routes/home.test.ts`: `offers` lists the caller's open requests with links whose `homePressedAt` is null and `linkedById` isn't the caller, grouped by request with `count`, distinct `helpers` oldest first, `firstOffering` and `since`; closed requests, the asker's own links, and offerings that aren't `available` (paused, closed or deleted) aren't listed; viewing the request (`GET /requests/{id}`) doesn't remove it; `POST /me/home/pressed { kind: 'offers', requestId }` → `204` and removes it; again → `204`; another member's request → `404`; a new link afterwards brings the line back with `count` 1
- [X] T023 [P] [US4] Extend `apps/web/tests/e2e/home.spec.ts`: Sam answers Rana's request → Rana's Home lists "Sam offered {offering} for your request {title}" under "Offers on your requests"; opening the request from Requests leaves it; pressing the line lands on `/requests/{id}` and back on Home it's gone; also without JavaScript
- [X] T024 [US4] In `apps/api/src/modules/home.ts` fill `offers` (only offerings with `status = 'available'`) and handle `markPressed` for `kind: 'offers'` per data-model.md (only the caller's request, only unpressed links; `404` otherwise)
- [X] T025 [US4] New `apps/web/src/routes/home/go/+server.ts` (module comment: why it's a `GET` endpoint and not a page, research §5): signed out → sign-in with `redirectTo`; only when the request comes from wunan itself (`Sec-Fetch-Site` `same-origin` or `none`, or without it a same-site `Referer`; research §5) posts `HomePressed` to `/api/v1/me/home/pressed` (ignoring failures) and `redirect(303, …)` to `/requests/{id}` for offers, `/offerings/{id}` or `/requests/{id}` for asked to change; unknown `kind` → `/`
- [X] T026 [US4] In `HomeLine.svelte` and `+page.svelte` add the "Offers on your requests" group (`id="offers"`): one offer "Sam offered Camping tent for your request Tent"; more "3 new offers for your request Tent, from Sam, Ana and others"; links to `/home/go?kind=offers&id={requestId}`

---

## Phase 7: User Story 5 - Asked to change something (P3)

**Goal**: Requests to change the member's offerings or requests are listed, one line per thing, until pressed on Home.

**Independent Test**: Flag an offering: owner's Home lists it; seeing it on the offering leaves it; pressing the line removes it.

- [X] T027 [P] [US5] Extend `apps/api/src/routes/home.test.ts`: `askedToChange` lists flags with `homePressedAt` null on the caller's offerings and requests (not public messages), grouped by thing with `count` and `since`; viewing the offering (which sets `seenAt`) doesn't remove it; `POST /me/home/pressed { kind: 'askedToChange', subject, id }` removes it; not the caller's → `404`; a new flag brings it back; `GET /me/summary` counts are unchanged by pressing
- [X] T028 [P] [US5] Extend `apps/web/tests/e2e/home.spec.ts`: another member asks Fay to change something about her offering → "Someone asked you to change something about {title}" under "Asked to change"; viewing the offering leaves it; pressing it lands on `/offerings/{id}` and removes it
- [X] T029 [US5] In `apps/api/src/modules/home.ts` fill `askedToChange` and `markPressed` for `kind: 'askedToChange'`; in `HomeLine.svelte` and `+page.svelte` add the group (`id="asked-to-change"`) with the wording from contracts/pages.md, linking to `/home/go?kind=askedToChange&subject={subject}&id={id}`

---

## Phase 8: See all, stays put, and old landings

- [X] T030 [P] Extend `apps/web/tests/e2e/home.spec.ts`: with 7 lines in one group → 5 and "See all 7"; pressing it shows the other 2 below and focuses the 6th; without JavaScript `?all=…#…` shows them
- [X] T031 [P] Add to `apps/web/tests/e2e/stay-put.spec.ts`: on Home, "See all" keeps the scroll position and the group heading's position
- [X] T032 In `apps/web/src/routes/+page.svelte`: each group shows its first 5, then a link "See all {n}" to `?all={group}#{group}` with `data-sveltekit-reset="false"`; when `all` includes it, render the rest after the first 5 and move focus to the first new line (FR-011, research §6)
- [X] T033 [P] Update only the browser specs that sign in and then expect to be on `/offerings` (signed-out ones, such as `apps/web/tests/e2e/us1-join.spec.ts:68` `redirectTo=%2Fofferings`, stay as they are) to go to `/offerings` explicitly; and check that joining (`apps/web/src/routes/join/`) and accepting an invitation land on `/` rather than `/offerings`, changing their redirects if not (FR-001)
- [X] T034 [P] Update `docs/` and the help index where they say members land on Offerings / "Find" (search `apps/web/src/lib/help/` and `docs/` for "land", "Find")

---

## Phase 9: Polish

- [X] T035 Run `npm run format` on the changed files only (not the whole repo), then `npm run check`, `npm test` and the full `npm run test:e2e`; fix what fails
- [ ] T036 Walk through [quickstart.md](quickstart.md) by hand, including keyboard, screen reader, without JavaScript, 320 px, 200% zoom and dark theme

---

## Dependencies and order

- **Phase 2** blocks everything (T002 → T006; T003 → T004).
- **US1 (Phase 3)** is the MVP and adds the page, header and line component the others extend.
- **US2** right after US1 (same page).
- **US3, US4, US5** each add one group to `home.ts`, `HomeLine.svelte` and `+page.svelte`; they can go in any order, but not at the same time (same files).
- **Phase 8** after the groups exist. **Polish** last.

## Parallel examples

- Phase 2: T002 and T003 together.
- US1: T007 and T008 together, then T011 and T014 alongside T009–T010.
- US3: T018 and T019 together. US4: T022 and T023. US5: T027 and T028.
- Phase 8: T030, T031, T033, T034 together.

## Implementation strategy

1. Foundation, then US1 + US2: Home with arrangements and the empty state. Stop and check.
2. Due back, then offers, then asked to change, one group at a time.
3. See all, old landings, polish, walk through the quickstart.

## Phase 10: Convergence

- [X] T037 Add to `apps/api/src/routes/home.test.ts`: a helper on another member's agreed arrangement (from a request for help) never sees it in `arrangements` or `dueBack` on their own Home per spec Edge Cases "A helper" and contracts/api.md "Never includes arrangements the caller only helps with" (missing)
- [X] T038 Add a browser check to `apps/web/tests/e2e/home.spec.ts` that visiting `/home/go?kind=offers&id=…` with a `Referer` from another site (and no `Sec-Fetch-Site: same-origin`) still redirects to the request but leaves the line on Home per research §5 (missing)
- [X] T039 Update the example wording in `specs/007-home-needs-you/spec.md` (Stories 1, 3, 4, 5) to the row layout now shown (name, then "From Fay · Due back Thursday 20 November", "Sam offered Camping tent", "Someone asked you to change something") so the spec matches contracts/pages.md and the page per AGENTS.md "spec is the source of truth" (contradicts)
