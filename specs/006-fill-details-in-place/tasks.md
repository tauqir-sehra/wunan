# Tasks: Fill in missing details in place

**Input**: Design documents from `specs/006-fill-details-in-place/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/pages.md](contracts/pages.md), [quickstart.md](quickstart.md)

**Tests**: Written first (AGENTS.md: "When implementing, write tests first").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (US1–US4)

---

## Phase 1: Setup

- [X] T001 Switch to a branch `006-fill-details-in-place` (from `005-shared-invite-path`, which isn't merged yet; say so in the PR)

---

## Phase 2: Foundation (blocks every story)

- [X] T002 [P] API test in `apps/api/src/routes/arrangements.test.ts`: `PATCH /api/v1/arrangements/{id}` with only `{ date, time }` changes "When" and leaves handover, place, length and offers as they were; with `{ loanLength: null, loanLengthUnit: null }` clears only that; the messages line names only what changed (research §1)
- [X] T003 [P] API test in `apps/api/src/routes/arrangements.test.ts`: four single-detail PATCHes in a row while the lister has email on and the conversation closed record four messages lines but one `notification_log` row for the lister (FR-004a, SC-005, research §5)
- [X] T004 In `apps/web/src/lib/arrangement-form.ts` add `detailKeys` (the table in research §2: `when` → `date`, `time`; `how` → `handover`; `where` → `place`; `length` → `loanLength`, `loanLengthUnit`; `amount` → `amount`; `return` → `offers`, `ownOffer`, `ownOfferAmount`, `ownOfferUnit`; `session` → `sessionLength`, `sessionLengthUnit`; `sessions` → `sessions`), `pressableDetails(arrangement)` per data-model.md ("Where" only when "How" is not `online` and not `at_lister`; "How much" only when the offering has an amount; requester only; open only), and `detailBody(detail, values, type)` that runs `arrangementBody(..., { forEdit: true })` and keeps only that detail's keys (plus `place: null` when `how` becomes `at_lister` or `online`). Update the module comment
- [X] T005 In `apps/web/src/lib/components/ArrangementFields.svelte` add an `only?: DetailKey` prop: when set, render only that detail's fieldset (no message box, no other fields); unchanged when not set. Update the top comment

**Checkpoint**: the API behaviour the page relies on is pinned; one field can be rendered alone.

---

## Phase 3: User Story 1 - Fill in one missing detail in place (P1) 🎯 MVP

**Goal**: The requester presses "Add when" on a "Not decided yet" row, fills it in there, saves, and the page stays put.

**Independent Test**: As the requester with "When" empty, press "Add when", pick a day, Save: the row shows the day, "Still to settle" loses "When", the messages note it, nothing above moved.

### Tests first

- [X] T006 [US1] New `apps/web/tests/e2e/arrangements-details-in-place.spec.ts`: requester on a loan with "When" and "For how long" empty; each empty row has a link "Add when" / "Add for how long" (no filled button on the page); press "Add when" → only the date (and time) field shows in the row, focus is in it, "Save" is outline; save a day → row shows it, "Still to settle" no longer lists when, the messages show "… changed when to …"; Cancel on "Add for how long" saves nothing and returns focus to the link; opening "Add when" then pressing "Add for how long" leaves only one field open; days already lent → field stays open with the typed value and the message beside it; `expectAccessible` on the row list, the open field and the field with a problem, light and dark; fits 320 px. Wait for `networkidle` first
- [X] T007 [P] [US1] Add to `apps/web/tests/e2e/stay-put.spec.ts`: opening a detail, saving it and cancelling keep the scroll position and the position of the details heading

### Implementation

- [X] T008 [US1] In `apps/web/src/routes/arrangements/[id]/+page.server.ts`: load reads `detail` from the URL and, when it's in `pressableDetails`, also loads the offering (for the field's choices) and `detailValues`; add action `detail` that reads `detail` from the form, rejects keys not pressable, PATCHes `detailBody(...)` and returns success, or the API's error and the typed values (`formAction`). Module comment updated
- [X] T009 [US1] In `apps/web/src/lib/components/ArrangementDetails.svelte`: give the list `id="details"`; for each pressable row add after the value a link `id="detail-<key>"` to `?detail=<key>#details` with `data-sveltekit-reset="false"`, reading "Add <label>" when "Not decided yet" and "Change <label>" otherwise (lowercase label: "Add when", "Add for how long"), outline style; when the URL's `detail` names that row, render instead a `<form method="POST" action="?/detail#details" use:enhance={stayPut()}>` with a hidden `detail`, `ArrangementFields only={key}` filled from `detailValues` (or the returned values), an outline "Save" and a "Cancel" link to the page without `detail` (`#detail-<key>`). On success drop `detail` from the URL without scrolling (`goto` with `noScroll`, `replaceState`) and focus `#detail-<key>`. Focus the field's first input once when it opens. Top comment updated
- [X] T010 [US1] In `apps/web/src/routes/arrangements/[id]/+page.svelte`: remove the "Change details" button and the `'edit'` primary; the requester's open-stage buttons are Withdraw (outline) only (contracts/pages.md "Buttons"); pass what `ArrangementDetails` needs (form result, offering for the open field). Top comment updated
- [X] T011 [US1] Run `npm run check` and `npm run test:e2e -- arrangements-details-in-place stay-put`

**Checkpoint**: empty details are filled in place.

---

## Phase 4: User Story 2 - Change a detail already decided (P1)

**Goal**: Filled rows say "Change when" and open filled; clearing a value makes the row "Not decided yet" again.

**Independent Test**: Press "Change when" on a filled row, pick another day, Save; then clear it and Save: "Not decided yet".

- [X] T012 [US2] Extend `apps/web/tests/e2e/arrangements-details-in-place.spec.ts`: a filled "When" row has "Change when"; it opens filled with the current day; saving a new day shows it and notes it in the messages; clearing and saving shows "Not decided yet" and "Add when"
- [X] T013 [US2] Make T012 pass in `apps/web/src/lib/components/ArrangementDetails.svelte` / `apps/web/src/lib/arrangement-form.ts` (filled values from `detailValues`; an emptied field sends `null` for its keys)
- [X] T014 [US2] Replace the old page: delete `apps/web/src/routes/arrangements/[id]/edit/+page.svelte`; make `apps/web/src/routes/arrangements/[id]/edit/+page.server.ts` only `redirect(308, '/arrangements/<id>#details')` with a comment why; add to the spec in T012 that `/arrangements/<id>/edit` lands on the details

**Checkpoint**: every detail is added and changed in place; the "Change details" page is gone.

---

## Phase 5: User Story 3 - Details that depend on each other (P2)

**Goal**: Saving "How" updates which rows show; "In return" opens with today's trade choices; at the lister's place "Where" says "Picked by {lister}".

**Independent Test**: On a service, set "How" to Online: "Where" goes. Set it back: "Where" is "Not decided yet". On a pickup at the lister's place, "Where" reads the place and "Picked by Fay", with no link.

- [X] T015 [US3] Extend `apps/web/tests/e2e/arrangements-details-in-place.spec.ts`: service "How" → Online removes the "Where" row and "where" from "Still to settle", back to in person brings "Where" back as "Not decided yet"; trade "Add in return" opens only the offer choices; "How" at the lister's place → "Where" shows the place and "Picked by <lister>" with no "Change where" link; the lister sees "Picked by you" (FR-009a)
- [X] T016 [US3] In `apps/web/src/lib/components/ArrangementDetails.svelte` add the quiet "Picked by {lister}" / "Picked by you" note (muted text after the place) when the handover is at the lister's and the arrangement isn't agreed; make the rest of T015 pass

---

## Phase 6: User Story 4 - Without JavaScript (P2)

**Goal**: The same flow works with scripts off.

**Independent Test**: With JavaScript off, press "Add when", fill it, Save: the page comes back at `#details` with the value.

- [X] T017 [US4] Extend `apps/web/tests/e2e/arrangements-details-in-place.spec.ts` with a `javaScriptEnabled: false` context: the link opens the field (URL has `?detail=when#details`), Save returns to `#details` with the value shown; a value that doesn't fit comes back with the field open, the value kept and the message
- [X] T018 [US4] Make T017 pass in `apps/web/src/routes/arrangements/[id]/+page.server.ts` (on failure keep `detail` so the field renders open with `form.values`)

---

## Phase 7: Lister, helper and old words

- [X] T019 [P] Extend `apps/web/tests/e2e/arrangements-details-in-place.spec.ts`: the lister and a helper see no "Add …"/"Change …" links; agreed and ended arrangements have none; posting `?/detail` as the lister gets the API's plain message
- [X] T020 [P] Update the existing browser specs that press "Change details": `apps/web/tests/e2e/arrangements-002-us4-service.spec.ts:71`, `apps/web/tests/e2e/arrangements-002-us1-accept.spec.ts:73` and `:92`, `apps/web/tests/e2e/arrangements-us2-page.spec.ts:38` (the requester's filled buttons are now none), to use the row links
- [X] T021 [P] Update `apps/web/src/lib/help/Arrangements.svelte`: "press a detail to add or change it" instead of "Change details"
- [X] T022 [P] Update `specs/004-arrangements/contracts/pages.md` (lines 49–56 and the `/arrangements/[id]/edit` row) and `specs/002-listing-proposals/contracts/pages.md` where they describe the "Change details" page, each with a note pointing to 006

---

## Phase 8: Polish

- [X] T023 Run `npm run format` on the changed files only (not the whole repo), then `npm run check`, `npm test` and the full `npm run test:e2e`; fix what fails
- [ ] T024 Walk through [quickstart.md](quickstart.md) by hand, including keyboard, screen reader, without JavaScript, 320 px, 200% zoom and dark theme

---

## Dependencies and order

- **Phase 2** blocks everything (T004, T005 are what the page uses; T002, T003 pin the API).
- **US1 (Phase 3)** is the MVP. **US2** builds on the same row form; T014 (removing the old page) waits for US2 since until then it's the only way to change a filled detail.
- **US3** and **US4** each extend US1 and can go in either order.
- **Phase 7** after US2. **Polish** last.

## Parallel examples

- Phase 2: T002 and T003 together, alongside T004 then T005 (T005 uses T004's `DetailKey`).
- US1: T006 and T007 together before T008–T010.
- Phase 7: T019, T020, T021, T022 together.

## Implementation strategy

1. Foundation, then US1: fill in empty details in place. Stop and check.
2. US2, then remove the old page.
3. US3 and US4.
4. Old words, polish, walk through the quickstart.
