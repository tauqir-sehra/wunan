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
[specs/](specs/).

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

## Security

Please report security problems privately to the maintainers rather than in a public issue.
Each phase's security review is recorded in [docs/security-review.md](docs/security-review.md).
