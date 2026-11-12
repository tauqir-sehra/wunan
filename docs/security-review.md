# Security review log

Constitution III requires a security review before merging changes to authentication, data
storage, or input handling. Each entry lists what was checked, what was found, and what changed.

## US1: invitations, joining, sign-in, web session (2026-06-04)

**Scope**: `apps/api/src/auth.ts`, `modules/invitations.ts`, `modules/members.ts`,
`routes/invitations.ts`, `routes/members.ts`, `routes/me.ts`, `lib/rate-limit.ts`,
`lib/crypto.ts`; `apps/web/src/hooks.server.ts`, `lib/api.ts`, `lib/session.ts`,
`lib/form-action.ts`, `routes/sign-in`, `routes/join/*`, `routes/settings`.

**Checked**

| Area | Result |
|------|--------|
| Invitation and confirmation tokens | 32 random bytes; only SHA-256 hashes stored; confirmation tokens single-use and expire with the 7-day hold. |
| Account creation | Only via invitation (public sign-up route disabled and tested). Better Auth's `verify-email`, `update-user`, `change-email`, `delete-user`, `change-password` routes disabled so nothing bypasses wunan rules (tested). Unconfirmed accounts cannot sign in (tested). |
| Brute force and abuse | Sign-in 10 per 10 min and reset requests 5 per hour per visitor (Better Auth, stored in the database); sign-up 5 per invitation per day and 10 per visitor per hour; resend 3 per email per hour; invitations 20 per member per day. Per-visitor limits use the right-most `X-Forwarded-For` entry (tested with two addresses). |
| Enumeration | Wrong email and wrong password give the same error (tested); password reset and resend always give the same answer (tested). Accepted risk: sign-up with an existing email says so (`409 email_taken`), as the contract specifies; it needs a valid invitation link and is rate-limited. |
| Passwords | Better Auth's scrypt hashing; 10–128 characters; changing it requires the current password and signs out other devices (tested). |
| Private data | Profiles never include email or contact details (tested). Contact details encrypted with AES-256-GCM (tested: stored value is ciphertext; tampering is detected). |
| Web session | Bearer token kept only in the `wunan_session` cookie: `HttpOnly`, `Secure`, `SameSite=Lax`; never put in page data. Expired sessions clear the cookie. Redirect targets limited to same-site paths (`safeRedirectPath`). |
| Headers | CSP with per-request script nonce, `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`; HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `nosniff` (verified on a production build). |
| Logs | Request logs record the route pattern, never the raw path (which can contain tokens); a safety filter drops fields named like emails, tokens, passwords, bodies, or contact details. |
| CSRF | API uses bearer tokens only (no cookies). Web forms rely on SvelteKit's origin check; the web server sends the site's `Origin` to the API, which Better Auth checks against `trustedOrigins`. |

**Found and fixed**

1. *Change password signed out the current device too*: the bearer token is a signed form of
   the stored session token, so the comparison never matched. `requireMember` now keeps the real
   session token. Covered by `members.test.ts`.
2. *Passwords could be written into the page after a session expired*: the "sign in again" step
   kept every typed field as a hidden input, including password fields. Password fields are now
   excluded (the member types them again).

**Notes for later phases**: the API trusts `X-Forwarded-For` because it is reachable only through
Caddy and the web app; `compose.yaml` (T111) must not publish the API port.

## US2: offerings and photo upload (2026-06-04)

**Scope**: `apps/api/src/modules/offerings.ts`, `modules/photos.ts`, `routes/offerings.ts`,
`routes/photos.ts`, `app.ts` (body limits); `apps/web/src/routes/offerings/**`,
`routes/photos/[key]/+server.ts`.

**Checked**

| Area | Result |
|------|--------|
| Ownership | Every change (edit, status, photos) goes through `ownedOffering`, which refuses non-owners with 403 (tested). Flags can't target your own offering (tested). |
| Input | Offering fields validated by the shared Zod schema per type, with fields from other types refused (tested), plus matching database check constraints. Flags 1–500 characters, 10 per member per day. |
| Photo contents | The real format is read from the file's bytes; only photo formats are accepted, so SVG and non-images are refused (tested). `limitInputPixels` stops decompression bombs. |
| Photo size | Request bodies capped at 11 MB for uploads (1 MB for everything else); files over 10 MB refused with 413 (tested). At most 6 photos per offering (tested). |
| Metadata | Every photo is re-encoded as WebP, which drops EXIF including GPS (tested in the API and end to end with a real GPS-tagged JPEG). |
| Storage and serving | Files named by 16 random bytes; the key format is checked before touching the disk, so paths can't escape the photos folder (tested). Served only to signed-in members with `Cache-Control: private`, through the web app's proxy (tested). |

**Found and fixed**

1. *SVG files were accepted*: sharp can decode SVG, which is a document format rather than a
   photo. Uploads are now limited to photo formats by their actual contents.

**Notes for later phases**: deleting an offering's rows does not delete its photo files; account
deletion (T108) must call `deletePhotoFiles` for the member's photos.

## US4: messages, contact sharing, live stream (2026-06-04)

**Scope**: `apps/api/src/modules/messaging.ts`, `modules/live.ts`, `routes/conversations.ts`,
`routes/me.ts` (summary); `apps/web/src/routes/messages/**`, `lib/components/MessageList.svelte`,
`lib/sign-in.ts`.

**Checked**

| Area | Result |
|------|--------|
| Participant checks | Every read, send, share, call, and live-stream request goes through `requireParticipant`; anyone else gets "not found", so conversations can't be discovered (tested, including the live stream). |
| Contact sharing | Only details the member saved, only the ones they chose, after a review step that shows exactly what will appear; the message stores a snapshot (tested: the unchosen email never appears). Saved details stay encrypted at rest. |
| Message content | Shown with Svelte's normal escaping (no raw HTML), so a message can't run code. Up to 4000 characters; 60 messages per member per hour (tested). |
| Notifications | Only to members who turned them on, at most one per conversation per hour (tested); previews cut to 100 characters; members with the conversation open aren't notified. |
| Live stream | Requires a member token and participation; the web app proxies it with the member's session, so the browser never calls the API; the stream ends when the browser leaves and closes if the member's account is deleted. One shared database connection serves every stream. |

**Found and fixed**

1. *A busy API could sign members out*: the web app treated any failed "who is signed in?" check
   (for example a rate-limit answer) as "signed out" and deleted the session cookie. It now signs
   out only on a clear "no session"; other failures show the error page and keep the cookie.
   Better Auth's rate limit no longer applies to that check, which already needs a valid token.

**Accepted for now**: there is no cap on how many live streams one member opens at once. Each
holds one HTTP connection, not a database connection; revisit if it becomes a problem.

## Phase 9: notification settings, device notifications, export, leaving (2026-06-04)

**Scope**: `apps/api/src/modules/settings.ts`, `notify/push.ts`, `modules/export.ts`,
`modules/members.ts` (`deleteAccount`), `routes/me.ts`; `apps/web/src/routes/settings/**`,
`routes/goodbye`, `src/service-worker/`, `lib/same-origin.ts`, `static/manifest.webmanifest`.

**Checked**

| Area | Result |
|------|--------|
| Device addresses | The API only accepts push addresses on the browser makers' push services (Google, Mozilla, Apple, Microsoft), over HTTPS on the normal port, so it can't be told to send requests to other servers, including ones on the operator's network (tested). Addresses are never shown back to anyone. |
| Device ownership | Only the member who added a device can remove it; others get "not found" (tested). A browser that someone else turned on before moves to whoever turned it on last, so a shared computer never notifies the previous person. |
| Push contents | Only title, body (at most 100 characters, no exclamation marks) and a link to a page on this site, encrypted for the device with the operator's own keys (tested). Devices the push service reports as gone are deleted (tested). The service worker shows notifications silently and opens only paths on this site. |
| Permission | The browser is asked for notification permission only when the member presses the button (browser test counts the requests). |
| Device endpoints in the web app | JSON endpoints check that the request comes from this site and that a member is signed in; the API re-checks everything. |
| Service worker cache | Only the app's built files and icons; pages, messages and photos are never cached, because devices can be shared. |
| Export | Only the member's own data; other members by display name only, never their email, ids or private contact details (tested), except details they shared in a conversation with this member. Downloads are `no-store`. Limited to 10 an hour per member, as each export reads every photo. |
| Leaving | Needs the password; password checks (leaving and changing the password) are limited to 10 an hour per member, so a stolen session can't be used to guess it (tested). Removes the email (replaced, so it can join again), password, sessions on every device, bio, contact details, devices, notification settings, offerings and photo files, and password-reset links; cancels unused invitations (tested). |

**Found and fixed**

1. *Password guessing with a stolen session*: changing the password had no attempt limit. Both
   password forms now share a limit of 10 attempts an hour per member.
2. *Contact details left behind*: contact details a leaving member had shared in conversations
   stayed in those messages. They are now replaced with "Contact details were removed when this
   member left wunan." (tested).

**Decided**: an offering that is part of an agreement can't be deleted without breaking the other
member's agreement, so when its owner leaves it keeps only its title and kind, closed, with
description, area and photos removed. Messages, agreements, requests for help and requests about
offerings stay visible to the other members involved, as research §16 describes.

## Final review, whole app (2026-06-04)

**Scope**: the areas listed in plan.md (sign-in and invitation accept, bearer handling in the web
app, photo upload, contact sharing, live stream, push subscriptions), plus the self-hosting setup
(`apps/*/Dockerfile`, `compose.yaml`, `Caddyfile`).

**Checked**

| Area | Result |
|------|--------|
| Inputs | Every API body, query and path parameter is validated with the shared Zod schemas before use; unknown fields are refused where they would be ignored silently. The OpenAPI completeness test confirms every contract endpoint is described. |
| Access checks | Every `/api/v1` route except invitation check/accept/confirm, health and the OpenAPI document requires a member; owner, participant, party and mediator checks answer "not found" to others (tested per story). |
| Rate limits | Sign-in, password reset, joining, resending confirmation, invitations, messages, offering requests, password checks and exports are limited; limits are per visitor address or per member as fits. |
| Visitor addresses | In the self-hosted setup only Caddy is reachable from outside. Caddy sets `X-Forwarded-For`; the web app (`ADDRESS_HEADER`, `XFF_DEPTH=1`) and the API both take the right-most entry, which a visitor can't forge. The API port is not published. |
| CSP and headers | Strict nonce-based CSP from SvelteKit (no inline scripts, no third-party origins, `frame-ancestors 'none'`); `nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, a restrictive `Permissions-Policy`; HSTS from Caddy. |
| Cookies | The web session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production (only relaxed for development over plain http, so phones on the local network can test). Form posts are checked for same-origin by SvelteKit; behind Caddy the scheme comes from `X-Forwarded-Proto`, which only Caddy can set. |
| Containers | Both images run as the unprivileged `node` user, with production dependencies only; photos are written to a volume owned by that user. |
| Logs | One JSON line per request with the route pattern (never the full URL), status and time. Field names suggesting personal data are dropped. |
| Native clients | A client using only the API (curl) can sign in, get a bearer token and search, so a future Android app needs nothing from the web app. |

**Found and fixed**

1. *Email addresses in error logs*: errors from the mail server (e.g. "550 <name@example.org>:
   recipient rejected") were logged as they were. The logger now blanks out email addresses in
   every value (tested), and email subjects (which include members' names) are no longer logged.
2. *Uploads refused in production*: the Node adapter accepts request bodies up to 512 KB by
   default, so photo uploads through the website would have failed once deployed.
   `BODY_SIZE_LIMIT` is set to 64 MB in `compose.yaml` (six 10 MB photos); the API still limits
   each photo to 10 MB.
3. *Form posts refused over plain http behind Caddy*: the Node adapter assumes `https` unless told
   otherwise. `PROTOCOL_HEADER=X-Forwarded-Proto` is set, trusted because only Caddy reaches the
   web app.

**Accepted for now**

- `npm run audit` reports 4 moderate advisories, all in `esbuild` inside `drizzle-kit`, which
  `better-auth` lists as a dependency. They concern esbuild's development server, which wunan never
  runs. Revisit when better-auth or drizzle-kit update.
- No cap on simultaneous live streams per member (see US4).

## 002 Proposals for offerings (2026-06-05)

Covers proposals, place suggestions, place privacy, loan overlap, and sharing proposal messages
with helpers (002 tasks T032, T039, T067, T075).

| Area | Review |
|------|--------|
| Proposal access | Only the requester changes details (`403 not_requester` for the lister, "not found" for anyone else); only the lister accepts or declines; only the requester withdraws. Every endpoint is covered by route tests. |
| Accepting what was shown | Accept carries the `version` the lister saw; a change in between answers `409 proposal_changed` with the new details, so nobody agrees to details they didn't see. |
| Over-allocation and double booking | Accepting locks the offering row and re-checks what's left in one transaction. Overlapping unreturned loans are refused by a PostgreSQL exclusion constraint (`agreement_loans_dont_overlap`) even if two accepts race (tested). Non-loan agreements have no loan period, so they never clash. |
| Place privacy | Offering places are stored in full but every response goes through `viewPlace`: others get only "neighbourhood, city" until their proposal is accepted (offering page, search results, proposals that use the offering's area or meeting place). The area filter only matches neighbourhood, city, or typed text, so searching by street can't reveal whose offering is at an address (tested). A bare street address with no area parts is shown as "Area not given". |
| Place suggestions | Called only by the API, server to server, with a 2 s timeout; the request carries only the typed text, `limit`, `lang`, and the operator's fixed bias/box (tested against the stub). The answer is validated with Zod and reduced to known fields before use. 60 lookups per member per minute; the web proxy requires a signed-in member. The typed text is never logged. Answers are cached in memory only (10 minutes, 500 entries). |
| Threads | Proposal threads become read-only once declined, withdrawn, or closed. Helpers can read (never write) a proposal's thread only after the reporter or reported member shares it; sharing is one-way and noted in the report thread (tested). |
| Account deletion | Open proposals the member made or received close; offerings with proposals keep only their title, so the other member's proposal still makes sense. |
| Data export | Proposals and their messages are included; the offering's full place is never exported to a requester who wasn't accepted (only their own typed place is stored on their proposal). |

**Found and fixed during the work**

1. *Every agreement clashed with every loan*: `tstzrange(null, null)` is an unbounded range, so
   gifts and services counted as "lent for ever". The loan period is now null for anything but a
   loan (tested: a second agreement on an offering is accepted).
2. *Picked places carried a display field*: a suggestion's `display` was being sent back as part of
   the place and refused. The place field now saves only the place itself.

**Accepted for now**

- Same 4 moderate `npm audit` advisories as before (esbuild inside drizzle-kit, development server
  only).
- The default place server is komoot's public Photon instance, an outside service. Operators who
  don't want the typed text to leave their machines can self-host Photon or turn suggestions off;
  the operator guide says so.

## 003 Requests for things (2026-06-06)

Covers requests, links between requests and offerings, closing a request with an agreement, public
threads, flags on requests and messages, export, and account deletion (003 tasks T037, T045, T057,
T065).

| Area | Review |
|------|--------|
| Request access | Only the asker edits, closes, or reopens (`403 not_asker`); edits re-check the whole request with the shared schema, so the per-kind rules always hold. A request closed because its asker left answers "not found" everywhere, including its thread and live stream. |
| Linking | A member can link only their own available offering of the matching type, or (as the asker) an offering they found; an asker can't link their own offering to their own request. Each check has its own plain error (`wrong_type`, `not_available`, `already_linked`, `403`), all tested. A link can be removed only by who made it or the offering's owner. Links never change an offering. |
| Offering made for a request | `forRequest` is checked by the same rules after the offering is saved; if the link can't be made (for example the request closed meanwhile) the offering is kept and the answer says why. |
| Closing with an agreement | A proposal is tied to a request only when the requester is its asker and the offering is linked to it (a `requestId` naming anything else is refused). The request closes inside the accept transaction, under the offering lock, and only if still open; a request the asker closed by hand stays "closed by the asker". |
| Place privacy | Request areas go out only through `viewPlace`: in full for the asker, "neighbourhood, city" for everyone else. An offering form prefilled from a request gets only that display text. The area filter matches neighbourhood, city, or typed text only. |
| Public threads | Plain text, 1–240 characters after trimming, checked by the shared schema and a database check; shown with Svelte's normal escaping (no HTML). Any signed-in member may read and post while the request is open or the offering isn't closed. Only the author can remove a message (body emptied); nobody can hide one. Posts share the private-message limit of 60 per member per hour as an abuse backstop (owner decision). Live streams need a signed-in member and an existing request or offering, and close when the member leaves wunan. Notices are capped at one per thread per member per day. |
| Flags | Requests and public messages use the same flag table and limit as offerings (10 a day per member); a flag goes only to the asker or the message's author and never hides anything. The author sees flags only on their own messages. |
| Account deletion | The member's requests close for everyone (description and area cleared) and their public messages are deleted in the same transaction as the rest of 001's deletion. Offerings linked to their requests stay as they are. |
| Data export | Adds the member's requests (with their own full area), links, and public messages, and flags sent or received about offerings, requests, and messages. Other members appear by display name only. |

**Accepted for now**

- Linking an offering has no rate limit of its own; the asker's notices about it are capped at one per
  request per hour, and links can be removed by the offering's owner.
- Same 4 moderate `npm audit` advisories as before (esbuild inside drizzle-kit, development server
  only).

## 004 Arrangements (2026-11-11)

Covers merging proposals and agreements into one arrangement, asking again, marking as done, the
grouped list, helpers' read-only view, and the export (004 tasks T031, T054).

| Area | Review |
|------|--------|
| Access | `GET /arrangements/{id}` answers the requester and the offering's owner. Anyone else gets `404`, as before, unless they take part in the conversation of a request for help about that arrangement (a helper); then only once it is agreed, read-only (`myRole: helper`, no `canAccept`, `canEdit`, `canAskAgain`). Every action endpoint (`PATCH`, accept, decline, withdraw, returned, done, not-done) checks for one of the two members and answers helpers `404`. |
| Helpers and messages | A helper's response has `conversationId: null` until one of the two members shared their messages with the helpers, exactly as the old "share proposal messages" rule; the conversation endpoints still refuse helpers until then and never let them write. The timeline carries only the step, its time and who did it, built from note kinds; no note or message text is read into it, so it shows a helper nothing beyond what the old agreement page did. |
| Fixed once agreed | Details can only be changed while `status = 'open'` (`409 arrangement_ended` otherwise). Database checks keep the agreed record (agreed place and offer, loan dates, returned and done dates) empty unless `status = 'agreed'`, keep `agreedAt` set exactly when agreed, and refuse `doneAt` on a loan and `returnedAt` on anything else. Overlapping unreturned loans are still refused by the exclusion constraint, now on `arrangement`. |
| Asking again | Only the same requester can reopen, only their own arrangement on that offering, and only when it is declined, withdrawn or closed (the update's `where` checks the status, so a race can't reopen an open or agreed one). A partial unique index allows at most one arrangement per requester and offering that isn't agreed. Reopening clears the earlier note and closed reason and bumps `version`, so a lister can't accept details they haven't seen. |
| Marking as done | Either member, only on an agreed gift, trade or service. It changes no amounts, offering or request, sends no notification, and can be taken back. |
| List and counts | `GET /arrangements` and the header count only ever include arrangements where the caller is the requester or the offering's owner. "Unread" counts only messages written by the other member, so notes wunan writes can't be used to make an arrangement look urgent. |
| Data export | One `arrangements` section replaces `proposals` and `agreements`, with the same details plus the agreed record, returned and done dates, and messages. Other members appear by display name only. |

**Accepted for now**

- Same 4 moderate `npm audit` advisories as before (esbuild inside drizzle-kit, development server
  only).
