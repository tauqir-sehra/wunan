# Research: Community Resource Sharing

Technical decisions for [plan.md](plan.md). The stack (SvelteKit + TypeScript + PostgreSQL) was chosen
by the project owner (spec Clarifications), who also asked for a separate backend that future clients
such as an Android app can use. Each further choice is weighed against the constitution (v1.1.0):
readable code (VI), no unnecessary dependencies (VII), security first (III), accessible and calm UI
(IV, V).

## 1. Application shape

- **Decision**: Two applications in one repository (npm workspaces):
  - **`apps/api`**: a standalone backend serving a versioned JSON API at `/api/v1` plus
    authentication at `/api/auth`. It owns the database, all business rules, photos, notifications,
    and the reminder job. It knows nothing about web pages.
  - **`apps/web`**: a SvelteKit app that renders pages on the server and talks to the API only
    through its documented endpoints, exactly as an Android app would later. Forms are progressively
    enhanced: every flow works with plain HTML forms; JavaScript adds smoother steps, photo
    previews, and live messages.
  - **`packages/shared`**: Zod schemas and TypeScript types for API requests and responses, used by
    both apps (and the source of the API documentation).
- **Rationale**: The project owner wants a backend that other clients can use. Making the web app a
  true API client from day one proves the API is complete; nothing is web-only. Keeping both in one
  repository with shared schemas avoids duplicated validation and drifting types (VI).
- **Alternatives considered**: One SvelteKit app with JSON endpoints added alongside pages (the
  previous plan; simpler, but business logic would tend to leak into page code and the API would lag
  behind the web app); separate repositories (more overhead, harder to keep types in sync).

## 2. Runtime and versions

- **Decision**: Node.js 24 LTS for both apps; TypeScript 5 (strict); PostgreSQL 17 or newer.
  Web: SvelteKit 2 with Svelte 5 and `@sveltejs/adapter-node`.
- **Rationale**: Current, long-supported releases; one language and runtime across the repository.

## 3. API framework

- **Decision**: Hono on Node (`@hono/node-server`), with `@hono/zod-openapi` so each route is
  declared with its Zod request/response schemas and an OpenAPI 3.1 document is generated
  automatically at `/api/v1/openapi.json`.
- **Rationale**: Hono is small, modern, TypeScript-first, and built on web-standard `Request` and
  `Response`, which keeps handlers short and readable. Generating the OpenAPI document from the same
  schemas used for validation means the API docs can't drift from the code, and an Android team can
  generate a Kotlin client from it.
- **Alternatives considered**: Fastify (solid, but plugin system adds concepts); Express (dated
  types and error handling); NestJS (heavy decorators and layers, against VI); tRPC (TypeScript-only
  clients, poor fit for Android).

## 4. API style

- **Decision**: Resource-oriented REST with JSON, versioned in the path (`/api/v1`). Breaking
  changes go to `/api/v2`; additive changes stay in v1. Errors use one shape:
  `{ "error": { "code": "invitation_expired", "message": "This invitation has expired. Ask the person who sent it for a new one." } }`
  where `message` is plain language and safe to show users directly. Lists use cursor pagination
  (`?cursor=…`, response includes `nextCursor`). Full endpoint list: [contracts/api.md](contracts/api.md).
- **Rationale**: REST + JSON is the most widely supported option for Android, iOS, and web clients.
  Plain-language error messages let every client follow constitution II without each re-writing them.

## 5. Database access

- **Decision**: Drizzle ORM with the `postgres` (postgres.js) driver, used only in `apps/api`;
  `drizzle-kit` (dev only) generates SQL migrations committed to the repository.
- **Rationale**: Drizzle schemas are plain TypeScript that read almost like SQL, with full type
  safety and no runtime magic (VI). postgres.js also supports `LISTEN/NOTIFY` for live messages (§9).
- **Alternatives considered**: Prisma (heavier, separate engine and schema language); raw SQL only.

## 6. Authentication (FR-001a)

- **Decision**: Better Auth in `apps/api`, email + password only, with its **bearer plugin** so every
  client authenticates the same way: `Authorization: Bearer <session token>`. Better Auth provides
  password hashing (scrypt), database sessions, single-use time-limited reset tokens, and rate
  limiting on sign-in and reset. Passwords 10–128 characters.
- **Session length** (constitution V): sessions last 30 days and renew once a day while in use
  (`expiresIn`, `updateAge`). If a session has expired when a web form is sent, the web app shows
  the sign-in form on the same page with the member's input kept, then sends it after sign-in, so no
  typed work is lost. Chosen photos cannot be carried through a sign-in, so the page asks the member
  to choose them again rather than dropping them silently.
- **How each client holds the token**:
  - Web: the SvelteKit server signs in through the API, then stores the session token in its own
    `HttpOnly`, `Secure`, `SameSite=Lax` cookie. The browser never sees the token, and never calls the
    API directly; the SvelteKit server adds the bearer header on each API call.
  - Android (future): stores the token in Android's encrypted storage and sends it as a bearer
    header.
- **Invite-only sign-up**: Better Auth's public sign-up route is disabled. Accounts are created only
  by `POST /api/v1/invitations/{token}/accept`, which validates the invitation, creates an unconfirmed account
  through Better Auth's server API, and holds the invitation for 7 days. `POST
  /api/v1/invitations/confirm` (from the emailed link) verifies the email and marks the invitation
  used in one transaction.
- **Email confirmation** (FR-001b): Better Auth's `requireEmailVerification` blocks sign-in until
  the confirmation link is opened; its verification token lasts 7 days, matching the invitation
  hold. Unconfirmed accounts are deleted when the hold passes (§11).
- **No email enumeration**: sign-in returns one generic error; password reset always returns the same
  response.
- **Rationale**: Constitution III forbids hand-rolled authentication. Bearer tokens are the standard
  for mobile clients, and using them for the web server too means the API has a single, simple auth
  path and needs no cookie or CSRF handling. SvelteKit's built-in origin check protects the web
  forms.
- **Alternatives considered**: Cookie sessions on the API shared with the browser (needs CSRF
  protection and cross-client special cases); Auth.js (OAuth-focused); Lucia (no longer maintained
  as a library).

## 7. Validation and shared types

- **Decision**: Zod schemas in `packages/shared` for every API input and output. The API validates
  with them (via `@hono/zod-openapi`); the web app uses the same schemas for form actions and typed
  responses, plus native `required`/`maxlength` attributes for instant browser feedback.
- **Rationale**: One readable definition per shape, enforced on the server, reused by clients.

## 8. Photos (FR-012)

- **Decision**: Uploads go to the API as `multipart/form-data`. `sharp` decodes each upload (rejecting
  non-images), applies orientation, resizes to at most 1600 px, and re-encodes as WebP, which drops all
  metadata including GPS. Max 10 MB per upload, 6 per listing. Files live on a disk volume owned by
  the API, named by random key, and served only to authenticated members by
  `GET /api/v1/photos/{key}`. The web app proxies photo requests through its own route so the
  browser's cookie session applies.
- **Alternatives considered**: Storing originals (leaks location); cloud object storage (third-party
  holding members' photos, against Principle I).

## 9. Live messages in an open conversation (FR-018a)

- **Decision**: The API exposes `GET /api/v1/conversations/{id}/live` as Server-Sent Events. Saving a
  message runs `NOTIFY` on a per-conversation channel; the live endpoint `LISTEN`s and forwards new
  messages. The web app's `/messages/[id]/live` route opens this stream server-side with the member's
  bearer token and passes it through to the browser's `EventSource`. The page appends messages with
  no animation, no scrolling if the member has scrolled up, and a polite live region. An Android
  client can consume the same SSE endpoint directly.
- **Rationale**: SSE is a plain HTTP stream every platform can read, needs no library, and Postgres
  LISTEN/NOTIFY avoids a message broker.
- **Alternatives considered**: WebSockets (more code and a library, two-way not needed); polling.

## 10. Notifications: email and device (FR-031, FR-031a)

- **Decision**: All sending happens in the API. Email via `nodemailer` over the operator's SMTP
  server. Device notifications via Web Push (`web-push` library, operator's own VAPID keys) for the
  installable web app. Push subscriptions are stored per device with a `platform` field so a future
  Android app can register its own kind of subscription (see note below) without changing the
  notification rules. A single `notify()` module applies the per-type, per-channel switches and the
  calm rules (off by default, never auto-prompted, silent, at most one per conversation per hour).
- **Future Android note**: Android push normally goes through Google's Firebase Cloud Messaging, a
  third-party service. To stay consistent with Principle I, the Android app should prefer
  UnifiedPush (user-chosen, self-hostable distributors) with Firebase only as an opt-in fallback.
  That decision belongs to the Android feature; this design only reserves the `platform` field.
- **Alternatives considered**: Third-party push services for web (send member data to a company).

## 11. Hourly jobs: return reminders (FR-025) and expired holds (FR-001b)

- **Decision**: An hourly job in the API process. It takes a PostgreSQL advisory lock (so only one
  copy runs if several API instances exist), then deletes unconfirmed accounts whose 7-day
  invitation hold has passed (freeing their invitations), and finds loans past `return_due` with no
  `reminder_sent_at`, sends reminders, and records them.
- **Rationale**: No cron setup or queue library; idempotent by design.

## 12. Styling, UI components, and visual direction (web app)

- **Decision**: Tailwind CSS v4 (via its Vite plugin) with **shadcn-svelte** as the component
  library. shadcn-svelte is not installed as a package: its CLI copies each component's source into
  `apps/web/src/lib/components/ui/`, so we own, read, and adjust the code. Complex interactive
  primitives come from Bits UI, which shadcn-svelte is built on and which follows WAI-ARIA patterns.
  Icons from Lucide. The Inter typeface is self-hosted through Fontsource (no requests to Google
  Fonts or any other third party).
- **Visual direction ("sleek and calm")**: Neutral, low-saturation base (shadcn "zinc"/"stone"
  palette) with a single muted accent colour; generous whitespace; one clear primary button per
  screen; soft borders and rounded corners rather than heavy shadows; clean type scale with a 16 px
  minimum body size; touch targets at least 44 × 44 px. Light and dark themes follow the device
  setting via Tailwind's `dark:` variant. Design tokens live as CSS variables in `app.css` and are
  checked for WCAG 2.2 AA contrast in both themes before use.
- **Calm and accessibility rules for the components**:
  - Prefer components that render native elements (Button, Input, Textarea, Label, Checkbox, Radio
    Group, Card, Badge, Alert, Separator). Use a native `<select>` and native date/time inputs
    instead of custom pop-up pickers.
  - Use Bits UI–backed components (Dialog, Dropdown Menu, Popover, Sheet) only where the flow still
    works without JavaScript. Destructive confirmations are a second step in the same form.
  - shadcn-svelte's entry/exit animations are removed: `tw-animate-css` is not installed and
    animation classes are dropped from copied components. Only colour/opacity transitions under
    150 ms, and only inside `motion-safe:`.
  - Focus rings stay clearly visible.
- **Rationale**: A polished, modern look with component code kept in the repo, readable and
  changeable (VI); Bits UI handles keyboard and screen-reader behaviour for complex widgets (IV).
- **Alternatives considered**: Plain CSS with hand-built components (less polished for the effort);
  Skeleton or Flowbite Svelte (packaged, harder to adjust, heavier styles); Melt UI directly.

## 13. Search (FR-015 to FR-017)

- **Decision**: PostgreSQL full-text search: a generated `tsvector` column on listings (title weighted
  above description and what's wanted, `english` configuration) with a GIN index, queried with
  `websearch_to_tsquery`. Offering type, area, and status are plain indexed filters. Newest first,
  rank as tie-break. Exposed as `GET /api/v1/listings`.
- **Rationale**: Handles word forms, meets SC-006 at 20,000 listings, no extra service.

## 14. Security (constitution III)

- **API**: bearer-only authentication (no cookies, so no CSRF surface); Zod validation on every
  input; strict JSON content types; request body size limits (1 MB JSON, 10 MB photo upload);
  per-member rate limits on sending messages, creating invitations, and flagging (small in-database
  counters); `X-Content-Type-Options`, no CORS (the web app calls the API server-to-server; a mobile
  app is not subject to CORS); structured JSON logs to stdout without message bodies, contact
  details, emails, or tokens.
- **Web**: SvelteKit's built-in CSP (`kit.csp`, hash/nonce mode) and form-action origin check; HSTS,
  `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` from `hooks.server.ts`; session
  token only in an `HttpOnly` cookie.
- **Network**: one public HTTPS entry point (Caddy). `/api/*` routes to the API (for future mobile
  clients), everything else to the web app. The web app reaches the API over the internal Docker
  network.
- **At rest**: the database volume, photos volume, and backups MUST be on encrypted storage (e.g.,
  LUKS full-disk encryption or the hosting provider's encrypted volumes). Backups are encrypted before
  leaving the server (e.g., with `age` or `gpg`). Members' private contact details (`share_phone`,
  `share_email`) are additionally encrypted in the database with AES-256-GCM using Node's built-in
  `crypto`, with the key from `DATA_ENCRYPTION_KEY`. No new dependency.
- **Secrets** come only from environment variables.

## 15. Testing

- **Decision**: Vitest in `apps/api` for unit and integration tests, calling routes through Hono's
  in-process `app.request()` against a real test PostgreSQL database; these are the contract tests
  for [contracts/api.md](contracts/api.md). Vitest for small web helpers. Playwright end-to-end tests
  of each user story through the web app, with `@axe-core/playwright` accessibility scans in light
  and dark themes. `svelte-check`, ESLint, and `tsc` across the workspace. Manual keyboard and
  screen-reader checks remain part of release (see [quickstart.md](quickstart.md)).

## 16. Data export and account deletion (FR-032)

- **Decision**: `GET /api/v1/me/export` returns a ZIP built with `fflate` containing
  `my-wunan-data.json`, a plain-language `README.txt`, and the member's own photos. Account deletion
  (`DELETE /api/v1/me`, password required) clears personal fields and sign-in data, deletes listings,
  photos, push subscriptions, and contact details, keeps only the display name (shown as "<name> (no
  longer a member)"), and revokes sessions; agreements,
  reports, and messages stay visible to the other members involved.

## 17. Deployment for self-hosting (spec Assumptions)

- **Decision**: One Dockerfile per app and a `compose.yaml` running `api`, `web`, `postgres`, and
  `caddy` (automatic HTTPS), with persistent volumes for the database, photos, and Caddy
  certificates. The API applies migrations on start. An operator guide covers setup, environment
  variables (database, SMTP, VAPID keys, site URL, internal API URL), creating founding members
  (`npm run create-founder -w apps/api`), backups (`pg_dump` + photos volume), and updates.
- **Rationale**: Operators have server experience; Compose keeps a four-service setup reproducible.

## Dependency summary (for maintainer approval, constitution VII)

Runtime, `apps/api`:

| Package | Purpose | Why it earns its place |
|---------|---------|------------------------|
| `hono`, `@hono/node-server` | API framework and Node server | Small, standards-based, readable handlers |
| `@hono/zod-openapi` | Route schemas + generated OpenAPI document | API docs and client generation can't drift from code |
| `drizzle-orm`, `postgres` | Database access, LISTEN/NOTIFY | Type-safe, readable queries; needed driver |
| `better-auth` | Accounts, sessions, bearer tokens, password reset, sign-in rate limiting | Constitution III forbids hand-rolled auth |
| `zod` | Validation (also used by web and shared) | One readable schema per shape |
| `sharp` | Photo validation, resize, metadata removal | Privacy (strip GPS) and security |
| `nodemailer` | Sending email over SMTP | Node has no SMTP client |
| `web-push` | Web device notifications | Push encryption and VAPID signing not hand-rolled |
| `fflate` | Export ZIP | Node has no zip writer; tiny |

Runtime, `apps/web`:

| Package | Purpose | Why it earns its place |
|---------|---------|------------------------|
| `@sveltejs/kit`, `svelte`, `@sveltejs/adapter-node` | Web framework | Chosen stack |
| `bits-ui` | Accessible primitives behind shadcn-svelte's interactive components | Correct keyboard and screen-reader behaviour (IV) |
| `tailwind-variants`, `clsx`, `tailwind-merge` | Style helpers required by shadcn-svelte components | Tiny; needed by copied component code |
| `@lucide/svelte` | Icons | Consistent icon set; tree-shaken |
| `@fontsource-variable/inter` | Self-hosted Inter font | Sleek typography without a third-party font service (I) |

Development only: `typescript`, `tsx` (run API in dev), `vite`, `tailwindcss`, `@tailwindcss/vite`,
`shadcn-svelte` (CLI via `npx`), `drizzle-kit`, `vitest`, `@playwright/test`,
`@axe-core/playwright`, `svelte-check`, `eslint` (+ Svelte/TypeScript plugins), `prettier`
(+ `prettier-plugin-tailwindcss`).

All pinned to exact versions with a committed lockfile.

**Status**: Approved by the project owner on 2026-06-03. Adding anything not listed here needs a
new approval.
