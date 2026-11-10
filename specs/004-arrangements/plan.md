# Implementation Plan: Arrangements

**Branch**: `004-arrangements` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-arrangements/spec.md`

## Summary

Give each exchange one place from the first ask to its end. The "Proposals" and "Agreements" lists
and pages become one "Arrangements" list (grouped as Needs you / In progress / Finished) and one
arrangement page with a stage, a timeline, the details, the actions, and the messages. The rules of
002 and 003 don't change; two small behaviours are new: asking again after an arrangement ended
reopens the same one, and an agreed gift, trade or service can be marked as done (and un-marked).

Technical approach ([research.md](research.md)): the `proposal` and `agreement` tables become one
`arrangement` table whose details are fixed once `status = agreed`; conversations, requests for
help and requests point at it. Stage, "needs me" and the timeline are worked out by the API on
read (the timeline from the notes the API already writes into the conversation). The API's
proposal and agreement endpoints are replaced by `/arrangements…`; the web app's `/proposals…` and
`/agreements…` routes by `/arrangements…`. Nothing old is kept or migrated: the single initial
migration is regenerated.

## Technical Context

**Language/Version**: TypeScript 6 (strict) on Node.js 24 LTS; Svelte 5 (unchanged)

**Primary Dependencies**: Unchanged (Hono, Zod OpenAPI, Drizzle, postgres.js, Better Auth, SvelteKit
3, Tailwind CSS v4, Bits UI, Lucide). **No new dependency.**

**Storage**: PostgreSQL 17+. New table `arrangement` (replaces `proposal`, `agreement`);
`proposal_offer` → `arrangement_offer`; foreign keys renamed on `conversation`, `problem_report`,
`request`; four new `message_kind` values ([data-model.md](data-model.md)). The loan exclusion
constraint is rewritten by hand in the regenerated `drizzle/0000_initial.sql`.

**Testing**: Vitest (API modules and routes against the test database, including the OpenAPI
contract test, which now also reads 004's `contracts/api.md`); Playwright per user story with axe
scans in both themes; `stay-put.spec.ts` for every in-place action; tsc, svelte-check, ESLint.

**Target Platform**: Unchanged: Docker Compose self-hosting; modern browsers; API for future clients

**Project Type**: Web service (REST API) + web application in one npm-workspaces repository

**Performance Goals**: The Arrangements list within 2 s for a member with 200 arrangements
(SC-007): one query per group on indexed columns, issues computed only for open ones, Finished
paged by 20. The arrangement page in the same time as today's proposal page.

**Constraints**: All 001 to 003 constraints hold: every page works without JavaScript except the
details form (002 research §10); WCAG 2.2 AA; one filled button per screen; actions keep the page
where it was; no personal data in logs. Fixed-once-agreed must hold at the service layer and be
backed by database checks. No backward compatibility for links, API, schema or export.

**Scale/Scope**: 4 user stories; 11 arrangement endpoints replacing 11 proposal and agreement
endpoints, 8 changed elsewhere ([contracts/api.md](contracts/api.md)); 5 web routes replacing 6
([contracts/pages.md](contracts/pages.md)); 1 new table replacing 2; 2 API modules merged into 1;
about 10 browser specs and 6 API test files updated or renamed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.2.0.

| Principle | Gate | Status |
|-----------|------|--------|
| I. People Over Extraction | No engagement mechanics; export stays complete | ✅ Pass. "Needs you" lists only things the member can actually do; "Mark as done" is optional, never reminded, counted or nudged (FR-009a) and sends no notification. No new data is collected beyond `doneAt` / `doneById`. Export gains an `arrangements` section covering everything `proposals` and `agreements` did |
| II. Simple, Intuitive Workflows | One primary action per page; core workflows not made harder | ✅ Pass. One list and one page replace two of each; the navigation loses a link. The arrangement page has exactly one filled button per stage and role (pages contract table). Decline and Withdraw keep their confirmation; "Mark as done" needs none because "Not done yet" undoes it. Asking is unchanged |
| III. Security First | Authorization on every endpoint; validated input; review | ✅ Pass. Access is requester and lister, plus helpers read-only and only once agreed (FR-021, FR-021a); everyone else gets `404`. The timeline never carries note text, so helpers learn nothing from it that they couldn't see before. Details are immutable once agreed (service rule + checks). Inputs reuse the 002 Zod schemas. Security review checkpoints: helper access to `GET /arrangements/{id}` and the shared conversation; reopen (only the same requester, only when ended); `done` / `not-done` authorization; export |
| IV. Accessible (WCAG 2.2 AA) | New widgets accessible | ✅ Pass. The timeline is an ordered list of text lines (markers decorative); the filter is links with `aria-current`; stage is words plus a text badge; the header count is read as words. axe scans in both themes for the list (each group, empty, filtered) and the page at each stage and role |
| V. Calm Design | No urgency; nothing shifts | ✅ Pass. No "late" or "overdue" labels ("It was due back …"). Every action uses `stayPut` with its result beside the button; confirmations use `reveal`; the page address never changes on accept, so there is no navigation jump. "Show more" adds below. The current filter and stage never change weight or size. No new notifications |
| VI. Readable, Simple Code | One module per area; honest names | ✅ Pass. `modules/arrangements.ts` replaces `proposals.ts` + `agreements.ts`; stage and needs-me are two small pure functions with unit tests; names say "arrangement" throughout rather than "proposal" for something agreed long ago (research §1). The mediator hooks between `agreements.ts` and `reports.ts` (`setMediatorCheck`, `setReportsLookup`) are kept, renamed |
| VII. No Unnecessary Dependencies | No new package without approval | ✅ Pass. None |

**Post-design re-check (after Phase 1)**: Unchanged. The contracts give every stage of the page one
filled action; the data model stores facts only (no stage, score, or reminder fields for "done");
helpers get no endpoint beyond the read they have today; the list endpoint never returns
arrangements a member only helps with.

## Project Structure

### Documentation (this feature)

```text
specs/004-arrangements/
├── plan.md              # This file
├── research.md          # Phase 0: decisions
├── data-model.md        # Phase 1: the arrangement table and what points at it
├── quickstart.md        # Phase 1: how to validate
├── contracts/
│   ├── api.md           # Endpoints replaced, changed, removed
│   ├── pages.md         # Routes, the arrangement page, stage words
│   └── notifications.md # Links and words only
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
packages/shared/src/
├── schemas/arrangements.ts        # NEW: replaces proposals.ts and agreements.ts
├── schemas/{offerings,requests,messaging,reports,me}.ts   # renamed fields, new message kinds, summary count
└── index.ts

apps/api/
├── drizzle/0000_initial.sql       # regenerated; loan exclusion constraint rewritten by hand
├── scripts/seed-demo.ts           # arrangements at every stage
└── src/
    ├── db/schema/
    │   ├── arrangements.ts        # NEW: replaces proposals.ts and agreements.ts
    │   ├── messaging.ts           # conversation.arrangementId; message kinds asked, returned, done, not_done
    │   ├── reports.ts             # arrangementId; messagesSharedAt / ById
    │   └── requests.ts            # closedByArrangementId
    ├── modules/
    │   ├── arrangements.ts        # NEW: ask / ask again, change, accept, decline, withdraw, returned,
    │   │                          #   done / not done, get, list, close quiet, needs-me count
    │   ├── arrangement-stage.ts   # NEW: stageOf(), needsMe(), timelineOf() (pure, unit-tested)
    │   ├── arrangement-issues.ts  # the 002 issue rules, moved out of proposals.ts unchanged
    │   ├── reports.ts, requests.ts, offerings.ts, messaging.ts, reminders.ts, members.ts, export.ts
    │   │                          #   point at arrangement; same rules
    │   └── (proposals.ts, agreements.ts removed)
    ├── routes/
    │   ├── arrangements.ts        # NEW: replaces proposals.ts and agreements.ts
    │   └── reports.ts, me.ts, conversations.ts, offerings.ts, requests.ts   # renamed fields
    └── (tests alongside: arrangements.test.ts for modules and routes; arrangement-stage.test.ts;
         earlier-loan, reminders, request-closing, reports, conversations, me-settings, offerings,
         requests updated; openapi.test.ts reads 004 too)

apps/web/src/
├── lib/
│   ├── arrangement-thread.ts      # renamed from proposal-thread.ts
│   ├── format.ts                  # stageWords(), sideWords()
│   ├── help/Arrangements.svelte   # replaces Proposals.svelte and Agreements.svelte
│   └── components/
│       ├── ArrangementCard.svelte       # NEW
│       ├── Timeline.svelte              # NEW
│       ├── ArrangementDetails.svelte    # from ProposalDetails; adds "What was agreed"
│       ├── ArrangementFields.svelte     # renamed from ProposalFields
│       └── ArrangementMessages.svelte   # renamed from ProposalMessages
├── routes/
│   ├── +layout.svelte, +layout.server.ts   # one "Arrangements" link and count
│   ├── arrangements/+page.{server.ts,svelte}          # NEW: the list
│   ├── arrangements/more/+server.ts                   # NEW: next finished page
│   ├── arrangements/[id]/+page.{server.ts,svelte}     # NEW: the page
│   ├── arrangements/[id]/edit/, arrangements/[id]/report/   # moved from proposals/, agreements/
│   ├── offerings/[id]/propose/, offerings/[id]/, requests/[id]/, reports/[id]/, threads/[id]/
│   │                                                   # links and field names
│   └── (proposals/, agreements/ removed)
└── tests/e2e/
    ├── arrangements-us1-list.spec.ts        # NEW
    ├── arrangements-us2-page.spec.ts        # NEW: stages, timeline, done, ask again, helper
    ├── arrangements-us3-links.spec.ts       # NEW
    ├── proposals-us*.spec.ts, requests-us4-agree, us6-problem, stay-put, accessibility,
    │   helpers/members.ts                    # updated to the new routes and API
    └── (no spec left pointing at /proposals or /agreements)

specs/002-listing-proposals/contracts/api.md, specs/003-member-requests/contracts/api.md
                                             # rows for removed endpoints taken out
docs/security-review.md                      # 004 section
```

**Structure Decision**: Same two apps and shared package. The two API modules that held one
exchange between them become one, with the pure "what stage is this" logic in its own small file
so it can be tested without a database. Web components are renamed rather than wrapped, so no file
is left calling an agreed arrangement a "proposal".

## Order of work (for /speckit-tasks)

1. **Foundation** (blocks everything): shared schemas; database schema and regenerated migration;
   `arrangements.ts` module with the 002 rules moved over and their tests renamed and passing;
   routes; everything that pointed at proposals or agreements re-pointed (reports, requests,
   offerings, messaging, reminders, members, export); older contracts trimmed. At this point the
   API is complete for the old behaviour under the new names.
2. **Story 2 groundwork in the API**: stage, timeline, ask again, done / not done, helper read.
3. **Story 1** (list): list endpoint with groups and needs-me, summary count, list page, header.
4. **Story 2** (page): the arrangement page at every stage and role; edit and report sub-pages.
5. **Story 3** (links): notification links and words; offering, request and report pages; old
   routes removed.
6. **Story 4** (words and help): help topic, titles, settings descriptions.
7. **Polish**: demo seed, export, security review, quickstart walk-through, performance check.

## Complexity Tracking

No constitution violations to justify.
