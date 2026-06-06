# Contract: Backend API v1

The backend (`apps/api`) is the single source of truth for wunan. The web app uses only these
endpoints, and future clients (e.g., an Android app) use the same ones. The machine-readable version
is generated from the code at `GET /api/v1/openapi.json`; this file is the human summary.

This is the full contract after feature 002 (proposals); it replaces
[001's](../../001-community-resource-sharing/contracts/api.md). Nothing is in production, so the
changes stay in v1.

## Conventions

- **Base path**: `/api/v1`. Breaking changes go to `/api/v2`; additive changes stay in v1.
- **Auth**: `Authorization: Bearer <session token>` on every endpoint except those marked
  **public**. Missing or invalid token → `401`. Deleted members' tokens are revoked.
- **Format**: JSON request and response bodies (`application/json`), except photo upload
  (`multipart/form-data`), photo download (image), export (ZIP), and live (Server-Sent Events).
- **Errors**: `{ "error": { "code": "snake_case_code", "message": "Plain-language sentence safe to show users." } }`
  with `400` validation (adds `"fields": { "title": "Please add a title." }`), `401`, `403`, `404`
  (also used instead of 403 when revealing existence would leak information), `409` conflict,
  `413` too large, `429` slow down.
- **Pagination**: list endpoints take `?cursor=` and `?limit=` (default 20, max 50) and return
  `{ "items": [...], "nextCursor": "…" | null }`.
- **IDs**: UUID strings. **Times**: ISO 8601 UTC. **Amounts**: decimal strings (e.g., `"2.5"`).
- **Field names and rules**: as in [data-model.md](data-model.md) and the
  [001 data model](../../001-community-resource-sharing/data-model.md), in camelCase.
- **Places**: a place object per data-model "Place". Listing places are returned as `{ display }`
  unless the caller is the owner or a requester whose proposal on it was accepted.

## Authentication (Better Auth, `/api/auth`)

Better Auth's own errors are rewritten into the error shape above with plain-language messages, so
every endpoint, including these, fails the same way (e.g., Better Auth's `EMAIL_NOT_VERIFIED` →
`email_not_confirmed`).

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `POST /api/auth/sign-in/email` | public | `{ email, password }` → session + token in `set-auth-token` header. One generic error for any failure, except a correct password on an unconfirmed account → `403 email_not_confirmed` ("Please open the confirmation link we emailed you."). Rate-limited. |
| `POST /api/auth/sign-out` | member | Revokes the session. |
| `POST /api/auth/request-password-reset` | public | `{ email, redirectTo }` → always the same success response. |
| `POST /api/auth/reset-password` | public | `{ token, newPassword }`; single-use, 1-hour token. |
| `GET /api/auth/get-session` | member | Current session and member id. |
| `POST /api/auth/sign-up/email` | — | Disabled; always refused. Use invitation accept below. |

## Invitations and members

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /invitations/{token}` | public | `{ valid: true, inviterName }` (also while waiting for confirmation, so sign-up can start over) or `404 invitation_not_valid` (used, expired, cancelled, or unknown; same response). |
| `POST /invitations/{token}/accept` | public | `{ email, displayName, password, emailNotifications }` → deletes any unconfirmed account for that email whose hold has passed, and any earlier unconfirmed account on this invitation, creates an unverified account, reserves the invitation for 7 days, sends a confirmation email; returns `202 { status: "check_your_email" }`. `409 email_taken` if the email belongs to a confirmed account or one still within its hold. Rate-limited: 5 attempts per invitation per day and 10 per IP address per hour (`429 slow_down`). |
| `POST /invitations/confirm` | public | `{ token }` from the confirmation email → verifies the email, marks the invitation used, returns a session token. Expired or used → `404 confirmation_not_valid`. |
| `POST /invitations/resend-confirmation` | public | `{ email }` → sends a fresh confirmation link if that email has an unconfirmed account within its hold; the hold is not extended. Always `202` with the same response. Rate-limited (3 per hour per email). |
| `POST /invitations` | member | Creates an invitation; returns `{ id, link, expiresAt }`. The raw link is returned only here. |
| `GET /me/invitations` | member | My invitations and statuses. |
| `POST /invitations/{id}/cancel` | inviter | Cancels an unused invitation. |
| `GET /members/{id}` | member | `{ id, displayName, bio, joinedAt, isFounder, invitedBy: {id, displayName} \| null, invitees: [...], isFormerMember }`. Never includes email or contact details. |
| `GET /members/{id}/chain` | member | Ordered list from this member up to a founder. |
| `GET /me`, `PATCH /me` | member | My profile (`displayName`, `bio`). |
| `GET /me/contact`, `PUT /me/contact` | member | My private `sharePhone`, `shareEmail`. |
| `POST /me/password` | member | `{ currentPassword, newPassword }`. |
| `GET /me/notification-preferences`, `PUT /me/notification-preferences` | member | `[{ type, email, device }]` for the five types. |
| `GET /me/push-subscriptions` | member | `{ publicKey, devices: [{ id, label, createdAt }] }`. `publicKey` (VAPID) is null when the operator has not set up device notifications. |
| `POST /me/push-subscriptions` | member | `{ platform: "web", endpoint, keys: { p256dh, auth }, label }` → `201`. Only endpoints on browser push services (HTTPS). If no kind had devices turned on yet, turns devices on for all five, so turning on a device is one step. Other platforms reserved for future clients. |
| `DELETE /me/push-subscriptions/{id}` | member | Removes a device. |
| `GET /me/export` | member | ZIP per [export-format.md](export-format.md). 10 per member per hour (`429 slow_down`). |
| `DELETE /me` | member | `{ password }` → `204 No Content`. Effects per research §16. Password checks (here and `POST /me/password`) are limited to 10 per member per hour. |
| `GET /me/summary` | member | Quiet home counts: `{ proposalsWithNews, agreementsNeedingAttention, unseenFlags }`. |

## Listings

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /listings` | member | Search. Query: `q`, `type` (one or more of `lend`/`gift`/`trade`/`service`, comma-separated; none = all), `area` (matches neighbourhood, city, or display text), `includeLent`, `cursor`, `limit`. Available, not-lent-out listings only by default. Each item has `lentOut` (bool). |
| `POST /listings` | member | Create. Body is a discriminated union on `type` (fields per data-model): adds `handovers`, `area` and `meetingPlace` (place objects), `accepts` (Trade, ≤10 `{ description, amount?, unit? }`), `availability` (Service, ≤14 `{ weekday, startTime, endTime }`). Only `type` and `title` required; `area` required with `at_lister`, `meetingPlace` with `elsewhere`. |
| `GET /listings/{id}` | member | Full listing with photos (`alt`, `url`), owner and owner's inviter, `handovers`, places (per Conventions), `accepts`, `availability`, `lentOut`, and for Lend `takenPeriods: [{ startsAt, endsAt, overdue }]`. Caller's own open proposal id as `myOpenProposalId`. Owner also gets `flags` and `openProposalCount`. |
| `PATCH /listings/{id}` | owner | Edit fields; `type` cannot change. `accepts` and `availability` are replaced as a whole. |
| `POST /listings/{id}/pause`, `/resume`, `/remove`, `/reopen` | owner | Status changes. `reopen` only when `closedReason = removed` (001 FR-013b). Open proposals stay open (they can't be accepted while the listing isn't available). |
| `POST /listings/{id}/photos` | owner | Multipart `file`, optional `alt`. ≤6 per listing, ≤10 MB, images only (`413`, `400 not_an_image`). |
| `PATCH /listings/{id}/photos/{photoId}` | owner | `{ alt, position }`. |
| `DELETE /listings/{id}/photos/{photoId}` | owner | Deletes the photo. |
| `GET /photos/{key}` | member | Image bytes, `Cache-Control: private`. |
| `POST /listings/{id}/flags` | non-owner | `{ request }`; notifies the owner. Listing unchanged. |
| `GET /me/listings` | member | My listings by status, with unseen flag counts. |

## Places

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /places` | member | `?q=` (3–100 chars) → `{ items: [place] }`, up to 8 suggestions from the operator's place service (research §1). `503 places_unavailable` when it's off, failing, or slow; clients then keep plain text. 60 per member per minute. |

## Proposals

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `POST /listings/{id}/proposals` | non-owner | Body: discriminated union on the listing's type, every detail optional: `date` (YYYY-MM-DD) and `time` (HH:MM) in the community time zone, `handover`, `place`, `loanLength`+`loanLengthUnit` (Lend), `amount` (Gift/Trade; defaults to `remaining`), `offers: [{ acceptId, amount? }]` or `ownOffer`+`ownOfferAmount?`+`ownOfferUnit?` (Trade), `sessionLength`+`sessionLengthUnit`, `sessions` (Service), plus optional first `message`. Values that don't fit the listing (e.g., a loan longer than the maximum, a time outside the service's hours, a place outside the area, more than remains) are saved and reported in the proposal's `issues`, which block acceptance until settled (research §3). Only malformed input is refused with `400` and `fields`: details that don't apply to the type, half-given pairs (a length without its unit), and `offers` whose `acceptId` isn't one of the listing's accepted things. Listing must be available (Lend: may be lent out). `409 proposal_exists` with `{ proposalId }` if the caller already has an open one. → `201 { id, conversationId }`. Notifies the lister (`message` type). |
| `GET /proposals` | member | `?role=requester\|lister`, `?status=open\|ended`, paginated. Items: `{ id, listing: { id, title, type }, otherMember, status, issuesCount, unread, lastActivityAt, lastMessagePreview }`. |
| `GET /proposals/{id}` | requester, lister; mediators only via report sharing | `{ id, status, closedReason, version, listing (summary, places per Conventions), requester, lister, details (with `place` resolved: listing area for `at_lister`), offers, issues: [{ field, message }], areaUnchecked, earlierLoanNotBack (Lend: `{ endsAt }` when an earlier loan is past its end and not marked returned, else null), canAccept, canEdit, conversationId, agreementId, decisionNote }`. |
| `PATCH /proposals/{id}` | requester, while open | Same fields and the same rules as create (null clears a detail; misfit values become `issues`, not `400`). Bumps `version`; posts a `detail_changed` message listing each change; notifies the lister. Unchanged values are ignored. |
| `POST /proposals/{id}/accept` | lister | `{ version }`. `409 proposal_changed` if the version differs (response includes the current proposal). `409 proposal_not_ready` with `issues` if any remain. Creates the agreement atomically (listing row locked; loans checked for overlap, database exclusion as backstop → `409 dates_taken`). Updates the listing; if nothing is left, closes other open proposals (`nothing_left`) and notifies their requesters; for other proposals now over the remaining amount or overlapping, notifies their requesters. → `{ agreementId }`. Notifies the requester (`agreement` type). |
| `POST /proposals/{id}/decline` | lister, while open | `{ note? }` → `declined`; thread read-only; notifies the requester. |
| `POST /proposals/{id}/withdraw` | requester, while open | `{ note? }` → `withdrawn`; thread read-only; notifies the lister. |

## Threads (proposal and report messages)

A thread belongs to one proposal or one problem report (`conversationId` from those endpoints).
There is no inbox and no way to start a thread directly.

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /conversations/{id}/messages` | participant; mediators read-only once a report shares the proposal's messages | Newest first, paginated. Kinds: `text`, `contact_shared`, `call_proposed`, `call_accepted`, `detail_changed`, `accepted`, `declined`, `withdrawn`, `closed`, `messages_shared`, `system`. |
| `POST /conversations/{id}/messages` | participant | `{ body }`. Rate-limited. `409 thread_closed` once its proposal is declined, withdrawn, or closed. Updates the proposal's `lastActivityAt`. |
| `POST /conversations/{id}/read` | participant | Marks read. |
| `POST /conversations/{id}/contact-share` | participant | `{ phone: bool, email: bool }` → posts a `contact_shared` message with exactly those details. |
| `POST /conversations/{id}/calls` | participant | `{ proposedTime }` → `call_proposed` message. |
| `POST /conversations/{id}/calls/{messageId}/accept` | other participant | → `call_accepted` message. |
| `GET /conversations/{id}/live` | participant | Server-Sent Events: event `message` with the same JSON as the messages list (detail changes included, so an open proposal page refreshes its details). Heartbeat comment every 25 s. Closes if access is lost. |

## Agreements and problem reports

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /me/agreements` | member | Given, received, lent, borrowed, provided. |
| `GET /agreements/{id}` | party, mediator | Details (when, handover, full place, loan period, amount, sessions, offer), `proposalId`, reports. |
| `POST /agreements/{id}/returned` | owner | Loans only; frees the loan's remaining period. |
| `POST /agreements/{id}/reports` | party | `{ description }` → report + mediation thread with the reported member's inviter. |
| `GET /reports/{id}` | reporter, reported, mediators | Report, escalation level, `conversationId`, `proposalMessagesShared` (bool), and `proposalConversationId` when shared. |
| `POST /reports/{id}/share-proposal-messages` | reporter, reported member | Lets the report's mediators read the agreement's proposal thread; posts `messages_shared` in the report thread. Can't be undone; `409 already_shared` the second time. |
| `POST /reports/{id}/escalate` | reporter, current mediator | Next step; `409 already_at_founders` once founders are involved. |
| `POST /reports/{id}/resolve` | reporter, mediator | `{ outcomeNote }`. |

### Removed from 001

`GET /conversations`, `POST /conversations`, `GET /listings/{id}/agreement-candidates`,
`POST /listings/{id}/agreements`, `POST /agreements/{id}/confirm`, `/dispute`, `/cancel`.

## Meta

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /openapi.json` | public | Generated OpenAPI 3.1 document. |
| `GET /health` | public | `{ ok: true }` when the database is reachable (for Docker health checks). |
