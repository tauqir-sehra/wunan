# wunan

Share what you have with your community. Invite-only, calm, and free of extraction.

wunan is a small, self-hosted app for one community to lend, give, trade and offer services to
each other. It's built for people who aren't very confident with technology, and for people who
are easily overwhelmed by busy, attention-grabbing apps.

## What it does

- **Join by invitation.** Every member is invited by someone already in the community, so everyone
  has a short chain of people who vouched for them.
- **Offer things.** List something to **Lend** (e.g. a drill for up to 3 days), **Gift** (e.g. 5 
  kg of rice), **Trade** (e.g. sneakers for boots), or a **Service** (a bodywork session, weekday
  evenings).
- **Ask for things.** Post a request ("I need a ladder"). Others answer it with an offering, and
  wunan suggests offerings that already match while you write.
- **Arrange and agree.** Ask for something on an offering. Each exchange is one arrangement with
  one page, from asking to the end: the two of you talk privately there, add a phone number or a
  time to call if you both want to, and once it's accepted the details are fixed as what you
  agreed. Loans are marked returned; gifts, trades and services can be marked as done.
- **Talk in public.** Every offering and request has a short public thread for questions.
- **Ask for help, not punishment.** If something goes wrong, you ask your invite chain to help
  sort it out. There is no removing, banning or blocking.
- **Your data is yours.** Export everything in a readable format, and leave whenever you like.

## Ethos and principles

The full text is in the [constitution](.specify/memory/constitution.md). Every change is checked
against it.

1. **People over extraction.** No ads, tracking, engagement tricks or dark patterns. Collect only
   what a feature needs, and say why.
2. **Simple, intuitive workflows.** One clear primary action per screen, plain words, and errors
   that explain what to do next.
3. **Security first.** Validated input, encrypted contact details, no personal data in logs, and a
   security review for each phase ([docs/security-review.md](docs/security-review.md)).
4. **Accessible by default.** WCAG 2.2 AA: keyboard-usable, good contrast, works at 200% zoom and
   on narrow phones, nothing shown by colour alone.
5. **Calm design.** No flashing, autoplay or urgency. Things on screen stay put: actions don't
   jump the page or shift what you're working on.
6. **Readable, simple code.** Clear over clever; every module says what it's for.

## Architecture

```
            browser (phone or computer)
                       │  HTTPS
                       ▼
                    Caddy  ── /api/* ──────────┐
                       │                       │
                       ▼                       ▼
     apps/web  (SvelteKit) ── server-side ──► apps/api  (Hono)
     pages and forms; holds     HTTP calls     all data and rules; versioned,
     no data of its own                        documented JSON API (OpenAPI)
                                                      │
                                                      ▼
                                          PostgreSQL  +  photos on disk
```

- **`apps/api`** holds all data and rules and is the only thing that talks to the database. It
  exposes a versioned REST API (`/api/v1`), so a future phone app can use the same API as the
  website. Live updates (new messages) use server-sent events backed by PostgreSQL
  `LISTEN/NOTIFY`.
- **`apps/web`** is the website, and the API's first client. Pages load and submit through the
  API from the server, and every form works without JavaScript; with JavaScript, actions update
  the page in place.
- **`packages/shared`** holds the request and response schemas (Zod) used by both.
- **`specs/`** holds each feature's specification, plan, contracts and tasks, written with
  [Spec Kit](https://github.com/github/spec-kit).

Each community runs its own copy with Docker Compose: `caddy`, `web`, `api` and `postgres`.

## Tech stack

| Part | Tools |
|------|-------|
| Language | TypeScript (strict) on Node.js 24; the API runs `.ts` directly |
| API | Hono, Zod OpenAPI, Drizzle ORM with postgres.js, Better Auth, sharp (photos), nodemailer, web-push |
| Database | PostgreSQL 17 (full-text search, `LISTEN/NOTIFY`) |
| Web | SvelteKit 3 with Svelte 5, Tailwind CSS v4, shadcn-svelte on Bits UI, Lucide icons, self-hosted Inter |
| Tests | Vitest (API, against a test database), Playwright with axe accessibility scans (web) |
| Quality | tsc, svelte-check, ESLint, Prettier |
| Hosting | Docker Compose with Caddy (automatic HTTPS) |

## Quickstart (development)

You need Node.js 24 and Docker.

```bash
cp .env.example .env                          # the defaults work for development
docker compose -f compose.dev.yaml up -d      # PostgreSQL and Mailpit (catches emails)
npm ci
npm run db:migrate -w apps/api
npm run create-founder -w apps/api            # your first account
npm run dev                                   # API on :3000, website on :5173
```

Open http://localhost:5173 and sign in. Emails such as invitations appear in Mailpit at
http://localhost:8025. To try it with a full community of made-up members, offerings and requests,
run `npm run seed:demo -w apps/api -- --members 200 --offerings 600 --requests 300`. It adds to the
database in `DATABASE_URL`, so point that at a separate database to keep your own data apart.

Before sending a change:

```bash
npm run check      # type checks and lint
npm test           # API tests
npm run test:e2e   # browser tests for every user story, with accessibility scans
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more.

## Hosting it for your community

See the [operator guide](docs/operator.md): a Linux server with Docker, a domain name, and an
email account to send from.

## License

[GNU Affero General Public License v3.0 or later](LICENSE).
