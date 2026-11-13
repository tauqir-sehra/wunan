# Implementation Plan: Fill in missing details in place

**Branch**: `006-fill-details-in-place` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/006-fill-details-in-place/spec.md`

## Summary

On an arrangement being arranged, the requester presses a detail row ("Add when" / "Change when")
and just that field opens in the row, saves in place, and the page stays put. The separate "Change
details" page goes. The API already saves one detail at a time and already limits notices, so this
is a web-only change: a `?detail=` URL that opens one field (works without JavaScript), a `?/detail`
form action, an `only` prop on the existing fields component, and a redirect from the old page.

## Technical Context

**Language/Version**: TypeScript 5, Node 24
**Primary Dependencies**: SvelteKit 3 / Svelte 5 (web), Hono + Zod OpenAPI (API, unchanged)
**Storage**: PostgreSQL 17 via Drizzle; no schema change
**Testing**: Vitest (API), Playwright + axe (web)
**Target Platform**: Web, server-rendered, works without JavaScript
**Project Type**: Web application (`apps/api`, `apps/web`, `packages/shared`)
**Performance Goals**: Saving one detail feels immediate; same single PATCH as today
**Constraints**: One filled button per screen; things stay put; WCAG 2.2 AA; no new dependencies
**Scale/Scope**: One page (`/arrangements/[id]`), one component change, one route removed

## Constitution Check

| Principle | Check | Result |
|-----------|-------|--------|
| I. People over extraction | Nothing new collected or shown | ✅ |
| II. Simple workflows | One press to open, one to save, no separate page | ✅ |
| III. Security first | Same API checks: only the requester, only while open | ✅ |
| IV. Accessible | Links with words ("Add when"), visible field labels, errors beside the field, focus moved in and back, 320 px | ✅ |
| V. Calm, stays put | `stayPut()` enhance, `data-sveltekit-reset="false"`, `#details` fallback; the field opens below its label only; notices limited as today; Save is outline, no competing filled buttons | ✅ |
| VI. Readable code | Reuses `ArrangementFields` and `arrangementBody`; module comments updated | ✅ |
| VII. No new dependencies | None | ✅ |

Re-checked after design: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/006-fill-details-in-place/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/pages.md
└── tasks.md            # /speckit-tasks
```

### Source Code

```text
apps/web/src/
├── lib/
│   ├── arrangement-form.ts             # + detailKeys / detailBody(detail, values, type)
│   ├── components/ArrangementFields.svelte   # + `only` prop: render one detail's fieldset
│   ├── components/ArrangementDetails.svelte  # rows become links / the open field form
│   └── help/Arrangements.svelte        # words: press a detail to add or change it
└── routes/arrangements/[id]/
    ├── +page.server.ts                 # load: `detail` from URL, offering for the field; action `detail`
    ├── +page.svelte                    # no "Change details", no 'edit' primary
    └── edit/                           # +page.svelte removed; +page.server.ts redirects (308)

apps/web/tests/e2e/
├── arrangements-details-in-place.spec.ts   # NEW
├── stay-put.spec.ts                         # + saving a detail keeps the page still
└── (existing specs using "Change details" updated)

apps/api/src/routes/arrangements*.test.ts    # + single-key PATCH leaves others; one notice for several saves
```

**Structure Decision**: Existing monorepo layout; web-only behaviour change plus API tests that pin
what the web now relies on.

## Complexity Tracking

None.
