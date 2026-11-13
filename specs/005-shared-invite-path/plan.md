# Implementation Plan: How You're Connected

**Branch**: `005-shared-invite-path` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-shared-invite-path/spec.md`

## Summary

A profile shows how the viewer and the member are connected: a small tree with their common ancestor
at the top ("You both trace back to Fay") and a branch down to each of them, in the profile's side
column, under one plain sentence saying how you're connected. The separate invite chain page goes away.

Technical approach ([research.md](research.md)): because nobody's inviter ever changes, each member
row stores its whole **invite line** (`uuid[]`, founder → self), written once on joining and checked
by the database. The connection is then one query (two lines plus the names on them, by primary key)
and a longest-common-prefix loop in a small pure function. `GET /members/{id}` returns it as
`connection`; `GET /members/{id}/chain` is removed. The schema is regenerated; nothing is migrated.

## Technical Context

**Language/Version**: TypeScript 6 (strict) on Node.js 24 LTS; Svelte 5 (unchanged)

**Primary Dependencies**: Unchanged. **No new dependency** (no `ltree` or other extension).

**Storage**: PostgreSQL 17+. `member` gains `invite_line uuid[] not null` with two checks
([data-model.md](data-model.md)). The single initial migration is regenerated (as in 004: the
hand-added `btree_gist` extension and loan exclusion constraint are re-applied).

**Testing**: Vitest: `connectionOf()` unit tests for every `kind`; `GET /members/{id}` route tests
(each kind, a person who left, a 20-deep pair for speed); database checks reject a wrong line;
OpenAPI contract test reads 005. Playwright: new `members-connection.spec.ts` with axe scans in both
themes and a 320 px check; `us1-join` and `accessibility` specs lose the chain page.

**Target Platform**: Unchanged (Docker Compose self-hosting; modern browsers; API for future clients)

**Project Type**: Web service (REST API) + web application in one npm-workspaces repository

**Performance Goals**: Profile with its connection within 2 s with 20-deep lines (SC-003); expected
a few milliseconds: one query with three primary-key reads, O(depth) work in memory, no recursion.

**Constraints**: Works without JavaScript (server-rendered); WCAG 2.2 AA; no sideways scroll at
320 px or 200% zoom; no motion; nothing new about anyone is shown (FR-011).

**Scale/Scope**: 3 user stories; 1 endpoint changed, 1 removed; 1 page changed, 1 removed; 1 column;
1 new component; ~4 test files touched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.2.0.

| Principle | Gate | Status |
|-----------|------|--------|
| I. People Over Extraction | No new data collected; no engagement mechanics | ✅ Pass. `invite_line` restates what `invited_by_id` already records; no new data about anyone. Nothing to click, count or come back for |
| II. Simple, Intuitive Workflows | One primary action; core flows not harder | ✅ Pass. The section has no actions. One way to see the chain instead of two; following it upward still works through names |
| III. Security First | Authorization; nothing new exposed | ✅ Pass. `GET /members/{id}` stays members-only; `connection` holds only names, founder and left flags that profiles and the chain page already showed. The new column is written only by `createAccount`, never from input. Security review: confirm no email or contact field reaches `person` |
| IV. Accessible (WCAG 2.2 AA) | New widget accessible | ✅ Pass. A visible sentence says how you're connected; each branch of the drawing is a named list whose names are links, each reached once; "You" and the top label in words; wraps at 320 px; axe scans in both themes |
| V. Calm Design | No urgency; nothing shifts | ✅ Pass. Server-rendered with the page; no motion or loading state; plain words |
| VI. Readable, Simple Code | Simple over clever | ✅ Pass. One array column, one pure function with unit tests, no triggers or caches. The recursive `getChain` query is deleted |
| VII. No Unnecessary Dependencies | None without approval | ✅ Pass. None |

**Post-design re-check (after Phase 1)**: Unchanged. The contracts add one field to one response and
remove an endpoint and a page; the data model adds one column whose value can't drift (checks, and
the tree never changes shape).

## Project Structure

### Documentation (this feature)

```text
specs/005-shared-invite-path/
├── plan.md
├── research.md          # Phase 0: stored invite line vs recursion, closure table, ltree; drawing
├── data-model.md        # invite_line and its checks; the five kinds of connection
├── quickstart.md
├── contracts/
│   ├── api.md           # GET /members/{id} connection; /chain removed
│   └── pages.md         # profile two columns; the section's words and drawing
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/shared/src/schemas/members.ts      # Person, Connection; profile gains connection; ChainLink and MemberChain removed

apps/api/
├── drizzle/0000_initial.sql                # regenerated
├── scripts/seed-demo.ts                    # builds invite lines in memory
└── src/
    ├── db/schema/members.ts                # inviteLine + two checks
    ├── modules/
    │   ├── connection.ts                   # NEW: connectionOf(viewerLine, memberLine) (pure)
    │   ├── connection.test.ts              # NEW: every kind, edge cases
    │   └── members.ts                      # createAccount writes the line; getProfile(id, viewerId) adds connection; getChain removed
    ├── routes/members.ts                   # passes the viewer; /chain route removed
    └── routes/members.test.ts              # chain test replaced by connection tests

apps/web/src/
├── lib/components/InviteConnection.svelte  # NEW: sentences + drawing
├── routes/members/[id]/+page.svelte        # page-columns; side column holds the section
├── routes/members/[id]/chain/              # removed
└── (help, reports/[id], arrangements/[id] only say "invite chain" as words, no link: unchanged)

apps/web/tests/e2e/
├── members-connection.spec.ts              # NEW: each kind, labels, links, 320 px, axe both themes
└── us1-join.spec.ts, accessibility.spec.ts # chain page steps replaced

specs/001-community-resource-sharing/contracts/{api,pages}.md   # chain rows removed
docs/security-review.md                                         # 005 section
```

**Structure Decision**: Same two apps and shared package. The connection logic is a pure function in
its own file so every case is unit-tested without a database; the database part is one query in
`members.ts`.

## Order of work (for /speckit-tasks)

1. **Foundation**: shared schemas; `invite_line` column and checks; regenerate the migration;
   `createAccount` and `seed-demo` write it; test setup still passes.
2. **Story 1 and 2** (P1): `connectionOf()` with unit tests; `getProfile` returns `connection`;
   route tests; `InviteConnection.svelte`; profile two columns; browser spec.
3. **Story 3** (P2): `separate` words and drawing; test with two founders.
4. **Removal**: `/members/{id}/chain` API, page, links, tests, and 001 contract rows.
5. **Polish**: speed test at depth 20; security review note; reset and reseed the demo database;
   quickstart walk-through.

## Complexity Tracking

No constitution violations to justify.
