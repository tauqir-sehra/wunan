# Notes for AI coding agents

Read this before changing anything. People contributing with AI tools should read
[CONTRIBUTING.md](CONTRIBUTING.md#using-ai-tools) too.

## First, the principles

Every change must follow the [constitution](.specify/memory/constitution.md). The rules agents
break most often:

- **One primary action per screen.** Only one filled (default variant) button on a page; the rest
  are `outline`. Header buttons use `primaryOutline`.
- **Things on screen stay put.** Actions must not jump the page or shift what the person is
  working on. Enhance forms with `use:enhance={stayPut()}` from `apps/web/src/lib/stay-put.ts`,
  show results next to the button that was pressed, and give the form an `#anchor` action as the
  no-JavaScript fallback. Links that shouldn't scroll use `data-sveltekit-reset="false"` (SvelteKit
  3 replaced `data-sveltekit-noscroll`). New space for messages goes below what the person is
  working on, not above.
- **Plain words.** Short sentences, no jargon, no blame, no urgency, in every message a person sees.
- **Accessible.** WCAG 2.2 AA: visible labels, accessible names, keyboard use, nothing by colour
  alone, works at 320 px wide.
- **Privacy.** Never log emails, tokens, messages or contact details.
- **No new dependencies** without asking the maintainers first. Versions are pinned exactly.
- **Readable code.** Every module starts with a short comment saying what it's for. Simple over
  clever.

## Layout

| Folder            | What it is                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `apps/api`        | Hono API: all data and rules, Drizzle + PostgreSQL. The only thing that touches the database.                      |
| `apps/web`        | SvelteKit 3 / Svelte 5 website. Calls the API from the server; holds no data. Every form works without JavaScript. |
| `packages/shared` | Zod schemas and small helpers used by both.                                                                        |
| `specs/`          | Spec Kit specs, plans, contracts and tasks, one folder per feature.                                                |
| `docs/`           | Operator guide, design tokens, security reviews.                                                                   |

Update the contracts in `specs/*/contracts/` when you change the API or pages: the API tests
check the OpenAPI document against them.

## Commands

From the repository root:

```bash
npm run check      # tsc, svelte-check and ESLint
npm test           # API tests (Vitest; loads .env for TEST_DATABASE_URL, so don't run vitest bare)
npm run test:e2e   # Playwright browser tests with axe scans; slow, run the relevant specs first
npm run format     # Prettier
```

Run one browser spec from `apps/web` with `npm run test:e2e -- <name>` (for example `stay-put`). Development
services (PostgreSQL, Mailpit) start with `docker compose -f compose.dev.yaml up -d`.

All three checks must pass before you call a change done. Report failures as they are; don't
weaken a test to make it pass.

## Browser tests

- Wait for the page to be ready (`await page.waitForLoadState('networkidle')`) before clicking
  things that need JavaScript, such as `<details>` menus and multi-step forms. Clicking before
  hydration makes tests flaky.
- Add an axe scan (`expectAccessible`) for new screens and new states such as dialogs.
- Add a check to `apps/web/tests/e2e/stay-put.spec.ts` when an action must keep the page still.

## Working on features

Features follow Spec Kit: specify → clarify → plan → tasks → analyze → implement → converge. The
full guide is in [CONTRIBUTING.md](CONTRIBUTING.md#planning-features-with-spec-kit); the commands
are in `.claude/skills/`.

- The feature being worked on is the folder named in `.specify/feature.json`.
- `spec.md`, `plan.md`, the contracts and the constitution are the source of truth. If the code
  needs to differ from them, say so and update them too, rather than drifting silently.
- When implementing, write tests first, mark each finished task `[X]` in `tasks.md`, and run the
  checks after each phase.
- Never renumber, reorder or delete tasks. `/speckit-converge` only appends a new
  "Convergence" phase at the end.
- Don't change the constitution as part of a feature; that's its own change.

## Commits

Commit only when asked. One logical change per commit, with a short plain-language subject. If an
AI tool wrote a meaningful part of the change, add a `Co-Authored-By:` line for it.
