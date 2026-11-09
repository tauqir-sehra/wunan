# Contributing to wunan

Thank you for helping. wunan is a calm, accessible tool for communities that share with each
other. Before you start, read the project principles in
[.specify/memory/constitution.md](.specify/memory/constitution.md): plain language, accessibility
(WCAG 2.2 AA), calm design, privacy, and no unnecessary dependencies all apply to every change.

## Getting started

You need Node.js 24 and Docker.

```bash
cp .env.example .env                          # the defaults work for development
docker compose -f compose.dev.yaml up -d      # PostgreSQL and Mailpit (catches emails)
npm ci
npm run db:migrate -w apps/api
npm run create-founder -w apps/api            # your first account
npm run dev                                   # API on :3000, web app on :5173
```

Emails (invitations, confirmations) appear in Mailpit at http://localhost:8025.

The code is in three parts:

| Folder | What it is |
|--------|------------|
| `apps/api` | The API: all data and rules (Hono, Drizzle, PostgreSQL). Clients only talk to it over HTTP. |
| `apps/web` | The website (SvelteKit). Holds no data of its own; calls the API from the server. |
| `packages/shared` | Request and response schemas (Zod) shared by both. |

Features are planned with Spec Kit; the current specification, plan, contracts and tasks are in
[specs/](specs/). See [Planning features with Spec Kit](#planning-features-with-spec-kit).

## Before you open a pull request

```bash
npm run check      # type checks and lint
npm test           # API tests (separate test database)
npm run test:e2e   # browser tests for every user story, with accessibility scans
```

All three must pass. Before the first browser test run, Playwright may need its browser:
`npx playwright install chromium`. The tests use their own database, ports and folders, so they
don't touch your development data.

Also check by hand:

- **Words**: every message a person sees is plain language, with no blame and no urgency.
- **Accessibility**: works with the keyboard alone, at 200% zoom and 320 px wide, and in dark mode.
- **Calm design**: no animations, autoplay, sounds, or flashing; one primary button per screen.
- **Privacy**: logs never contain emails, tokens, messages or contact details.

## Planning features with Spec Kit

New features and larger changes are planned with [Spec Kit](https://github.com/github/spec-kit)
before any code is written. Small fixes don't need it.

Spec Kit is already set up in this repository: its scripts and templates are in `.specify/`, and
its commands are installed for Claude Code in `.claude/skills/` (type them as slash commands, e.g.
`/speckit-specify`). To use it with another AI tool, see the Spec Kit documentation for
`specify init --ai <tool>`.

### Where things live

| Path | What it is |
|------|------------|
| `.specify/memory/constitution.md` | The project principles. Every spec, plan and change is checked against them. |
| `specs/NNN-short-name/` | One folder per feature, numbered in order (`001-…`, `002-…`, `003-…`). |
| `spec.md` | What the feature does and why, in plain words: user stories, requirements (FR-…), success criteria. No technology. |
| `plan.md`, `research.md` | How it will be built, the decisions made and why, and the constitution check. |
| `data-model.md`, `contracts/` | Database changes, and the API, page and notification contracts. The API tests check the OpenAPI document against `contracts/api.md`. |
| `quickstart.md` | Scenarios to walk through by hand when the feature is done. |
| `tasks.md` | The ordered task list (T001, T002, …), grouped by user story. |
| `.specify/feature.json` | Which feature folder the commands work on; `/speckit-specify` sets it. |

### The steps

Work on a branch named after the feature folder, e.g. `git switch -c 004-short-name`. Then:

1. **`/speckit-specify <description>`**: describe the feature in your own words. It creates the
   next `specs/NNN-…/spec.md` and a quality checklist.
2. **`/speckit-clarify`**: answers up to five questions about anything unclear and writes the
   answers into the spec. Do this before planning; it's much cheaper than changing the plan later.
3. **`/speckit-plan`**: writes the plan, research, data model, contracts and quickstart, and
   checks them against the constitution. Any new dependency must be listed and approved here.
4. **`/speckit-tasks`**: breaks the plan into tasks in `tasks.md`.
5. **`/speckit-analyze`**: read-only check that the spec, plan and tasks agree with each other and
   with the constitution. Fix what it finds before implementing.
6. **`/speckit-implement`**: builds the tasks in order, writing tests first, and marks each one
   `[X]`. You can name a phase or tasks, e.g. `/speckit-implement T012 T013`. Review the result
   and run the checks after each phase.
7. **`/speckit-converge`**: compares the code with the spec, plan, tasks and constitution, and
   appends anything missing as a new "Convergence" phase at the end of `tasks.md`. Run
   `/speckit-implement` on those tasks, then converge again, until it reports "Converged".
8. Walk through `quickstart.md` by hand, then open a pull request.

`/speckit-checklist` makes an extra review checklist (for example for accessibility or security)
when you want one.

### Tips

- **Read every step's output** before running the next. The commands draft; you decide. Edit the
  spec or plan directly when something is wrong, and keep them true to what was built.
- **Changes to the spec after implementing**: update `spec.md` (and the plan and contracts if
  needed), then run `/speckit-converge` so the gap becomes tasks.
- **Never renumber or delete tasks**, including finished ones. New work goes in a new phase at the
  end.
- **Changing the principles** is a separate step: `/speckit-constitution`, in its own pull request,
  with the reason and a version bump (see the end of the constitution).

## Dependencies

Every dependency is code we have to trust and keep up to date (constitution VII).

**Adding one**: ask the maintainers first, and say what it does, why it is needed instead of a
few lines of our own code, how well it is maintained, its license, and its security history.
Versions are pinned exactly (no `^` or `~`).

**Keeping them healthy**, monthly and before every release:

1. Run `npm run audit` (production dependencies) and `npm audit` (everything, including
   development tools), then `npm outdated`.
2. Apply security fixes within a week of their release.
3. Update **one package at a time** to an exact version, then run `npm run check`, `npm test`,
   and `npm run test:e2e` before moving on to the next. Read its release notes for breaking
   changes.
4. Remove anything no longer used.

Operators update their installation as described in [docs/operator.md](docs/operator.md#updates).

## Using AI tools

You're welcome to use AI coding tools. The same standards apply to what they write as to what
you write by hand:

- **You're responsible for it.** Read and understand every line before you open a pull request,
  and be ready to explain it. Don't submit code you couldn't have reviewed yourself.
- **Run the checks yourself.** `npm run check`, `npm test` and `npm run test:e2e` must pass, and
  the hand checks above still apply. AI tools often miss calm-design and plain-language rules.
- **Say so.** Mention in the pull request if AI wrote a meaningful part of it, and add a
  `Co-Authored-By:` line for the tool in the commit message.
- **Keep secrets out.** Don't paste `.env` values, members' data or database dumps into an AI tool.

Instructions for the tools themselves are in [AGENTS.md](AGENTS.md), which most coding agents read
automatically ([CLAUDE.md](CLAUDE.md) imports it for Claude Code). Spec Kit commands for planning
features are in `.claude/skills/`. Keep personal tool settings out of the repository, for example
in `.claude/settings.local.json` (ignored by git) or your own `~/.claude/CLAUDE.md`.

## Security

Please report security problems privately to the maintainers rather than in a public issue.
Each phase's security review is recorded in [docs/security-review.md](docs/security-review.md).
