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

## US2: listings and photo upload (2026-06-04)

**Scope**: `apps/api/src/modules/listings.ts`, `modules/photos.ts`, `routes/listings.ts`,
`routes/photos.ts`, `app.ts` (body limits); `apps/web/src/routes/listings/**`,
`routes/photos/[key]/+server.ts`.

**Checked**

| Area | Result |
|------|--------|
| Ownership | Every change (edit, status, photos) goes through `ownedListing`, which refuses non-owners with 403 (tested). Flags can't target your own listing (tested). |
| Input | Listing fields validated by the shared Zod schema per type, with fields from other types refused (tested), plus matching database check constraints. Flags 1–500 characters, 10 per member per day. |
| Photo contents | The real format is read from the file's bytes; only photo formats are accepted, so SVG and non-images are refused (tested). `limitInputPixels` stops decompression bombs. |
| Photo size | Request bodies capped at 11 MB for uploads (1 MB for everything else); files over 10 MB refused with 413 (tested). At most 6 photos per listing (tested). |
| Metadata | Every photo is re-encoded as WebP, which drops EXIF including GPS (tested in the API and end to end with a real GPS-tagged JPEG). |
| Storage and serving | Files named by 16 random bytes; the key format is checked before touching the disk, so paths can't escape the photos folder (tested). Served only to signed-in members with `Cache-Control: private`, through the web app's proxy (tested). |

**Found and fixed**

1. *SVG files were accepted*: sharp can decode SVG, which is a document format rather than a
   photo. Uploads are now limited to photo formats by their actual contents.

**Notes for later phases**: deleting a listing's rows does not delete its photo files; account
deletion (T108) must call `deletePhotoFiles` for the member's photos.
