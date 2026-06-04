# Quickstart: Validate Community Resource Sharing

How to run wunan locally and prove each user story works end to end. Web pages are listed in
[contracts/pages.md](contracts/pages.md), API endpoints in [contracts/api.md](contracts/api.md), and
fields and states in [data-model.md](data-model.md).

## Prerequisites

- Node.js 24 LTS
- Docker (for the local PostgreSQL and a local mail catcher)

## Setup

```bash
cp .env.example .env                 # defaults work for local development
docker compose -f compose.dev.yaml up -d   # PostgreSQL + Mailpit (catches all emails)
npm ci                               # installs all workspaces
npm run db:migrate -w apps/api
npm run create-founder -w apps/api   # prompts for email, display name, password
npm run dev                          # starts API (port 3000) and web app (port 5173) together
```

Open http://localhost:5173 and sign in as the founder. Emails appear at http://localhost:8025. The
API's generated documentation is at http://localhost:3000/api/v1/openapi.json.

## Automated checks

```bash
npm run check        # tsc, svelte-check, ESLint across all workspaces: no errors
npm run test         # Vitest: API contract/integration tests (test database) + web helpers
npm run test:e2e     # Playwright: every user story, plus axe accessibility scan on each page
```

Expected: all pass with zero axe violations at WCAG 2.2 AA level.

## Manual scenarios

Use two browser windows (one private) to act as two members.

1. **Join by invitation (US1)**: Founder → Invitations → Create → copy link. In the private window,
   join as "Alex" (leave the email checkbox unticked), open the confirmation email in Mailpit, and confirm. Alex's profile shows "Invited by" the founder; the founder's shows "Founding
   member". Re-open the link → "no longer valid". Signed out, `/listings` redirects to sign-in.
   Trying to sign up directly through `/api/auth/sign-up/email` without an invite is refused.
2. **List a resource (US2)**: As founder, create a Gift "Rice", 5 kg, area "Riverside", one phone
   photo taken with location on. Also create a Lend "Drill" (1 item, up to 3 days) and a Trade
   "Sneakers" (1 item) wanting "leather boots" — then try a Trade with neither "wanted" nor
   "Open to offers": a plain error asks for one. Create a Service "Bodywork session", 1 hour,
   available 3 times → listing shows "1 hour · 3 sessions available". Listing shows "5 kg available" and "Riverside" only.
   Download the photo: no location metadata. Repeat with JavaScript disabled: still works.
3. **Find it (US3)**: As Alex, search "rices" → finds "Rice". Filter Gift → found. Filter Trade →
   calm empty state with "Clear filters".
4. **Talk (US4, FR-018a)**: Both open the same conversation. Alex sends a message → it appears in the
   founder's window without reloading, with no sound or animation; a screen reader announces it. The
   founder's conversation list updates only on reload. Propose and accept a call time; share a phone
   number after the confirm step.
5. **Device notifications (FR-031a)**: In Settings → Notifications, turn on device notifications;
   the browser asks permission only after that click. Close the conversation; Alex sends a message →
   a silent device notification arrives and opens the conversation. Turn it off → no more device
   notifications; email continues.
6. **Record agreement (US5)**: As founder, record giving 2 kg of rice to Alex → 3 kg left. Alex confirms.
   Record lending the drill with a return date of yesterday; run `npm run reminders:once -w apps/api` twice → exactly one reminder to
   each member. Mark returned → drill available again. Record 1 bodywork session for Alex → "2 sessions
   available"; record 2 more → listing closes.
7. **Problem (US6)**: Report a problem on the drill agreement → Alex's inviter (founder) is notified
   and a three-way conversation opens. Escalate → founders (final step); escalate no longer offered.
   Report can stay open; Alex's access is unchanged.
8. **Flag (FR-013a)**: Alex flags "Rice" with a request → founder notified; listing still visible.
9. **Export & delete (FR-032)**: Alex exports → ZIP matches [contracts/export-format.md](contracts/export-format.md).
    Alex deletes the account → profile shows "Alex (no longer a member)"; agreement still visible to founder.
10. **Sign-in runs out mid-form (constitution V)**: As Alex, open a conversation and type a message.
    In the database, delete Alex's session, then press Send → the sign-in form appears on the same
    page; after signing in, the message is sent as typed.

## API independence check

Using only `curl` (no web app), prove a native client could use the backend:

```bash
curl -s -X POST localhost:3000/api/auth/sign-in/email -H 'content-type: application/json' \
  -d '{"email":"founder@example.org","password":"…"}' -D - | grep -i set-auth-token
curl -s localhost:3000/api/v1/listings?q=rice -H "authorization: Bearer $TOKEN"
curl -s localhost:3000/api/v1/listings                       # → 401 with plain-language message
curl -s -X POST localhost:3000/api/auth/sign-up/email -d '{}' # → refused (invite-only)
```

Expected: sign-in returns a token; search returns the Rice listing as JSON; unauthenticated calls
are refused with the standard error shape.

## Accessibility and calm-design checks (SC-007, constitution IV and V)

On every page touched above:

- Complete each flow using only the keyboard; focus always visible.
- Use a screen reader (VoiceOver or NVDA): controls, photos, and live messages announced sensibly.
- Zoom to 200% and use a 320 px wide window: no horizontal scrolling.
- Turn on "reduce motion": nothing animates. Nothing autoplays, flashes, or plays sound. Opening
  menus or dialogs causes no slide or fade animation even with reduce motion off.
- Switch the device to dark mode: every page stays readable, with contrast ≥ 4.5:1 for text and
  visible focus rings (the Playwright axe scan runs in both themes).
- Visual check: each screen has one clear primary button, no clutter, and consistent spacing.

## Performance check (SC-006)

```bash
npm run seed:demo -w apps/api -- --members 5000 --listings 20000   # development only
```

Search a common word with filters: the page loads in under 2 seconds.

## Self-hosting check

```bash
docker compose up -d --build         # api + web + PostgreSQL + Caddy, production build
```

The API applies migrations and passes its health check; the web app serves through Caddy; the operator guide
(`docs/operator.md`) steps work as written.
