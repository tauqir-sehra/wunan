---

description: "Task list for Community Resource Sharing (wunan v1)"
---

# Tasks: Community Resource Sharing

**Input**: Design documents from `/specs/001-community-resource-sharing/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. The plan's testing strategy (research §15) requires API contract/integration
tests (Vitest, real test database) and one Playwright end-to-end test per user story with axe
accessibility scans. Within each story, write the tests first and confirm they fail.

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: User story from spec.md (US1–US6)
- Paths follow plan.md: `apps/api/`, `apps/web/`, `packages/shared/`

## Conventions for every task

- Read the constitution (`.specify/memory/constitution.md`) first. Code must be plain and readable,
  with a short purpose comment at the top of each module and *why* comments on non-obvious logic.
- API: route files stay thin (validate with the shared Zod schema → call a module → return). All
  errors use `ApiError` from `apps/api/src/lib/errors.ts` with a plain-language `message`.
- API endpoints, paths, and access rules are in [contracts/api.md](contracts/api.md); field rules in
  [data-model.md](data-model.md); web routes in [contracts/pages.md](contracts/pages.md).
- Web: pages call the API only through `apps/web/src/lib/api.ts`; every form works without
  JavaScript; one primary button per screen; destructive actions use a second confirmation step in
  the same form; use the shadcn-svelte components in `apps/web/src/lib/components/ui/`; native
  `<select>` and date/time inputs; no animations.
- After changing any table, run `npm run db:generate -w apps/api` and commit the new SQL file in
  `apps/api/drizzle/`.
- Do not add any dependency that is not in the approved list in research.md.
- Every form field that asks for personal data has a one-line hint saying why it is needed and who
  can see it (constitution I).
- Changes to authentication, data storage, or input handling get a security review before merge
  (constitution III); each such phase has a **Security review** line before its checkpoint. Record
  findings in `docs/security-review.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository, workspaces, tooling, and UI foundation

- [X] T001 Create root `package.json` with npm workspaces (`apps/*`, `packages/*`), scripts `dev` (runs API and web together), `check`, `test`, `test:e2e`, plus `.nvmrc` (Node 24), `.gitignore`, and `.editorconfig` at repository root
- [X] T002 [P] Add strict shared TypeScript config `tsconfig.base.json`, ESLint flat config `eslint.config.js` (TypeScript + Svelte plugins), and `.prettierrc` with `prettier-plugin-tailwindcss` at repository root
- [X] T003 [P] Scaffold `packages/shared` (`package.json`, `tsconfig.json`, `src/index.ts`) with `zod` pinned to an exact version
- [X] T004 [P] Scaffold `apps/api` (`package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts` placeholder) with exact-pinned runtime deps `hono`, `@hono/node-server`, `@hono/zod-openapi`, `drizzle-orm`, `postgres`, `better-auth`, `zod`, `sharp`, `nodemailer`, `web-push`, `fflate` and dev deps `drizzle-kit`, `vitest`, `typescript`; scripts `dev`, `build`, `start`, `test`, `db:generate`, `db:migrate`, `create-founder`, `reminders:once`, `seed:demo`
- [X] T005 [P] Scaffold `apps/web` as a SvelteKit 3 / Svelte 5 TypeScript app with `@sveltejs/adapter-node` in `apps/web/vite.config.ts`, exact-pinned deps (`bits-ui`, `tailwind-variants`, `clsx`, `tailwind-merge`, `@lucide/svelte`, `@fontsource-variable/inter`), and depend on `packages/shared`
- [X] T006 [P] Configure Tailwind CSS v4 via `@tailwindcss/vite` in `apps/web/vite.config.ts`, and create `apps/web/src/app.css` with theme tokens as CSS variables for light and dark (neutral zinc/stone base, one muted accent, all text/background pairs ≥ 4.5:1, focus ring clearly visible), Inter font import, 16 px minimum body size, and a global rule disabling animations and transitions under `prefers-reduced-motion`
- [X] T007 Initialise shadcn-svelte (`apps/web/components.json`, `apps/web/src/lib/utils.ts` with `cn()`), then add Button, Input, Textarea, Label, Checkbox, Radio Group, Card, Badge, Alert, Separator, Dialog, Dropdown Menu, and Sheet into `apps/web/src/lib/components/ui/`; do not install `tw-animate-css`; remove every animation class from the copied components; ensure Button and inputs are at least 44 px tall
- [X] T008 [P] Create `compose.dev.yaml` (PostgreSQL 17 with a dev and a test database, Mailpit on ports 1025/8025) and `.env.example` listing every variable: `DATABASE_URL`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`, `SITE_URL`, `API_INTERNAL_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PHOTOS_DIR` — also `DATA_ENCRYPTION_KEY`
- [X] T009 [P] Configure Playwright in `apps/web/playwright.config.ts` (starts API + web against the test database) and add `apps/web/tests/e2e/helpers/axe.ts` that runs `@axe-core/playwright` with WCAG 2.2 AA tags in both light and dark colour schemes and fails on any violation, plus `apps/web/tests/e2e/helpers/members.ts` to create founders and invited members through the API

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, auth, errors, notifications core, web shell. Everything every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 Create the database client in `apps/api/src/db/index.ts` (postgres.js + Drizzle) and `apps/api/drizzle.config.ts` pointing at `apps/api/src/db/schema/index.ts`
- [X] T011 Define the member and Better Auth tables in `apps/api/src/db/schema/members.ts`: Better Auth `user` table extended with `display_name` ("text, 1–60 chars", required), `bio` ("text, ≤500 chars", optional), `invited_by_id` ("FK → member, nullable"; "Null only when `is_founder`"), `is_founder` (boolean), `share_phone` and `share_email` ("text, nullable"; private), `deleted_at` ("timestamptz, nullable"), plus Better Auth's `session`, `account`, `verification` tables; no field for removal, suspension, penalty, or blocking; re-export from `apps/api/src/db/schema/index.ts`
- [X] T012 [P] Define `notification_preference` in `apps/api/src/db/schema/notifications.ts`: `member_id` FK, `type` enum ("`message`, `agreement`, `reminder`, `report`, `flag`"), `email` boolean "Default false; set from the join-form choice", `device` boolean "Default false"; "Unique on (`member_id`, `type`)"; plus a `notification_log` table (`member_id`, `type`, `conversation_id` nullable, `sent_at`) used to enforce "at most one notification per conversation per hour"
- [X] T013 [P] Define `rate_limit_event` (`key` text, `created_at`) in `apps/api/src/db/schema/system.ts` for per-member rate limits
- [X] T014 Generate and commit the initial migration in `apps/api/drizzle/` and add a migrate-on-start helper in `apps/api/src/db/migrate.ts`
- [X] T015 Implement `ApiError` and the error response `{ error: { code, message, fields? } }` in `apps/api/src/lib/errors.ts`, including a Zod-issue → plain-language `fields` mapper and a Hono `onError` handler that never leaks stack traces
- [X] T016 [P] Implement JSON structured logging in `apps/api/src/lib/log.ts` that never logs emails, tokens, message bodies, or contact details
- [X] T017 [P] Implement `checkRateLimit(key, max, windowMinutes)` in `apps/api/src/lib/rate-limit.ts` using `rate_limit_event`, throwing `ApiError(429, "slow_down", "You're doing that a lot. Please wait a few minutes and try again.")`
- [X] T017a [P] Implement `encrypt`/`decrypt` (AES-256-GCM, random 12-byte IV, key from `DATA_ENCRYPTION_KEY`) with Node's built-in `crypto` in `apps/api/src/lib/crypto.ts`, with unit tests in `apps/api/src/lib/crypto.test.ts`; `apps/api/src/modules/members.ts` (T037, T108) must use it for `share_phone` and `share_email`
- [X] T018 Configure Better Auth in `apps/api/src/auth.ts`: email + password only, password length 10–128, bearer plugin, public sign-up disabled (the `/api/auth/sign-up/email` route must always refuse), built-in rate limiting on sign-in and reset, one generic sign-in error, password-reset emails (1-hour, single-use) sent through `apps/api/src/notify/email.ts`, sessions rejected for members with `deleted_at` set; `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]` so sign-in limits are per visitor (research §14, "Visitor address"); an error hook (Better Auth `onAPIError`, or Hono middleware on `/api/auth/*`) that rewrites every auth error into the `ApiError` shape from `apps/api/src/lib/errors.ts` with plain-language messages, including `EMAIL_NOT_VERIFIED` → `403 email_not_confirmed`; `requireEmailVerification: true` so unconfirmed members cannot sign in, with the confirmation email sent through `apps/api/src/notify/email.ts` and its token lasting 7 days (`expiresIn: 60*60*24*7`); sessions last 30 days and renew daily while in use (`expiresIn: 60*60*24*30`, `updateAge: 60*60*24`)
- [X] T019 Implement email sending in `apps/api/src/notify/email.ts` (nodemailer over SMTP env vars, plain-text bodies, footer link to `/settings/notifications`, no tracking)
- [X] T020 Implement `notify(memberId, type, { title, body, url, conversationId? })` in `apps/api/src/notify/index.ts`: reads `notification_preference` (missing rows = defaults), applies the calm rules from [contracts/notifications.md](contracts/notifications.md) (no urgency words, preview ≤ 100 chars, max one per conversation per hour via `notification_log`), sends email, and calls a `sendPush` hook that is a no-op until T103
- [X] T021 Build the Hono app in `apps/api/src/app.ts` with `OpenAPIHono`: JSON body limit 1 MB, `X-Content-Type-Options: nosniff`, no CORS, request logging via `log.ts`, `requireMember` middleware (resolves the bearer session via Better Auth, attaches `member`, rejects deleted members with 401), mounts `/api/auth/*`, `GET /api/v1/health` (checks database), and `GET /api/v1/openapi.json`; start the server and run migrations in `apps/api/src/index.ts`
- [X] T022 Write `apps/api/scripts/create-founder.ts` (prompts for email, display name, password; creates a member with `is_founder = true`, `invited_by_id = null`, `email_verified = true`)
- [X] T023 Create the API test harness in `apps/api/src/test/setup.ts`: migrates the test database, truncates all tables between tests, and helpers `createFounder()`, `createInvitedMember(inviter)`, `signIn(member)` returning a bearer token, and `api(method, path, { token, body, ip })` using `app.request()`, which always sets `X-Forwarded-For` (default `203.0.113.1`, overridable per call) so per-IP limits are testable
- [X] T024 [P] Write auth tests in `apps/api/src/auth.test.ts`: sign-in with a wrong email and a wrong password return the same error; `/api/auth/sign-up/email` is always refused; forget-password returns the same response for registered and unknown emails; repeated failed sign-ins are rate-limited; every `/api/auth/*` error uses the `{ error: { code, message } }` shape; a deleted member's token returns 401; a member whose email is not confirmed cannot sign in: with the right password they get `403 email_not_confirmed` ("Please open the confirmation link we emailed you."), with a wrong password the usual generic error
- [X] T025 [P] Implement the typed API client in `apps/web/src/lib/api.ts`: reads `API_INTERNAL_URL`, adds `Authorization: Bearer` from `locals.token`, sends the visitor's address from `event.getClientAddress()` in `X-Forwarded-For` (research §14), parses the error shape into an `ApiError` the pages can show as-is, and supports JSON, multipart, and streamed responses
- [X] T026 Implement `apps/web/src/hooks.server.ts`: reads the `wunan_session` cookie (`HttpOnly`, `Secure`, `SameSite=Lax`) into `locals.token`, loads the current member via `GET /api/auth/get-session`, and, when a form action gets `401` from the API, re-renders the same page with a sign-in form that keeps the submitted fields as hidden inputs and re-sends them after sign-in (research §6); chosen files cannot be kept this way, so when a re-sent form had file fields the page says "Please choose your photos again."; sets HSTS, `Referrer-Policy`, `Permissions-Policy`, and `frame-ancestors 'none'`; enable `csp` (nonce mode) in the `sveltekit()` options in `apps/web/vite.config.ts`
- [X] T027 Create the app shell in `apps/web/src/routes/+layout.svelte` and `+layout.server.ts`: skip link, header navigation (Home, Find, Messages, My listings, Settings) with visible current-page state not shown by colour alone, `main` landmark, and redirect to `/sign-in` for signed-out visitors except public routes (`/sign-in`, `/password-reset/*`, `/join/*`)
- [X] T028 [P] Build sign-in, sign-out, and password-reset pages in `apps/web/src/routes/sign-in/`, `sign-out/`, `password-reset/`, and `password-reset/[token]/` per [contracts/pages.md](contracts/pages.md); on sign-in, store the token from the `set-auth-token` header in the `wunan_session` cookie; on `403 email_not_confirmed` show "Please open the confirmation link we emailed you." with a "Send it again" button (`resendConfirmation` action calling `POST /api/v1/invitations/resend-confirmation`)
- [X] T029 [P] Create a plain-language error page in `apps/web/src/routes/+error.svelte` (403/404: plain message + link home; 500: apology + link home; no technical details)
- [X] T030 [P] Create shared web components: `apps/web/src/lib/components/FormField.svelte` (visible label, hint, error linked by `aria-describedby`), `Notice.svelte` (`role="status"` success / `role="alert"` errors), and `Steps.svelte` (step indicator with text "Step 2 of 4")

**Checkpoint**: A founder can be created, sign in on the web, and see an empty app shell; auth tests pass.

---

## Phase 3: User Story 1 - Join by invitation and see who vouches for whom (Priority: P1) 🎯 MVP

**Goal**: Members invite people; invitees join; every profile shows who invited them and the chain above.

**Independent Test**: An existing member creates an invitation; the invitee joins through the link; a third member views the new profile and sees the inviter linked; a used link shows "no longer valid".

### Tests for User Story 1 ⚠️

> Write these first and confirm they fail.

- [X] T031 [P] [US1] Contract tests for invitation endpoints in `apps/api/src/routes/invitations.test.ts`: create returns a link once; `GET /invitations/{token}` returns the same 404 for used, expired, cancelled, and unknown tokens; accept creates an unconfirmed member with `invited_by_id` set; accept with a registered email → `409 email_taken`; cancel only by the inviter; expiry at 14 days; accept returns `202 check_your_email` and leaves the invitation `pending_confirmation`; the account cannot sign in until confirmed; `POST /invitations/confirm` activates it and marks the invitation used; once the 7-day hold passes, the unconfirmed account is deleted and the invitation is usable again, and the same email can then join (no `409`); a confirmation link still works within the hold even after the invitation's 14-day expiry; starting again on a held invitation deletes the earlier unconfirmed account and only the new email can confirm; `resend-confirmation` returns the same `202` for unknown, confirmed, and unconfirmed emails, sends only for the last, and does not extend the hold; a 6th accept attempt on one invitation in a day, or an 11th from one IP address in an hour, → `429 slow_down`; requests with two different `X-Forwarded-For` addresses have separate limits; the join checkbox sets email preferences
- [X] T032 [P] [US1] Contract tests for member endpoints in `apps/api/src/routes/members.test.ts`: profile never contains email or contact details; founders show `isFounder` and `invitedBy: null`; chain ends at a founder; `PATCH /me` enforces "display_name 1–60 chars" and "bio ≤500 chars"; unauthenticated calls → 401
- [X] T033 [P] [US1] End-to-end test in `apps/web/tests/e2e/us1-join.spec.ts` covering quickstart scenario 1 (create invite, join in a second context, profile shows inviter, reused link refused, signed-out visit redirects) with axe scans on each page (including opening the confirmation email in Mailpit)

### Implementation for User Story 1

- [X] T034 [P] [US1] Define `invitation` in `apps/api/src/db/schema/invitations.ts`: `token_hash` ("text, unique"; "SHA-256 of a 32-byte random token; the raw token is only in the link"), `inviter_id` FK required, `status` enum ("`unused` → `pending_confirmation` → `used`; `unused` → `cancelled`; treated as expired when `expires_at` has passed"), `reserved_until` ("timestamptz, nullable"; "Set when sign-up starts: now + 7 days. After it passes, the unconfirmed account is deleted and a `pending_confirmation` invitation returns to `unused`"), `expires_at` ("`created_at` + 14 days"), `used_by_id` ("FK → member, nullable"); generate the migration
- [X] T035 [P] [US1] Add member and invitation schemas in `packages/shared/src/schemas/members.ts` (`displayName` 1–60, `bio` ≤500, `password` 10–128, email; `AcceptInvitation`, `MemberProfile`, `MemberChain`, `UpdateMe`, `ContactDetails`, `ChangePassword`) and export them from `packages/shared/src/index.ts`
- [X] T036 [US1] Implement `apps/api/src/modules/invitations.ts`: `createInvitation` (32 random bytes, store SHA-256 hash, return link `${SITE_URL}/join/{token}`), `checkInvitation`, `releaseExpiredHolds()` (delete unverified accounts whose invitation's `reserved_until` has passed, with their `notification_preference` rows and sessions, and return those invitations to `unused`; per data-model.md "Expired holds"), `startAcceptance` (call `releaseExpiredHolds()` first; lock the invitation; require `status = unused` or `pending_confirmation`, and not expired; on `pending_confirmation`, delete the earlier unconfirmed account first (starting over, e.g. after a mistyped email); refuse an email that belongs to a confirmed account or one still within its hold; create an unverified account through Better Auth's server API bypassing the disabled public route; set `invited_by_id`; create `notification_preference` rows with `email` from the join checkbox; set `status = pending_confirmation`, `reserved_until` = now + 7 days; send the confirmation email via Better Auth's email-verification feature) and `confirmAcceptance` (in one transaction: verify the email, mark the invitation `used`, return a session token), `resendConfirmation(email)` (if the email has an unconfirmed account within its hold, send a fresh link through Better Auth; do not extend the hold; rate-limit 3 per hour per email; always return the same result), `cancelInvitation` (inviter only, unused only), `listMyInvitations`; rate-limit creation to 20 per day (spec Assumptions: no total limit); rate-limit `startAcceptance` with `checkRateLimit` (T017) to 5 attempts per invitation per day and 10 per IP address per hour, taking the address from the right-most `X-Forwarded-For` entry via a small `clientAddress(c)` helper in `apps/api/src/lib/rate-limit.ts` that falls back to the connection address (`getConnInfo` from `@hono/node-server`) when the header is missing (local development, direct `curl`); start an hourly job in `apps/api/src/index.ts` that takes a `pg_try_advisory_lock` and runs `releaseExpiredHolds()`
- [X] T037 [US1] Implement `apps/api/src/modules/members.ts`: `getProfile` (display name, bio, joined date, founder flag, inviter, invitees, "<name> (no longer a member)" for deleted), `getChain` (follow `invited_by_id` to a founder), `updateMe`, `getContact`, `updateContact`, `changePassword` (via Better Auth)
- [X] T038 [US1] Add routes in `apps/api/src/routes/invitations.ts` (`GET /invitations/{token}` public, `POST /invitations/{token}/accept` public, `POST /invitations/confirm` public, `POST /invitations/resend-confirmation` public, `POST /invitations`, `GET /me/invitations`, `POST /invitations/{id}/cancel`) with OpenAPI schemas, and mount them in `apps/api/src/app.ts`
- [X] T039 [US1] Add routes in `apps/api/src/routes/members.ts` (`GET /members/{id}`, `GET /members/{id}/chain`) and `apps/api/src/routes/me.ts` (`GET`/`PATCH /me`, `GET`/`PUT /me/contact`, `POST /me/password`) and mount them
- [X] T040 [P] [US1] Build `apps/web/src/routes/join/[token]/` (checks the invite; invalid → plain "ask the person who sent it for a new link"; form for email (hint: "Used to sign in and reset your password. Never shown to other members."), display name (hint: "Shown to other members."), password, and an unticked checkbox "Email me when someone messages me or something needs my attention" with one sentence explaining it; on success shows a "Check your email" page per [contracts/pages.md](contracts/pages.md) with "The link works for 7 days.", "Send it again", and "Wrong email? Start again") and `apps/web/src/routes/join/confirm/[token]/` (confirms, sets the session cookie, goes home; expired → "Use your invitation link again" if the invitation is still valid, otherwise "Ask the person who invited you for a new link")
- [X] T041 [P] [US1] Build `apps/web/src/routes/invitations/` (list with statuses; `create` action shows the link once with a "Copy link" button that falls back to a selectable text field without JavaScript; `cancel` action with a confirmation step)
- [X] T042 [P] [US1] Build `apps/web/src/routes/members/[id]/` (profile with "Invited by" link or "Founding member", invitees, joined date) and `apps/web/src/routes/members/[id]/chain/` (ordered chain)
- [X] T043 [P] [US1] Build `apps/web/src/routes/settings/` with `profile`, `contact`, and `password` actions and a settings sub-navigation; the contact page explains "Only shared when you choose to share it in a conversation, and only with that person."

**Security review**: invitation accept and confirm, sign-in, and the web session cookie (convention above).

**Checkpoint**: US1 works end to end; T031–T033 pass.

---

## Phase 4: User Story 2 - List a resource to share (Priority: P1)

**Goal**: Members create Lend, Gift, Trade, or Service listings with optional amount/unit, photos, and approximate area; owners edit, pause, resume, remove; others can flag a listing.

**Independent Test**: A member creates a listing with only type + title, then a full listing of each type with photos; both appear correctly to another member; a Trade with neither "wanted" nor "Open to offers" is refused; photo location data is gone.

### Tests for User Story 2 ⚠️

- [X] T044 [P] [US2] Contract tests in `apps/api/src/routes/listings.test.ts`: only `type` and `title` required; fields not applying to the type are rejected; `unit` required with `amount`; Trade requires `wanted` or `openToOffers`; `type` cannot change on PATCH; only the owner can edit/pause/resume/remove; status transitions per data-model; flags notify the owner, cannot target own listing, and leave the listing unchanged; `reopen` works only for `closed_reason = removed` and restores `available` with the remaining amount unchanged; automatic closes set `used_up`
- [X] T045 [P] [US2] Contract tests in `apps/api/src/routes/photos.test.ts`: a JPEG with GPS EXIF comes back as WebP with no metadata and ≤1600 px; a non-image → `400 not_an_image`; >10 MB → 413; a 7th photo is refused; `GET /photos/{key}` requires a member and sends `Cache-Control: private`
- [X] T046 [P] [US2] End-to-end test in `apps/web/tests/e2e/us2-list.spec.ts` covering quickstart scenario 2 (Gift rice, Lend drill, Trade sneakers, Service bodywork, the Trade validation error, photo upload, JavaScript disabled run) and the flag in scenario 8, with axe scans

### Implementation for User Story 2

- [X] T047 [P] [US2] Define `listing`, `listing_photo`, and `listing_flag` in `apps/api/src/db/schema/listings.ts` exactly as data-model.md: listing `type` ("`lend`, `gift`, `trade`, `service`"), `title` ("text, 1–100 chars"), `description` ("text, ≤2000 chars"), `amount` ("numeric, nullable"; "> 0"; "not used for Service"), `unit` ("Required when `amount` is set: `item`, `kg`, `g`, `litre`, `hour`, `portion`, `bag`, `box`, `other`"), `remaining` ("Gift/Trade only; starts at `amount`; never below 0"), `loan_length` ("Lend only; > 0") + `loan_length_unit` ("`hours`, `days`, `weeks`; required with `loan_length`"), `wanted` ("text, ≤300 chars, nullable"; Trade only), `wanted_amount` ("> 0") + `wanted_unit` ("required with `wanted_amount`"), `open_to_offers` ("Trade only; default false"), `session_length` ("Service only; > 0") + `session_length_unit` ("`minutes`, `hours`; required with `session_length`"), `sessions_available` ("Service only; ≥ 1"), `sessions_remaining` ("Starts at `sessions_available`; never below 0"), `area` ("text, ≤60 chars, nullable"), `status` ("`available`, `lent_out`, `paused`, `closed`"), `closed_reason` ("`removed` (owner removed it) or `used_up` (nothing remains)"), generated `search_vector` ("Title (weight A) + description + wanted (weight B)"), `updated_at`; a check constraint that fields not applying to `type` are null; indexes per data-model; `listing_photo` (`listing_id` cascade, `file_key`, `alt_text` "≤200 chars", `position`); `listing_flag` (`request` "text, 1–500 chars", `seen_by_owner_at`); generate the migration
- [X] T048 [P] [US2] Add listing schemas in `packages/shared/src/schemas/listings.ts`: `CreateListing` as a Zod discriminated union on `type` with the rules above (Trade: `wanted` or `openToOffers` required, message "Say what you'd like in return, or tick Open to offers."), `UpdateListing` (same, without `type`), `Listing` response, `Unit` and duration enums, `CreateFlag`
- [X] T049 [US2] Implement `apps/api/src/modules/listings.ts`: create (set `remaining`/`sessions_remaining` from the starting values), get (with photos, owner, owner's inviter; flags only for the owner), update, pause, resume, remove, listMine (with unseen flag counts), and `flagListing` (not own listing; rate-limit 10 per day; calls `notify(owner, "flag", …)`); mark flags seen when the owner views the listing; `remove` sets `closed_reason = removed`; add `reopen` (owner only, only when `closed_reason = removed`)
- [X] T050 [US2] Implement `apps/api/src/modules/photos.ts`: validate and process with sharp (decode or `400 not_an_image`, apply orientation, resize to max 1600 px long edge, encode WebP; output carries no metadata), store under `PHOTOS_DIR` with a random key, enforce "Max 6 per listing" and 10 MB, update alt text/position, delete files with their rows
- [X] T051 [US2] Add routes in `apps/api/src/routes/listings.ts` (`POST /listings`, `GET`/`PATCH /listings/{id}`, `POST /listings/{id}/pause|resume|remove`, `POST /listings/{id}/flags`, `GET /me/listings`) and `apps/api/src/routes/photos.ts` (`POST /listings/{id}/photos` multipart with a 10 MB limit, `PATCH`/`DELETE /listings/{id}/photos/{photoId}`, `GET /photos/{key}`) and mount them — include `POST /listings/{id}/reopen`
- [X] T052 [P] [US2] Create display helpers in `apps/web/src/lib/format.ts` producing plain text such as "5 kg available", "3 kg left", "Lend for up to 3 days", "Loan length to be agreed", "1 hour · 3 sessions available", "Open to offers", "Would like: 2 kg of flour"
- [X] T053 [P] [US2] Create `apps/web/src/lib/components/ListingCard.svelte` (type badge with text, title, amount line, area, first photo with alt text, owner name) and `apps/web/src/lib/components/PhotoPicker.svelte` (plain file input with per-photo alt-text field; previews only when JavaScript is available)
- [X] T054 [US2] Build `apps/web/src/routes/listings/new/` as a four-step form (1: choose Lend/Gift/Trade/Service as large radio cards; 2: title, description, amount + unit `<select>`, and the type's own fields; 3: photos and area with hint "Your neighbourhood, not your address"; 4: review) keeping progress between steps in hidden fields so it works without JavaScript
- [X] T055 [US2] Build `apps/web/src/routes/listings/[id]/` (details, photos, owner and "invited by", "Message about this" for others, `flag` action with a request textarea for others; owner sees flags received plus `pause`, `resume`, `remove` with a confirmation step); owner sees a `reopen` action on removed listings
- [X] T056 [P] [US2] Build `apps/web/src/routes/listings/[id]/edit/` (edit fields; `addPhotos`, `updatePhoto`, `deletePhoto` actions) and `apps/web/src/routes/my-listings/` (my listings grouped by status with flag counts)
- [X] T057 [P] [US2] Add the photo proxy `apps/web/src/routes/photos/[key]/+server.ts` that streams `GET /api/v1/photos/{key}` with the member's token and passes through `Cache-Control: private`

**Security review**: photo upload (type and size checks, metadata stripping, members-only access).

**Checkpoint**: US2 works on its own; T044–T046 pass.

---

## Phase 5: User Story 3 - Find something that's available (Priority: P1)

**Goal**: Search by keyword, browse and filter by offering type and area.

**Independent Test**: With several listings present, a member searches "drills", filters by Gift, and sees only matching available listings; a no-result search shows the calm empty state.

### Tests for User Story 3 ⚠️

- [X] T058 [P] [US3] Contract tests in `apps/api/src/routes/search.test.ts`: word forms match ("rices" finds "Rice"); `type` and `area` filters combine; paused/closed/lent-out hidden by default and lent-out shown with `includeLent`; newest first; cursor pagination returns `nextCursor`
- [X] T059 [P] [US3] End-to-end test in `apps/web/tests/e2e/us3-find.spec.ts` covering quickstart scenario 3 (search, filter, clear filters, empty state) with axe scans

### Implementation for User Story 3

- [X] T060 [P] [US3] Add `SearchListingsQuery` (`q`, `type`, `area`, `includeLent`, `cursor`, `limit` default 20 max 50) in `packages/shared/src/schemas/search.ts`
- [X] T061 [US3] Implement `apps/api/src/modules/search.ts` using `websearch_to_tsquery('english', q)` against `search_vector`, filters on `type`, case-insensitive `area`, and `status`, ordered by `created_at` desc then rank, with cursor pagination
- [X] T062 [US3] Add `GET /listings` to `apps/api/src/routes/listings.ts` using the search module
- [X] T063 [P] [US3] Build `apps/web/src/routes/listings/+page.svelte` and `+page.server.ts` (search box; type filter as radio buttons; area text filter; "Include items currently lent out" checkbox; active filters listed with one "Clear filters" link; results as ListingCards; "Show more" link for the next page; empty state "Nothing matches yet. Try other words or clear the filters.")
- [X] T064 [P] [US3] Build the home page `apps/web/src/routes/+page.svelte` and `+page.server.ts` (search box and Lend / Gift / Trade / Service links; space for quiet counts filled in by US4 and US5)

**Checkpoint**: US1–US3 form the MVP; T058–T059 pass.

---

## Phase 6: User Story 4 - Talk and arrange the exchange (Priority: P2)

**Goal**: Direct messages (live in an open conversation), contact sharing with confirmation, and call-time proposals.

**Independent Test**: Member A messages Member B about a listing; with B's conversation open, the message appears without reloading; A shares a phone number after confirming; B sees it; a proposed call time can be accepted.

### Tests for User Story 4 ⚠️

- [X] T065 [P] [US4] Contract tests in `apps/api/src/routes/conversations.test.ts`: starting twice for the same pair + listing returns the same conversation; only participants can read or send; `body` ≤4000 chars; contact share posts exactly the chosen details and nothing else; call accept only by the other participant; read marking updates unread counts; sending is rate-limited; the other participant is notified with `type = "message"`
- [X] T066 [P] [US4] Integration test in `apps/api/src/modules/live.test.ts`: a client subscribed to `GET /conversations/{id}/live` receives a newly sent message within 2 seconds; a non-participant gets 404; heartbeats are sent
- [X] T067 [P] [US4] End-to-end test in `apps/web/tests/e2e/us4-talk.spec.ts` covering quickstart scenario 4 (two contexts, live message appears without reload, conversation list updates only on reload, call proposal and acceptance, contact sharing with confirmation, and quickstart scenario 10: after the session is revoked, a typed message is kept through sign-in and then sent) with axe scans

### Implementation for User Story 4

- [X] T068 [P] [US4] Define `conversation` (`listing_id` "FK → listing, nullable"; `problem_report_id` uuid nullable, foreign key added in US6), `conversation_participant` (`conversation_id`, `member_id`, `last_read_at`; "Unique pair"), and `message` (`author_id` "Must be a participant"; `kind` "`text`, `contact_shared`, `call_proposed`, `call_accepted`, `system`"; `body` "text, ≤4000 chars"; `proposed_time` "timestamptz, nullable"; index (`conversation_id`, `created_at`)) in `apps/api/src/db/schema/messaging.ts`; generate the migration
- [X] T069 [P] [US4] Add messaging schemas in `packages/shared/src/schemas/messaging.ts` (`StartConversation`, `SendMessage`, `ShareContact` `{ phone: boolean, email: boolean }`, `ProposeCall`, `Conversation`, `Message`)
- [X] T070 [US4] Implement `apps/api/src/modules/live.ts`: one shared `LISTEN` connection, per-conversation subscriber registry, SSE stream with `event: message` (same JSON as the messages list) and a heartbeat comment every 25 s; expose `isConnected(memberId, conversationId)` for notification skipping in T071
- [X] T071 [US4] Implement `apps/api/src/modules/messaging.ts`: `startConversation` (reuse for same pair + listing), `listConversations` (unread flag, last message preview, listing title), `listMessages` (newest first, paginated), `sendMessage` (participant check, rate limit 60 per hour, then `pg_notify('conversation_<id>', messageId)` and `notify(other, "message", …)` skipping members currently connected to the live stream via `isConnected` from T070), `markRead`, `shareContact` (snapshot of exactly the chosen details into a `contact_shared` message), `proposeCall`, `acceptCall`
- [X] T072 [US4] Add routes in `apps/api/src/routes/conversations.ts` (`GET`/`POST /conversations`, `GET`/`POST /conversations/{id}/messages`, `POST /conversations/{id}/read`, `POST /conversations/{id}/contact-share`, `POST /conversations/{id}/calls`, `POST /conversations/{id}/calls/{messageId}/accept`, `GET /conversations/{id}/live`) and mount them
- [X] T073 [US4] Add `GET /me/summary` in `apps/api/src/routes/me.ts` returning `unreadConversations` (and `agreementsNeedingAttention: 0`, `unseenFlags` from US2 data, until US5 fills agreements)
- [X] T074 [P] [US4] Create `apps/web/src/lib/components/MessageList.svelte`: renders messages (text, contact shared, call proposed/accepted with accept button); when JavaScript is available, opens an `EventSource` to `./live`, appends new messages without animation, does not scroll if the member has scrolled up, and announces each new message in an `aria-live="polite"` region
- [X] T075 [US4] Build `apps/web/src/routes/messages/` (conversation list with unread marked by text, not colour alone), `apps/web/src/routes/messages/start/` (`default` action creating or reusing a conversation, then redirect), and `apps/web/src/routes/messages/[id]/` (`send`, `proposeCall` with native date and time inputs, `acceptCall`; marks read on open; "Check for new messages" link as the no-JavaScript fallback)
- [X] T076 [P] [US4] Build `apps/web/src/routes/messages/[id]/share-contact/` (choose phone and/or email from my saved details, review exactly what will be shown, confirm)
- [X] T077 [P] [US4] Add the live proxy `apps/web/src/routes/messages/[id]/live/+server.ts` that opens the API's SSE stream with the member's token and streams it to the browser unchanged
- [X] T078 [US4] Show the quiet unread count on the home page and in the navigation from `GET /me/summary` in `apps/web/src/routes/+layout.server.ts` and `apps/web/src/routes/+page.svelte` (text count, no badges that pulse)

**Security review**: contact sharing, participant checks, and the live stream.

**Checkpoint**: US4 works on its own; T065–T067 pass.

---

## Phase 7: User Story 5 - Record what was agreed (Priority: P2)

**Goal**: Owners record agreements; listings update automatically; the other member confirms or disputes; loans get one reminder and can be marked returned.

**Independent Test**: Owner records giving 2 kg of 5 kg rice → 3 kg left; records a loan due yesterday → one reminder each after two reminder runs; marking returned makes the drill available; recording 3 service sessions closes the listing.

### Tests for User Story 5 ⚠️

- [X] T079 [P] [US5] Contract tests in `apps/api/src/routes/agreements.test.ts`: only the owner records; `otherMemberId` ≠ owner; outcome follows listing type; Gift/Trade amount required when the listing has an amount and must be ≤ remaining (`409 not_enough_remaining`); two concurrent agreements cannot over-allocate; Lend requires `returnDue` and sets `lent_out`; Service `sessions` defaults to 1 and closes at 0 remaining; listings without an amount close; confirm/dispute only by the other member; `returned` only by the owner and only for loans; notifications sent; the owner can cancel only a `pending` agreement, which restores `remaining`/`sessions_remaining` and `available` status, clears `closed_reason`, and notifies the other member; the other member cannot cancel
- [X] T080 [P] [US5] Tests in `apps/api/src/modules/reminders.test.ts`: overdue unreturned loans get exactly one reminder to each member across repeated runs; returned loans get none; two concurrent runs send once (advisory lock)
- [X] T081 [P] [US5] End-to-end test in `apps/web/tests/e2e/us5-agree.spec.ts` covering quickstart scenario 6 with axe scans

### Implementation for User Story 5

- [X] T082 [P] [US5] Define `agreement` in `apps/api/src/db/schema/agreements.ts`: `listing_id`, `owner_id`, `other_member_id` ("≠ owner"), `outcome` ("`lent`, `gifted`, `traded`, `provided`; set from the listing's `type`"), `amount` ("Gift/Trade with an amount: required, ≤ listing `remaining`. Lend: null; a loan covers the whole listing. Service: null"), `sessions` ("Service only; default 1; ≤ listing `sessions_remaining` when that is set"), `return_due` ("date, nullable"; "Required when `outcome = lent`"), `returned_at`, `reminder_sent_at`, `confirmation` ("`pending` → `confirmed` / `disputed`"), `note` ("text, ≤500 chars"); generate the migration — `confirmation` also allows `cancelled` ("only the owner cancels, only while `pending`")
- [X] T083 [P] [US5] Add agreement schemas in `packages/shared/src/schemas/agreements.ts` (`CreateAgreement`, `Agreement`, `AgreementCandidate`)
- [X] T084 [US5] Implement `apps/api/src/modules/agreements.ts`: `listCandidates` (members who messaged about the listing), `recordAgreement` (one transaction with `SELECT … FOR UPDATE` on the listing; apply "Effects on listing" from data-model.md exactly; notify the other member with `type = "agreement"`), `confirm`, `dispute` (notifies the owner), `markReturned` (listing back to `available`), `listMine` (given, received, lent, borrowed, provided), `get` (parties and, later, mediators); `cancelAgreement` (owner, pending only; reverses the listing effects in the same locked transaction; notifies the other member with `type = "agreement"`)
- [X] T085 [US5] Implement `apps/api/src/modules/reminders.ts` (`runReminders()`: `pg_try_advisory_lock`, select loans with `return_due` before today, `returned_at` null, `reminder_sent_at` null; notify owner and borrower with `type = "reminder"`; set `reminder_sent_at`), add it to the hourly job in `apps/api/src/index.ts` (started in T036), and add `apps/api/scripts/reminders-once.ts`
- [X] T086 [US5] Add routes in `apps/api/src/routes/agreements.ts` (`GET /listings/{id}/agreement-candidates`, `POST /listings/{id}/agreements`, `GET /me/agreements`, `GET /agreements/{id}`, `POST /agreements/{id}/confirm|dispute|returned`) and mount them; extend `GET /me/summary` with `agreementsNeedingAttention` (pending confirmations for me + my overdue loans) — include `POST /agreements/{id}/cancel`
- [X] T087 [US5] Build `apps/web/src/routes/listings/[id]/agreements/new/` (choose a member from candidates; amount field for Gift/Trade with an amount, native date input for Lend, sessions number for Service; review and confirm)
- [X] T088 [P] [US5] Build `apps/web/src/routes/agreements/` (history grouped as given, received, lent, borrowed, provided; overdue loans noted in calm text) and `apps/web/src/routes/agreements/[id]/` (`confirm`, `dispute`, `returned` actions) — owner also sees `cancel` while the agreement is pending, with a confirmation step
- [X] T089 [US5] Add "Record an agreement" to the owner's view in `apps/web/src/routes/listings/[id]/+page.svelte` and the agreements count to the home page in `apps/web/src/routes/+page.svelte`

**Checkpoint**: US5 works; T079–T081 pass.

---

## Phase 8: User Story 6 - Ask for help when something goes wrong (Priority: P3)

**Goal**: Either party reports a problem; the reported member's inviter mediates in a shared conversation; escalation goes up the chain once, then to the founders; reports can stay open; nobody is ever penalised.

**Independent Test**: Owner reports an unreturned drill; the borrower's inviter is notified and joins a three-way conversation; escalating adds the founders; escalation is then no longer offered; the borrower's access is unchanged.

### Tests for User Story 6 ⚠️

- [X] T090 [P] [US6] Contract tests in `apps/api/src/routes/reports.test.ts`: only parties can report; `description` 1–2000 chars; the nearest active inviter of the reported member joins and is notified; first escalation adds the inviter's nearest active inviter, or goes straight to `founders` if that would be a founder or nobody; second escalation adds all active founders; a third → `409 already_at_founders`; resolve requires `outcomeNote` (≤1000 chars); reports never change the reported member's access
- [X] T091 [P] [US6] End-to-end test in `apps/web/tests/e2e/us6-problem.spec.ts` covering quickstart scenario 7 with axe scans

### Implementation for User Story 6

- [X] T092 [P] [US6] Define `problem_report` in `apps/api/src/db/schema/reports.ts`: `agreement_id`, `reporter_id` ("A party to the agreement"), `reported_member_id`, `description` ("text, 1–2000 chars"), `escalation_level` ("`inviter` → `inviters_inviter` → `founders`"), `status` ("`open` → `resolved`; may stay open indefinitely"), `outcome_note` ("text, ≤1000 chars, nullable"; "Required to resolve"), `resolved_by_id`; add the foreign key from `conversation.problem_report_id`; generate the migration
- [X] T093 [P] [US6] Add report schemas in `packages/shared/src/schemas/reports.ts` (`CreateReport`, `ResolveReport`, `ProblemReport`)
- [X] T094 [US6] Implement `apps/api/src/modules/reports.ts`: `nearestActiveInviter(memberId)` (skips deleted members), `createReport` (creates report and a mediation conversation with reporter, reported member, and mediator; system message explaining what happens next; notify with `type = "report"`), `escalate` (rules above), `resolve`, `get`; no code path may change membership or access
- [X] T095 [US6] Add routes `POST /agreements/{id}/reports` (in `apps/api/src/routes/agreements.ts`) and `GET /reports/{id}`, `POST /reports/{id}/escalate|resolve` in `apps/api/src/routes/reports.ts`; let mediators read the agreement via `GET /agreements/{id}`
- [X] T096 [P] [US6] Build `apps/web/src/routes/agreements/[id]/report/` (describe the problem in plain words, review, confirm)
- [X] T097 [P] [US6] Build `apps/web/src/routes/reports/[id]/` (who is helping, link to the conversation, `escalate` action hidden once founders are involved, `resolve` action requiring an outcome note, calm wording that a report can stay open)

**Checkpoint**: All six user stories work independently; T090–T091 pass.

---

## Phase 9: Notifications, Devices, Export, and Account Deletion (cross-cutting)

**Purpose**: FR-031, FR-031a, FR-032. These serve every story, so they come after the stories they notify about.

- [X] T098 [P] Contract tests in `apps/api/src/routes/me-settings.test.ts`: notification preferences default to email off / device off (or email on for all types if the join checkbox was ticked) and save per type and channel; push subscriptions can be added and removed only by their owner; export ZIP contains `my-wunan-data.json`, `README.txt`, and the member's photos, and other members appear by display name only; `DELETE /me` requires the password, clears personal data, removes listings, photos, and push subscriptions, keeps the display name and shows "<name> (no longer a member)", keeps agreements visible to the other party, and revokes the token
- [X] T099 [P] Add schemas in `packages/shared/src/schemas/settings.ts` (`NotificationPreferences`, `PushSubscription` with `platform: "web"`, `DeleteAccount`)
- [X] T100 Implement `GET`/`PUT /me/notification-preferences` in `apps/api/src/routes/me.ts` (five types × email/device)
- [X] T101 Build `apps/web/src/routes/settings/notifications/` (`save` action with an email and a device switch per type, listing of devices with "Remove")
- [X] T102 [P] Define `push_subscription` in `apps/api/src/db/schema/notifications.ts`: `platform` ("`web` now; other values (e.g., `unifiedpush`) reserved for future native clients"), `endpoint` ("text, unique"), `p256dh`, `auth` ("text, nullable"; "required for `web`"), `label`; generate the migration
- [X] T103 Implement `apps/api/src/notify/push.ts` with `web-push` and the VAPID env vars (silent payload `{ title, body, url }` per [contracts/notifications.md](contracts/notifications.md); delete the subscription when the push service answers 404/410) and wire it into `sendPush` in `apps/api/src/notify/index.ts`
- [X] T104 Add `POST /me/push-subscriptions` and `DELETE /me/push-subscriptions/{id}` to `apps/api/src/routes/me.ts`
- [X] T105 [P] Add `apps/web/static/manifest.webmanifest` and icons in `apps/web/static/icons/`, and `apps/web/src/service-worker/index.ts` (cache the app shell for installability; on `push`, show the notification with `silent: true` and no vibration; on click, open `url`)
- [X] T106 Add the "Turn on notifications on this device" flow to `apps/web/src/routes/settings/notifications/+page.svelte` (explains plainly what will happen, asks the browser for permission only after the click, subscribes with the VAPID public key) and the forwarding endpoints `apps/web/src/routes/settings/notifications/device/+server.ts` and `device/[id]/+server.ts`
- [X] T107 Implement `apps/api/src/modules/export.ts` with fflate per [contracts/export-format.md](contracts/export-format.md) and add `GET /me/export` in `apps/api/src/routes/me.ts`; add the download proxy `apps/web/src/routes/settings/export/+server.ts` and a button on the settings page
- [X] T108 Implement `deleteAccount` in `apps/api/src/modules/members.ts` (verify password; list open loans first; clear personal fields and contact details except `display_name`; delete listings, photos, push subscriptions, and sessions; set `deleted_at`) and `DELETE /me` in `apps/api/src/routes/me.ts`
- [X] T109 Build `apps/web/src/routes/settings/delete-account/` (explains what happens, lists open loans, password confirmation, then signs out)

**Security review**: push subscriptions, export, and account deletion.

**Checkpoint**: T098 passes; quickstart scenarios 5 and 9 pass by hand.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Self-hosting, documentation, audits, and final validation

- [ ] T110 [P] Write `apps/api/Dockerfile` and `apps/web/Dockerfile` (multi-stage, non-root user, production deps only)
- [ ] T111 Write `compose.yaml` (services `api`, `web`, `postgres`, `caddy`; volumes for database, photos, and Caddy data; API health check on `/api/v1/health`; web depends on a healthy API; the API's port is never published, so it is reachable only through Caddy and the web app; the web service sets `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH=1`) and `Caddyfile` (automatic HTTPS for `SITE_URL`; `/api/*` → api; everything else → web)
- [ ] T112 [P] Write `docs/operator.md`: requirements, `.env` variables and how to generate `BETTER_AUTH_SECRET` and VAPID keys, first start, `create-founder`, backups (`pg_dump` + photos volume) and restore, updates, logs; encrypted-storage requirement for the database, photos, and backups; how to generate and back up `DATA_ENCRYPTION_KEY` (losing it makes contact details unreadable); encrypted backups with `age`
- [ ] T112a [P] Write `CONTRIBUTING.md` with the dependency routine (constitution VII): add a root `audit` script (`npm audit --omit=dev`) to `package.json`; run `npm audit` and `npm outdated` monthly and before each release; apply security fixes within a week; update one exact-pinned version at a time and run `npm run check`, `npm test`, and `npm run test:e2e`; any new dependency needs the maintainer's approval first; link it from `docs/operator.md` under updates
- [ ] T113 [P] Add an OpenAPI completeness test in `apps/api/src/openapi.test.ts` that checks every endpoint listed in [contracts/api.md](contracts/api.md) appears in `/api/v1/openapi.json`
- [ ] T114 [P] Write `apps/api/scripts/seed-demo.ts` (development only; refuses to run when `NODE_ENV=production`) and confirm a filtered search over 5,000 members / 20,000 listings returns in under 2 seconds (SC-006)
- [ ] T114a [P] Write member help in plain language at `apps/web/src/routes/help/` (one short page per topic: Joining and invitations, Listing something, Finding things, Messages and sharing contact details, Recording an agreement, Asking for help, Notifications, Your data and leaving), and link "Help" from the navigation in `apps/web/src/routes/+layout.svelte` and from each related page
- [ ] T115 Accessibility pass across every page: run all Playwright axe scans in light and dark themes, then a manual keyboard-only and screen-reader walkthrough (VoiceOver or NVDA), 200% zoom and 320 px width checks per [quickstart.md](quickstart.md); fix everything found
- [ ] T115a Usability session (SC-001–SC-003): with 3–5 people who describe themselves as not confident with technology, on the seeded demo install, ask each to join from an invitation, publish a listing, find something, message about it, and record an agreement without help; time join (<3 min) and simple/full listing (<1 min / <5 min), note first-attempt success per task (target ≥90%), and record results and fixes in `docs/usability-test.md`
- [ ] T116 Calm-design pass: confirm no animations, autoplay, sound, or flashing anywhere (including copied shadcn-svelte components), one primary button per screen, and notification wording free of urgency
- [ ] T117 Final security review across the whole app (after the per-phase reviews) of the areas listed in plan.md (auth and invitation accept, bearer handling in web, photo upload, contact sharing, live stream, push subscriptions): check inputs, access checks, rate limits, CSP, cookie flags, and that logs contain no personal data; record findings and fixes in `docs/security-review.md`
- [ ] T118 Run the full [quickstart.md](quickstart.md) validation, including the API independence check with `curl` and the self-hosting check with `docker compose up -d --build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup; blocks all stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after Foundational (independent of US1: test members come from the test helpers)
- **US3 (Phase 5)**: after US2 (needs the listing table and listing pages)
- **US4 (Phase 6)**: after Foundational; "Message about this" links appear once US2 exists, but conversations work without a listing
- **US5 (Phase 7)**: after US2 and US4 (agreements are recorded on listings with members who messaged about them)
- **US6 (Phase 8)**: after US5 (reports are raised on agreements)
- **Phase 9**: after the stories whose notifications it configures (at least US2 and US4); export and deletion read every table, so finish after US6
- **Polish (Phase 10)**: after all desired stories

### Within Each Story

- Tests first, confirmed failing
- Schema → shared schemas → module → routes → web pages
- Story checkpoint before moving on

### Parallel Opportunities

- Setup: T002–T006, T008, T009 in parallel after T001
- Foundational: T012, T013, T016, T017 in parallel after T011; T024, T025, T028, T029, T030 in parallel once T021 is done
- Each story's tests marked [P] run in parallel; schema and shared-schema tasks marked [P] run in parallel; web pages marked [P] run in parallel once their API routes exist
- After Foundational, US1, US2, and US4 can be built in parallel by different people

---

## Parallel Example: User Story 2

```bash
# Tests together:
Task: "Contract tests in apps/api/src/routes/listings.test.ts"
Task: "Contract tests in apps/api/src/routes/photos.test.ts"
Task: "End-to-end test in apps/web/tests/e2e/us2-list.spec.ts"

# Schemas together:
Task: "Define listing, listing_photo, listing_flag in apps/api/src/db/schema/listings.ts"
Task: "Add listing schemas in packages/shared/src/schemas/listings.ts"

# Web pieces together (after T051):
Task: "Display helpers in apps/web/src/lib/format.ts"
Task: "ListingCard and PhotoPicker components"
Task: "Edit and my-listings pages"
Task: "Photo proxy route"
```

---

## Implementation Strategy

### MVP First (US1–US3)

1. Phase 1 Setup → Phase 2 Foundational
2. US1 (join and trust chain) → validate
3. US2 (list) → validate
4. US3 (find) → validate. **Stop and demo**: members can join, list, and find; they arrange details outside wunan until US4.

### Incremental Delivery

5. US4 (messages) → validate → demo
6. US5 (agreements and reminders) → validate → demo
7. US6 (problem reports) → validate
8. Phase 9 (notification settings, device notifications, export, deletion)
9. Phase 10 (self-hosting, audits, quickstart)

---

## Notes

- [P] = different files, no dependency on unfinished tasks
- Commit after each task or logical group
- Stop at any checkpoint to validate a story on its own
- Never add a dependency outside the approved list; ask first
