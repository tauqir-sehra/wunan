# Implementation Plan: Requests for Things

**Branch**: `003-member-requests` | **Date**: 2026-06-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-member-requests/spec.md`

## Summary

Members can **ask** for something (Borrow, Receive, Trade, Service) with optional details: when it's
needed ("Needed after" / "Needed by"), area, handover, and per-kind amounts and lengths. While they
type, up to 5 existing listings that might already answer it are suggested. Other members answer by
posting a listing prefilled from the request, or by linking one they already have; the asker may
link a listing too. Linked listings are ordinary listings open to everyone. When the asker's
proposal on a linked listing is accepted, the request closes automatically. Requests are browsed on
their own **Requests** page. Every request and every listing gets a **public thread** of short
messages (≤240 characters) that all members can read and post in; only authors can remove their own.

Approach: keep the 001/002 architecture (API owns rules; web only renders). Add a `requests` module
(requests, links, suggestions, closing), a `public-messages` module, and small hooks in `listings`,
`proposals` (tie and close in the accept transaction), flags, notifications, export, and account
deletion. Public threads update live through the existing LISTEN/NOTIFY stream machinery. Nothing is
kept: the single initial migration is regenerated. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict) on Node.js 24 LTS; Svelte 5 (unchanged)

**Primary Dependencies**: Unchanged from 002 (Hono, Drizzle, Better Auth, Zod, SvelteKit 3, Bits UI,
Tailwind v4). No new npm packages; no new outside services (place suggestions reuse 002's Photon
proxy)

**Storage**: PostgreSQL 17+. New tables `request`, `request_give_back`, `request_availability`,
`request_link`, `public_message`; `listing_flag` generalised to `flag`; `proposal.request_id`;
`notification_log.subject_id`; two notification types ([data-model.md](data-model.md)). Single
`0000_initial.sql` regenerated; database rebuilt with `db:reset` (no data kept)

**Testing**: Vitest (API modules and routes against the test database), Playwright per user story
with axe in both themes, tsc, svelte-check, ESLint. The OpenAPI test reads both the 002 and the 003
contracts

**Target Platform**: Unchanged: Docker Compose self-hosting; modern browsers; API for future clients

**Project Type**: Web service (REST API) + web application in one npm-workspaces repository

**Performance Goals**: Suggestions shown within 2 s of typing (SC-004) at 20,000 listings, using the
existing indexed listing search; requests search under 2 s at 20,000 requests (GIN index, as Find)

**Constraints**: All 001/002 constraints hold. The request form needs JavaScript like the listing and
proposal forms (research §11); every other new page works without it. Request areas follow 002 place
privacy. Public messages are plain text, encoded on output

**Scale/Scope**: 7 user stories; ~17 new or changed API endpoints ([contracts/api.md](contracts/api.md));
~7 new and 3 changed pages ([contracts/pages.md](contracts/pages.md)); 2 notification types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.1.0.

| Principle | Gate | Status |
|-----------|------|--------|
| I. People Over Extraction | No engagement mechanics; export covers new data | ✅ Pass. Public threads have no likes, reactions, or counts beyond "2 offers"; requests never expire to nudge activity. Both new notification types are off by default and rate-capped (one per thread per day). Export gains `requests.json` and `public_messages.json` |
| II. Simple, Intuitive Workflows | One primary action per page; no added complexity to core workflows without justification | ✅ Pass, justified: posting a request needs only kind + title (SC-001). Answering reuses the listing form, prefilled (SC-002). The proposal and listing flows are unchanged for anyone not using requests; the only additions to existing pages are a "Fulfills…" line and the public thread. Both header buttons are outlined; closing a request asks for confirmation and can be undone (reopen); links can be removed |
| III. Security First | Authorization on every new endpoint; validated input; output encoding; review | ✅ Pass. Asker-only edit/close/reopen; link only own listings (or as asker) of the matching type; author-only message removal; plain-text messages ≤240 characters, encoded by Svelte; request areas through `viewPlace()`; proposal `requestId` checked against the caller's own open, linked requests; public messages share the existing message rate limit as a backstop. Security review checkpoints: public thread posting and removal, link authorization, request-close in the accept transaction, deletion and export |
| IV. Accessible (WCAG 2.2 AA) | New widgets accessible | ✅ Pass. Suggestions and the character counter announced in polite live regions (counter only at 20 and 0 left); pop-ups reuse `PopupDialog` with no-JS pages; give-back rows reuse `RepeatingRows`; axe scans in both themes per story |
| V. Calm Design | No urgency; infrequent notifications | ✅ Pass. "The date has passed" is shown only to the asker, as information. Notices are opt-in and capped. Live public messages arrive quietly in place (no sound, no motion, polite announcement); no unread badges for them |
| VI. Readable, Simple Code | One module per area; thin routes | ✅ Pass. `modules/requests.ts`, `modules/public-messages.ts`; public threads deliberately not built on private conversations (research §7) |
| VII. No Unnecessary Dependencies | No new package without approval | ✅ Pass. None |

**Post-design re-check (after Phase 1)**: Unchanged. The contracts give every new page one filled
primary action; the data model adds no ranking, penalty, or engagement fields; others never see more
of a request's place than neighbourhood and city.

## Project Structure

### Documentation (this feature)

```text
specs/003-member-requests/
├── plan.md              # This file
├── research.md          # Phase 0: decisions
├── data-model.md        # Phase 1: new tables, changes, request states
├── quickstart.md        # Phase 1: how to validate
├── contracts/
│   ├── api.md           # New and changed API v1 endpoints
│   ├── pages.md         # New and changed web routes
│   └── notifications.md # Two new notification types
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Only files added or changed:

```text
packages/shared/src/schemas/
├── requests.ts                     # new: request create/update unions per kind, request + link shapes, kind ↔ type map
├── public-messages.ts              # new: post body (1–240), message + thread shapes
├── listings.ts                     # forRequest on create; answers / answersRequest on read
├── proposals.ts                    # requestId on create; request on read
└── settings.ts                     # notification types + request, public_message

apps/api/
├── drizzle/0000_initial.sql        # regenerated (hand edits re-applied as in 002)
├── scripts/seed-demo.ts            # a few requests, links, and public messages
└── src/
    ├── db/schema/
    │   ├── requests.ts             # new: request, request_give_back, request_availability, request_link
    │   ├── public-messages.ts      # new: public_message
    │   ├── listings.ts             # listing_flag → flag (listing | request | public message)
    │   ├── proposals.ts            # + request_id
    │   └── notifications.ts        # + types, notification_log.subject_id
    ├── modules/
    │   ├── requests.ts             # new: create, update, close, reopen, get, list, search, suggestions, links, closeForAgreement
    │   ├── public-messages.ts      # new: list, post, remove, notify, NOTIFY for live
    │   ├── live.ts                 # channel key generalised (conversation or public thread)
    │   ├── listings.ts             # forRequest link on create; answers on describe; flags generalised
    │   ├── proposals.ts            # tie to request on create; close request inside accept transaction
    │   ├── export.ts               # requests.json, public_messages.json
    │   └── members.ts              # deletion closes requests, deletes public messages
    ├── routes/
    │   ├── requests.ts             # new
    │   ├── public-messages.ts      # new (thread endpoints and live streams for requests and listings, removal, flags)
    │   ├── listings.ts, proposals.ts   # new fields
    │   └── me.ts                   # summary adds unseenRequestFlags
    └── openapi.test.ts             # reads both 002 and 003 contracts

apps/web/src/
├── lib/components/
│   ├── RequestFields.svelte        # new: per-kind request form
│   ├── RequestCard.svelte          # new
│   ├── RequestSuggestions.svelte   # new: "These might already have what you need"
│   ├── PublicThread.svelte         # new: messages, counter, remove, raise an issue
│   └── ListingCard.svelte          # "Fulfills <asker>'s request"
├── lib/request-form.ts             # new: form ↔ API body; request → listing and proposal prefill
├── lib/format.ts                   # neededText(), request kind labels
├── lib/help/Requests.svelte        # new help topic
└── routes/
    ├── +layout.svelte              # Requests link; "Request something" and "Offer something" (outlined)
    ├── requests/                   # new: list, more, new, [id], [id]/edit, [id]/link, [id]/issue, [id]/messages/live
    ├── listings/[id]/messages/live/ # new: stream pass-through
    ├── public-messages/[id]/issue/ # new: no-JS page
    ├── listings/new/               # ?forRequest prefill and link
    ├── listings/[id]/              # Fulfills line, public thread, "Link to my request", request choice for the proposal
    ├── listings/[id]/propose/      # ?request prefill and tie
    └── settings/notifications/     # two new types
apps/web/tests/e2e/                 # requests-us1 … us7 specs; accessibility spec covers new pages
```

**Structure Decision**: Same two apps and shared package. Requests and public threads each get one
API module with a thin route file, so the whole request workflow can be read in one place. Listings
and proposals change only at well-named hooks (link on create, tie on propose, close on accept).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| A second kind of thread (public) beside private conversations (VI) | Clarification 3: public threads on requests and listings | Reusing `conversation` would weaken the participant checks that keep proposal messages private (research §7) |
| Request form needs JavaScript (II, 001 rule) | It shares the listing form's place field and repeating rows (owner decision for those forms, 2026-06-05) | Plain fields would lose place suggestions and "Add another"; flagged for the owner in research §11 |
