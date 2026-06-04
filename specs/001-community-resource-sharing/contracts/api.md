# Contract: Backend API v1

The backend (`apps/api`) is the single source of truth for wunan. The web app uses only these
endpoints, and future clients (e.g., an Android app) use the same ones. The machine-readable version
is generated from the code at `GET /api/v1/openapi.json`; this file is the human summary.

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
- **Field names and rules**: as in [data-model.md](data-model.md), in camelCase.

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
| `POST /me/push-subscriptions` | member | `{ platform: "web", endpoint, keys: { p256dh, auth }, label }`. Other platforms reserved for future clients. |
| `DELETE /me/push-subscriptions/{id}` | member | Removes a device. |
| `GET /me/export` | member | ZIP per [export-format.md](export-format.md). |
| `DELETE /me` | member | `{ password }` → `204 No Content`. Effects per research §16. |
| `GET /me/summary` | member | Quiet home counts: `{ unreadConversations, agreementsNeedingAttention, unseenFlags }`. |

## Listings

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /listings` | member | Search. Query: `q`, `type` (`lend`/`gift`/`trade`/`service`), `area`, `includeLent`, `cursor`, `limit`. Available listings only by default. |
| `POST /listings` | member | Create. Body is a discriminated union on `type` (fields per data-model). Only `type` and `title` required (plus Trade's wanted-or-open rule). |
| `GET /listings/{id}` | member | Full listing with photos (`alt`, `url`), owner and owner's inviter. Owner also gets `flags`. |
| `PATCH /listings/{id}` | owner | Edit fields; `type` cannot change. |
| `POST /listings/{id}/pause`, `/resume`, `/remove`, `/reopen` | owner | Status changes. `reopen` only when `closedReason = removed` (FR-013b). |
| `POST /listings/{id}/photos` | owner | Multipart `file`, optional `alt`. ≤6 per listing, ≤10 MB, images only (`413`, `400 not_an_image`). |
| `PATCH /listings/{id}/photos/{photoId}` | owner | `{ alt, position }`. |
| `DELETE /listings/{id}/photos/{photoId}` | owner | Deletes the photo. |
| `GET /photos/{key}` | member | Image bytes, `Cache-Control: private`. |
| `POST /listings/{id}/flags` | non-owner | `{ request }`; notifies the owner. Listing unchanged. |
| `GET /me/listings` | member | My listings by status, with unseen flag counts. |

## Conversations and messages

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /conversations` | member | My conversations, each with `unread`, last message preview, listing title. |
| `POST /conversations` | member | `{ memberId, listingId? }` → existing conversation for that pair + listing, or a new one. |
| `GET /conversations/{id}/messages` | participant | Newest first, paginated. |
| `POST /conversations/{id}/messages` | participant | `{ body }`. Rate-limited. |
| `POST /conversations/{id}/read` | participant | Marks read. |
| `POST /conversations/{id}/contact-share` | participant | `{ phone: bool, email: bool }` → posts a `contact_shared` message with exactly those details. |
| `POST /conversations/{id}/calls` | participant | `{ proposedTime }` → `call_proposed` message. |
| `POST /conversations/{id}/calls/{messageId}/accept` | other participant | → `call_accepted` message. |
| `GET /conversations/{id}/live` | participant | Server-Sent Events: event `message` with the same JSON as the messages list. Heartbeat comment every 25 s. Closes if access is lost. |

## Agreements and problem reports

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /listings/{id}/agreement-candidates` | owner | Members who messaged about this listing. |
| `POST /listings/{id}/agreements` | owner | `{ otherMemberId, amount?, returnDue?, sessions?, note? }` per listing type. Updates the listing atomically; `409 not_enough_remaining` if over-allocated. |
| `GET /me/agreements` | member | Given, received, lent, borrowed, provided. |
| `GET /agreements/{id}` | party, mediator | Details, confirmation, reports. |
| `POST /agreements/{id}/confirm`, `/dispute` | other member | Sets confirmation. |
| `POST /agreements/{id}/returned` | owner | Loans only; listing becomes available. |
| `POST /agreements/{id}/cancel` | owner | Pending only; reverses the listing effects and notifies the other member (FR-024a). |
| `POST /agreements/{id}/reports` | party | `{ description }` → report + mediation conversation with the reported member's inviter. |
| `GET /reports/{id}` | reporter, reported, mediators | Report, escalation level, conversation id. |
| `POST /reports/{id}/escalate` | reporter, current mediator | Next step; `409 already_at_founders` once founders are involved. |
| `POST /reports/{id}/resolve` | reporter, mediator | `{ outcomeNote }`. |

## Meta

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /openapi.json` | public | Generated OpenAPI 3.1 document. |
| `GET /health` | public | `{ ok: true }` when the database is reachable (for Docker health checks). |
