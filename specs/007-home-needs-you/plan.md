# Implementation Plan: A home page of what needs you

**Branch**: `007-home-needs-you` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/007-home-needs-you/spec.md`

## Summary

Signed-in members land on a new Home page (`/`) headed "Waiting on you", listing in up to four
groups only what needs them: arrangements waiting on them (the existing `needsMe` rule), loans due
back within 2 days or late, new offers on their open requests, and requests to change their things.
One new API call (`GET /me/home`) works the groups out; one more (`POST /me/home/pressed`) records
that a line for offers or flags was pressed, so those lines stay until pressed on Home. Two
nullable timestamp columns hold that. The header gains "Home" first, and the wunan name goes Home.

## Technical Context

**Language/Version**: TypeScript 5, Node 24
**Primary Dependencies**: SvelteKit 3 / Svelte 5 (web), Hono + Zod OpenAPI (API), Drizzle
**Storage**: PostgreSQL 17; two new nullable columns (`request_link.home_pressed_at`,
`flag.home_pressed_at`); the single initial migration is regenerated, as in 004 and 005
**Testing**: Vitest (API), Playwright + axe (web)
**Target Platform**: Web, server-rendered, works without JavaScript
**Project Type**: Web application (`apps/api`, `apps/web`, `packages/shared`)
**Performance Goals**: Home loads as fast as Arrangements today: one API call, a handful of queries
**Constraints**: No filled button on Home; nothing moves by itself; WCAG 2.2 AA; no new dependencies
**Scale/Scope**: One new page, one header change, two API endpoints, two columns

## Constitution Check

| Principle | Check | Result |
|-----------|-------|--------|
| I. People over extraction | Only what needs the member; no suggestions, activity feeds or counts meant to hold attention; empty state is one line. Two timestamps stored, only to keep lines until pressed | ✅ |
| II. Simple workflows | One page answers "does anything need me?"; each line one press to where to act; no filled button (the action is choosing a line) | ✅ |
| III. Security first | Every line is the caller's own: queries filter by member id; `pressed` only marks the caller's own links and flags (else `404`) | ✅ |
| IV. Accessible | `h1` "Waiting on you", `h2` per group, lists as `ul`, lines as links with words, weekday and date in text, 320 px, both themes, axe scans | ✅ |
| V. Calm, stays put | No live updates on Home; "See all" adds the rest below the first 5 (`?all=` + `data-sveltekit-reset="false"` + `#group` fallback); header link marked current with the existing pill | ✅ |
| VI. Readable code | One module `home.ts` in the API, reusing `summarise`/`needsMe`; one page and one small line component on the web | ✅ |
| VII. No new dependencies | None | ✅ |

Re-checked after design: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-home-needs-you/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
├── contracts/pages.md
└── tasks.md            # /speckit-tasks
```

### Source Code

```text
packages/shared/src/schemas/home.ts          # NEW: Home, HomeLine shapes, HomePressed body
apps/api/src/
├── db/schema/requests.ts                    # request_link + homePressedAt
├── db/schema/flags.ts                       # flag + homePressedAt
├── lib/time.ts                              # + startOfLocalDay(instant, plusDays)
├── modules/arrangements.ts                  # + homeArrangements(memberId, dueBefore)
├── modules/home.ts                          # NEW: homeFor(memberId, now), markPressed(...)
├── modules/home.test.ts                     # NEW: due-back window, grouping, dedupe, order
├── routes/me.ts                             # + GET /me/home, POST /me/home/pressed
├── routes/home.test.ts                      # NEW: endpoint behaviour and access
└── openapi.test.ts                          # + 007 in the contracts read
apps/api/drizzle/0000_initial.sql            # the two columns added by hand (the file has hand-written parts)
apps/web/src/
├── lib/format.ts                            # + dueDay and the words for each kind of Home line
├── routes/+page.server.ts                   # signed in → load Home; signed out → as today
├── routes/+page.svelte                      # NEW: Home
├── routes/home/go/+server.ts                # NEW: GET → mark pressed via API → 303 to the target
├── routes/+layout.svelte                    # "Home" first; wunan name → "/"; isCurrent('/') exact
├── lib/components/HomeLine.svelte           # NEW: one line (link + words)
└── lib/help/Home.svelte                     # NEW (short), linked from the page heading
apps/web/tests/e2e/
├── home.spec.ts                             # NEW
├── stay-put.spec.ts                         # + "See all" keeps the page still
└── (specs that assume landing on Offerings after sign-in updated)
```

**Structure Decision**: Existing monorepo layout. The API decides what needs a member (so a future
app gets the same Home); the web only shows it.

## Complexity Tracking

None.
