# Implementation Plan: Proposals for Listings

**Branch**: `002-listing-proposals` | **Date**: 2026-06-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-listing-proposals/spec.md`

## Summary

Replace "message, then the owner records an agreement, then the other member confirms" with
**proposals**. A member makes a proposal on a listing (borrow, receive a gift, trade, receive a
service) holding when, how, where, and how much; every detail is optional until the lister accepts.
Only the requester edits the details, which are what they have agreed to; the lister accepts a
complete proposal at any time and it becomes the agreement. The proposal page holds the details and
the proposal's message thread. Listings gain handover options, meeting places, several things
accepted in a trade, and weekly service times. Loans become periods with an overlap guarantee.
Place fields get suggestions from an operator-chosen Photon server, called only by the API.

Approach: keep the 001 architecture (API owns rules; web only renders). Add a `proposals` module
whose `proposalIssues()` decides what blocks acceptance, a `places` module for suggestions and the
privacy view of places, and reuse 001's conversation/message machinery as each proposal's thread.
Data is not kept: one regenerated migration. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict) on Node.js 24 LTS; Svelte 5 (unchanged from 001)

**Primary Dependencies**: Unchanged from 001 (Hono, Drizzle, Better Auth, Zod, SvelteKit 3, Bits UI,
Tailwind v4, …). No new npm packages. New: PostgreSQL's bundled `btree_gist` extension; outside
Photon place-search service over `fetch` (research §1)

**Storage**: PostgreSQL 17+. New tables `proposal`, `proposal_offer`, `trade_accept`,
`service_availability`; changes to `listing`, `agreement`, `conversation`, `message`,
`problem_report` ([data-model.md](data-model.md)). Migrations regenerated as one initial file

**Testing**: Vitest (API module and route tests against the test database), Playwright per user
story with axe in both themes, tsc, svelte-check, ESLint. Photon is replaced by a local stub server
in tests

**Target Platform**: Unchanged: Docker Compose self-hosting; modern browsers; API for future clients

**Project Type**: Web service (REST API) + web application in one npm-workspaces repository

**Performance Goals**: Place suggestions within 1 s for 95% of lookups (SC-005; 2 s timeout, 10-min
cache); search stays under 2 s at 5,000 members / 20,000 listings (001 SC-006) with the derived
lent-out condition

**Constraints**: All 001 constraints hold. Only typed text reaches the place service, from the
server. The listing and proposal forms need JavaScript (owner decision, 2026-06-05; research §10);
all other pages still work without it

**Scale/Scope**: 7 user stories; ~10 new or changed API endpoints, 7 removed
([contracts/api.md](contracts/api.md)); ~6 new or changed pages, 6 removed
([contracts/pages.md](contracts/pages.md))

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.1.0.

| Principle | Gate | Status |
|-----------|------|--------|
| I. People Over Extraction | No tracking or data collection beyond need; export covers new data | ✅ Pass. The place service receives only typed text from the server, never member identity or IP; the operator guide says so; it can be self-hosted or turned off. Export gains `proposals.json` |
| II. Simple, Intuitive Workflows | One primary action per page; plain errors; new features don't add complexity to core workflows without justification | ✅ Pass, justified: a listing still needs only type + title (all new fields optional); a proposal can be sent with nothing filled in (SC-001: 2 actions). It replaces two pages (messages, record agreement) with one, and removes the confirm/dispute step. Issues are listed in plain words |
| III. Security First | Authorization on every new endpoint; validated input; privacy of places; review before merge | ✅ Pass. Requester-only edits, lister-only accept/decline, `viewPlace()` in one place, version check against concurrent edits, exclusion constraint for loans, rate-limited place lookups, server-side outside calls with timeout. Security review checkpoints: places proxy, place visibility, proposal authorization, report message sharing |
| IV. Accessible (WCAG 2.2 AA) | New widgets accessible | ✅ Pass. Place field uses Bits UI Combobox (ARIA combobox); repeating rows with focus management and polite announcements; issues tied to fields with `aria-describedby`; axe scans in both themes per story |
| V. Calm Design | No urgency; quiet live updates; notifications within existing types | ✅ Pass. No new notification types; one per thread per hour; quiet close after 30 days is announced plainly, not as a warning countdown |
| VI. Readable, Simple Code | One module per area; thin routes | ✅ Pass. `modules/proposals.ts` (rules + `proposalIssues`), `modules/places.ts`; threads reuse `messaging.ts` |
| VII. No Unnecessary Dependencies | No new package without approval | ✅ Pass. No new npm packages. The outside place service was approved by the project owner in clarification (2026-06-05) |

**Post-design re-check (after Phase 1)**: Unchanged. The contract covers every page; the data model
adds no removal, penalty, blocking, or ranking fields; places shown to others never include more than
neighbourhood and city before acceptance.

## Project Structure

### Documentation (this feature)

```text
specs/002-listing-proposals/
├── plan.md              # This file
├── research.md          # Phase 0: decisions
├── data-model.md        # Phase 1: table changes, proposal states, issues
├── quickstart.md        # Phase 1: how to validate
├── contracts/
│   ├── api.md           # Full API v1 contract after this feature (replaces 001's)
│   ├── pages.md         # Changed and removed web routes
│   └── notifications.md # Changed notification rows
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Only files added, changed, or removed:

```text
.env.example                        # + PLACES_URL, PLACES_BIAS, PLACES_BBOX
docs/operator.md                    # + Place suggestions: what is sent, self-hosting Photon, turning off

packages/shared/src/schemas/
├── places.ts                       # new: placeSchema, suggestion response
├── listings.ts                     # handovers, places, accepts, availability, units, session units
├── proposals.ts                    # new: create/update unions per type, proposal + issue shapes
├── agreements.ts                   # agreement from proposal; no record/confirm bodies
└── messaging.ts                    # new message kinds; no conversation list/create

apps/api/
├── drizzle/                        # all removed; one regenerated 0000_initial.sql
├── package.json                    # + db:reset script
├── scripts/reset-db.ts             # new: drop public schema, migrate (dev only)
├── scripts/seed-demo.ts            # proposals instead of conversations/agreements
└── src/
    ├── config.ts                   # places settings
    ├── db/schema/
    │   ├── listings.ts             # changed; + trade_accept, service_availability
    │   ├── proposals.ts            # new: proposal, proposal_offer
    │   ├── agreements.ts           # changed (loan period, exclusion constraint)
    │   ├── messaging.ts            # conversation → proposal | report
    │   └── reports.ts              # + proposal message sharing
    ├── modules/
    │   ├── places.ts               # new: Photon lookup, cache, viewPlace, area match
    │   ├── proposals.ts            # new: create, update, issues, accept, decline, withdraw, close
    │   ├── listings.ts             # new fields, lent-out derived, takenPeriods, search vector
    │   ├── search.ts               # area filter on parts, derived lent-out
    │   ├── agreements.ts           # recording/confirm/cancel removed; returned + history stay
    │   ├── messaging.ts            # threads for proposals/reports; read-only rule
    │   ├── reports.ts              # share proposal messages
    │   ├── reminders.ts            # loan_ends_at; + quiet-close job
    │   ├── export.ts               # proposals.json
    │   └── members.ts              # account deletion closes open proposals
    └── routes/
        ├── places.ts               # new
        ├── proposals.ts            # new
        ├── conversations.ts        # list/create removed
        └── agreements.ts           # record/confirm/dispute/cancel removed
    # src/openapi.test.ts: reads specs/002-listing-proposals/contracts/api.md

apps/web/src/
├── lib/components/
│   ├── PlaceField.svelte           # new: combobox with plain-text fallback
│   ├── RepeatingRows.svelte        # new: add/remove rows in place
│   ├── ProposalFields.svelte       # new: per-type proposal form
│   ├── ProposalDetails.svelte      # new: details + issues block
│   ├── ListingFields.svelte        # handovers, places, accepts, availability
│   └── MessageList.svelte          # new kinds; refresh details on detail_changed
├── lib/help/                       # proposals and agreements topics rewritten
└── routes/
    ├── places/+server.ts           # new: proxy for PlaceField
    ├── listings/[id]/propose/      # new
    ├── proposals/                  # new: list, [id], [id]/edit, [id]/share-contact, [id]/live
    ├── listings/[id]/+page.*       # proposal action, new details
    ├── agreements/[id]/+page.*     # no confirm/dispute/cancel
    ├── reports/[id]/+page.*        # share proposal messages
    ├── messages/                   # removed
    └── listings/[id]/agreements/   # removed
apps/web/tests/e2e/                 # proposals specs per story; messaging/agreements specs replaced
```

**Structure Decision**: Same two apps and shared package as 001. The new behaviour sits in two new
API modules (`proposals`, `places`) with matching thin routes, so a contributor can read the whole
proposal workflow in one file. The thread mechanism is shared with problem reports rather than
duplicated.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Outside place service (I, VII) | Spec FR-027: suggestions for addresses, neighbourhoods, cities, and businesses, and area checks for services | A community-only list of places can't suggest addresses or businesses (rejected in clarification); browser-side calls would leak members' IPs |
| Database exclusion constraint with `btree_gist` (VI) | Two concurrent accepts must never create overlapping loans (FR-011a) | An application-only check is one missed path away from double-booking |
