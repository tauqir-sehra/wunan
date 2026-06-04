# Implementation Plan: Community Resource Sharing

**Branch**: `001-community-resource-sharing` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-community-resource-sharing/spec.md`

## Summary

Build wunan's first version: an invite-only, single-community app where members list things to
lend, give, trade, or offer as services (Lend, Gift, Trade, Service); search what's available;
message each other (with live updates in an open conversation); record agreements, including
remaining amounts, sessions, and loan returns; and ask their invite chain for help when something
goes wrong, with no removal, punishment, or blocking.

Architecture: a **standalone backend API** (Hono + TypeScript + PostgreSQL) that holds all data and
rules and exposes a versioned, documented JSON API, and a **SvelteKit web app** that is its first
client, using only that API. A future Android app can use the same API. Both live in one repository
with shared Zod schemas, and are self-hosted per community with Docker Compose. See
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict) on Node.js 24 LTS (the API runs `.ts` directly with Node's built-in type stripping); Svelte 5

**Primary Dependencies**: API: Hono (+ Node server, Zod OpenAPI), Drizzle ORM + postgres.js,
Better Auth (bearer tokens), Zod, sharp, nodemailer, web-push, fflate. Web: SvelteKit 3
(adapter-node), Tailwind CSS v4, shadcn-svelte components on Bits UI, Lucide, self-hosted Inter.
Approved by the project owner on 2026-06-03 (constitution VII); see
[research.md](research.md#dependency-summary-for-maintainer-approval-constitution-vii).

**Storage**: PostgreSQL 17+ (full-text search, LISTEN/NOTIFY), accessed only by the API; photos on a
disk volume owned by the API

**Testing**: Vitest (API contract and integration tests against a test database), Playwright
end-to-end per user story with axe scans in light and dark themes, tsc, svelte-check, ESLint

**Target Platform**: Self-hosted Linux server via Docker Compose (api, web, postgres, caddy); modern
browsers on phones and computers; installable web app; API ready for future native clients

**Project Type**: Web service (REST API) + web application, in one npm-workspaces repository

**Performance Goals**: Search results under 2 s for 5,000 members / 20,000 listings (SC-006); new
messages appear in an open conversation within 2 s

**Constraints**: The web app uses only public API endpoints (no direct database access); every web
flow works without JavaScript (live messages and device notifications excepted); no third-party
services or tracking; WCAG 2.2 AA in light and dark themes; calm design; sleek, minimal visual style;
English only

**Scale/Scope**: One community per installation, up to ~5,000 members; ~50 API endpoints
([contracts/api.md](contracts/api.md)); ~25 web routes ([contracts/pages.md](contracts/pages.md))

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.1.0.

| Principle | Gate | Status |
|-----------|------|--------|
| I. People Over Extraction | No ads, tracking, engagement metrics, or payment processing; no third-party push, font, or storage services; export and account deletion (FR-030, FR-032, FR-033) | ✅ Pass. Future Android push to prefer UnifiedPush over Firebase (research §10) |
| II. Simple, Intuitive Workflows | One primary action per page; plain-language errors (written once in the API, shown by every client); confirm destructive actions; only type + title required for a listing | ✅ Pass |
| III. Security First | Maintained auth library with bearer tokens; invite-only account creation; rate limits on sign-in, messages, invitations, flags; Zod validation on every API input; API has no cookies or CORS; web keeps the token in an HttpOnly cookie and uses CSP and origin checks; members-only photos with metadata stripped; hashed invite tokens; no personal data in logs; browser never calls the API directly | ✅ Pass. Research §6, §8, §14. Security review required before merge for: auth and invitation accept, bearer handling in web, photo upload, contact sharing, live stream, push subscriptions (checkpoint in each phase that touches them, plus a final review) |
| IV. Accessible (WCAG 2.2 AA) | Native controls preferred; Bits UI for complex widgets; contrast-checked tokens in both themes; visible focus; 44 px targets; alt text; polite live region; automated axe + manual audit | ✅ Pass |
| V. Calm Design | No autoplay, sound, or component animations; neutral palette; live updates only inside an open conversation; email and device notifications off by default, never auto-prompted, silent, rate-limited | ✅ Pass |
| VI. Readable, Simple Code | Business rules in one plain module per area in the API; thin route handlers; no repository/service layers over Drizzle; web routes only call the API and render; shared schemas instead of duplicated types | ⚠️ **Justified added complexity**: a second application and an HTTP boundary. See Complexity Tracking |
| VII. No Unnecessary Dependencies | Each dependency justified and approved in advance | ✅ Pass. Runtime and development lists in research.md approved by the project owner on 2026-06-03; any addition needs a new approval |

**Post-design re-check (after Phase 1)**: Unchanged. The API contract covers everything the web
pages need, so no page requires a private shortcut; the data model has no removal, penalty, or
blocking fields (FR-021, FR-029b). Gate VII approved 2026-06-03.

## Project Structure

### Documentation (this feature)

```text
specs/001-community-resource-sharing/
├── plan.md              # This file
├── research.md          # Phase 0: technical decisions
├── data-model.md        # Phase 1: tables, rules, states
├── quickstart.md        # Phase 1: how to run and validate
├── contracts/
│   ├── api.md           # Backend API v1 (human summary of the generated OpenAPI)
│   ├── pages.md         # Web app routes and form actions
│   ├── notifications.md # Email + device notification rules
│   └── export-format.md # Personal data export ZIP
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
package.json                      # npm workspaces: apps/*, packages/*
compose.yaml, compose.dev.yaml, Caddyfile, .env.example
docs/operator.md                  # Setup, environment, founders, backups, updates

packages/shared/
└── src/
    ├── schemas/                  # Zod schemas per area: listings, messages, agreements, ...
    └── index.ts                  # Exported types for API requests and responses

apps/api/
├── Dockerfile, drizzle.config.ts
├── drizzle/                      # Generated SQL migrations (committed)
├── scripts/                      # create-founder.ts, seed-demo.ts (dev only)
└── src/
    ├── index.ts                  # Starts the server and the hourly jobs (expired holds, reminders)
    ├── app.ts                    # Hono app: middleware, route mounting, OpenAPI document
    ├── auth.ts                   # Better Auth config: bearer plugin, public sign-up disabled
    ├── db/schema/, db/index.ts   # Tables, one file per area
    ├── routes/                   # Thin handlers, one file per area (match contracts/api.md)
    │   ├── invitations.ts, members.ts, me.ts, listings.ts, photos.ts
    │   └── conversations.ts, agreements.ts, reports.ts
    ├── modules/                  # Business rules, one plain module per area
    │   ├── invitations.ts, members.ts, listings.ts, search.ts, photos.ts
    │   └── messaging.ts, live.ts, agreements.ts, reports.ts, export.ts, reminders.ts
    ├── notify/                   # index.ts (rules), email.ts, push.ts
    └── lib/                      # errors.ts (plain-language errors), rate-limit.ts, crypto.ts
    # Tests sit next to the code: modules/*.test.ts, routes/*.test.ts

apps/web/
├── Dockerfile, vite.config.ts (SvelteKit 3 config lives here), components.json
├── static/                       # manifest.webmanifest, icons
├── tests/e2e/                    # Playwright specs, one per user story
└── src/
    ├── app.html, app.css         # Tailwind entry, theme tokens (light/dark), Inter font
    ├── hooks.server.ts           # Reads session cookie, security headers
    ├── service-worker.ts         # Installability + showing device notifications
    ├── lib/
    │   ├── api.ts                # Small typed fetch wrapper: adds bearer token, maps API errors
    │   ├── components/ui/        # shadcn-svelte components (copied source, animations removed)
    │   ├── components/*.svelte   # Steps, PhotoPicker, MessageList, ListingCard
    │   └── utils.ts              # cn() class helper
    └── routes/                   # One folder per route in contracts/pages.md
                                  # incl. routes/help/: member help pages (constitution VI)
```

**Structure Decision**: Two apps and one shared package in a single repository. `apps/api` owns
data and rules; `apps/web` is a client that only renders pages and calls the API. Inside the API,
route files stay thin (validate, call a module, return) and each module maps to a section of the
spec, so a contributor can understand a feature by reading one route file and one module.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Separate backend app with an HTTP boundary to the web app (VI) | Project owner requires a backend that future clients such as an Android app can use | API endpoints inside the SvelteKit app would let page code reach the database directly, so the API would drift from what the web app actually does and an Android app would hit gaps |
| Shared schema package | Keeps API validation, OpenAPI docs, and web types identical | Copying types between apps would drift and duplicate validation rules |
