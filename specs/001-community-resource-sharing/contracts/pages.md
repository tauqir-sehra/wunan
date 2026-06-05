# Contract: Web App Pages and Form Actions

The pages of the web app (`apps/web`). Each SvelteKit route lists its page, its form actions
(`?/name`, POST), and who may use it. Unless marked **public**, every route requires a signed-in,
non-deleted member; otherwise it redirects to `/sign-in`. Form actions are protected by SvelteKit's
origin check and validated with the shared Zod schemas.

The web app holds no business rules and no database access: every page load and form action calls
the backend API ([api.md](api.md)) server-side with the member's bearer token, which it keeps in an
`HttpOnly` cookie. API error messages are shown to the member as-is (they are written in plain
language).

Every page has one clear primary action, plain-language errors that say what to do next, and a
confirmation step before anything that can't be undone (constitution II). Every action works
without JavaScript.

## Accounts and invitations

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/sign-in` | `signIn`, `resendConfirmation` | public | Email + password. One generic error for any failure, except a correct password on an unconfirmed account: "Please open the confirmation link we emailed you." with a "Send it again" button (`resendConfirmation`). Rate-limited by Better Auth. |
| `/sign-out` | `default` | member | Ends session. |
| `/password-reset` | `default` | public | Always: "If that email is registered, we've sent a link." |
| `/password-reset/[token]` | `default` | public | Single-use, 1-hour link; set new password. |
| `/join/[token]` | `join`, `resend` | public | Valid invite → sign-up (email, display name, password, and an optional unticked checkbox "Email me when someone messages me or something needs my attention" with one sentence on what it's for). Invalid/used/expired → plain message to ask the inviter for a new link. Success → "Check your email" page: "We've emailed a link to <email>. The link works for 7 days.", with "Send it again" and "Wrong email? Start again" (back to this form). |
| `/join/confirm/[token]` | `confirm` | public | Opened from the confirmation email; one "Finish joining" button confirms and signs in, then goes home (a button, so email link-scanners can't use up the one-time link). Expired → if the invitation is still valid, "This link has run out. Use your invitation link again."; otherwise "Ask the person who invited you for a new link." |
| `/invitations` | `create`, `cancel` | member | Lists my invitations; `create` shows the link once with a "Copy link" button; `cancel` asks to confirm. |
| `/members/[id]` | — | member | Profile: name, bio, joined, "Invited by" (linked) or "Founding member", people they invited, available listings. Deleted → "<name> (no longer a member)". |
| `/members/[id]/chain` | — | member | Invite chain up to a founder. |
| `/settings` | `profile`, `contact`, `password` | member | Edit profile, private contact details, password. |
| `/settings/notifications` | `save`, `removeDevice` | member | Email and device switches per type. "Turn on notifications on this device" button (needs JS; explains plainly what will happen first). Lists devices with "Remove". |
| `/settings/export` | — | member | Explains the export; "Download my data" links to `/settings/export/download`. |
| `/settings/delete-account` | `default` | member | Explains effects, lists open loans, password required to confirm; then signs out and goes to `/goodbye`. |
| `/goodbye` | — | public | "Your account is deleted". |

## Listings and search

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/` | — | member | Home: search box, Lend / Gift / Trade / Service links, quiet counts of unread messages and items needing attention (updated on reload). |
| `/listings` | — | member | Search. Query: `q`, `type` (`lend`/`gift`/`trade`/`service`), `area`, `include_lent`. Active filters shown with "Clear filters". Calm empty state. |
| `/listings/new` | `next`, `back`, `publish` | member | Step 1: choose Lend, Gift, Trade, or Service. Step 2: title, description, amount + unit (unit from a list; not for Service), and the type's own fields: max loan length (Lend); what's wanted / "Open to offers" (Trade); session length and number of times available (Service). Step 3: area. Step 4: photos and review (photos are on the last step because files can't be carried between steps without JavaScript). Only type and title required. |
| `/listings/[id]` | `pause`, `resume`, `remove`, `reopen` (owner); `flag` (others) | member | Full details, photos with alt text, owner and their inviter. "Message about this" for others. Owner sees flags received and "Record an agreement". |
| `/listings/[id]/edit` | `save`, `addPhotos`, `updatePhoto`, `deletePhoto` | owner | Edit fields; photos ≤6, ≤10 MB, images only. |
| `/my-listings` | — | member | My listings by status, with flags received. |

## Messages

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/messages` | — | member | My conversations; unread shown by text and a subtle marker (not colour alone). |
| `/messages/start` | `default` | member | Input: `memberId`, optional `listingId`. Reuses an existing conversation for the same pair + listing. |
| `/messages/[id]` | `send`, `proposeCall`, `acceptCall` | participant | Conversation, marked read on open. New messages appear live (below). |
| `/messages/[id]/share-contact` | `default` | participant | Choose phone/email; review exactly what will be shown; confirm. |
| `/messages/[id]/live` | GET endpoint (Server-Sent Events) | participant | Passes through the API's live stream for this conversation (FR-018a). |

## Agreements and problems

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/listings/[id]/agreements/new` | `review`, `record` | owner | Choose the member (from people who messaged about this listing); amount (Gift/Trade with an amount), return date (Lend), or number of sessions (Service, default 1). Outcome follows the listing type. Updates the listing. |
| `/agreements` | — | member | My history: given, received, lent, borrowed; overdue loans noted calmly. |
| `/agreements/[id]` | `confirm`, `dispute` (other member); `returned`, `cancel` (owner; cancel only while pending) | party, mediator | Details, confirmation state, reports. |
| `/agreements/[id]/report` | `default` | party | Describe the problem; confirm; creates report + mediation conversation with the reported member's inviter. |
| `/reports/[id]` | `escalate`, `resolve` | reporter, mediators | Escalate to the next step (hidden once founders are involved). Resolve needs an outcome note. |

## Device notification endpoints

| Route | Method | Access | Behaviour |
|-------|--------|--------|-----------|
| `/settings/notifications/device` | POST (JSON, same-origin) | member | Forwards this browser's push subscription to `POST /api/v1/me/push-subscriptions`. |
| `/settings/notifications/device/[id]` | DELETE (same-origin) | member | Forwards to `DELETE /api/v1/me/push-subscriptions/{id}`. |

## Proxied resources

| Route | Access | Behaviour |
|-------|--------|-----------|
| `/photos/[key]` | member | Streams `GET /api/v1/photos/{key}` so the browser's cookie session applies. |
| `/settings/export/download` | member | Streams `GET /api/v1/me/export` as a download. |

The browser never calls `/api/*` directly; that path is public only for future native clients.

## Help

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/help`, `/help/[topic]` | — | member | Plain-language help: Joining and invitations, Listing something, Finding things, Messages and sharing contact details, Recording an agreement, Asking for help, Notifications, Your data and leaving (constitution VI). |

## Error pages

- 403 / 404: plain message and a link home; never reveal whether a private resource exists.
- 500: plain apology and a link home; no technical details.
