# Research: A home page of what needs you

## 1. Where Home's lines are worked out

**Decision**: In the API, one call `GET /api/v1/me/home` returning the four groups, each already
ordered (oldest first) and complete (the web shows the first 5 and the rest under "See all").

**Rationale**: "Waiting on you" is decided by `needsMe` in `apps/api/src/modules/arrangement-stage.ts`;
reusing it there guarantees Home and Arrangements never disagree (FR-003, SC-002). One call keeps
Home fast and lets other clients show the same thing.

**Alternatives**: The web combining `/arrangements`, `/requests` and flags calls: four calls, and the
due-back and "pressed" rules would live in the web, which holds no data.

## 2. Arrangements group

**Decision**: The caller's arrangements with `needsMe` true, via the existing `summarise`, as
`ArrangementSummary`; ordered by `lastActivityAt`, oldest first (spec: oldest first). The words for
each line reuse what the Arrangements list card says (`stageWords` in `format.ts`, plus "New
message" when unread), so a loan's due day shows even when the loan is listed here rather than
under "Due back".

Oldest first differs on purpose from the Arrangements page (newest first): Home is a to-do list, so
what's been waiting longest comes first. SC-002 checks that both list the same arrangements, not the
same order.

## 3. Due back

**Decision**: Agreed loans (`loanEndsAt` set) not `returnedAt`, where the caller is borrower or
lender and `loanEndsAt < start of the community's day 3 days from today` (that is, due today,
tomorrow or the day after, or already past). Leave out any already in the arrangements group (the
lender's late loan, or one with an unread message), so each loan is listed once. Ordered by
`loanEndsAt`. Dates are worked out in the community time zone (`apps/api/src/lib/time.ts`). The web
shows the due day as weekday and date, "Thursday 20 November" (`en-GB`, no year unless not this year).

**Rationale**: Clarified: 2 days before, for both sides, with the date. "Start of day" so a loan due
at 10:00 on Thursday shows from Tuesday morning, not from Tuesday 10:00.

## 4. Offers on your requests, and asked to change

**Decision**: Add `homePressedAt timestamptz null` to `request_link` and to `flag`.

- Offers: links on the caller's open requests with `homePressedAt is null` and `linkedById` not the
  asker (the asker linking an offering they found isn't news to them). Grouped by request: one line
  with the count, the helpers' names (first two, then "and others"), and the oldest link's time for
  ordering.
- Asked to change: the caller's flags on their offerings and requests (not public messages, which
  aren't listed) with `homePressedAt is null`, grouped by thing.

`seenAt` is left alone: it still drives the header counts and the "new" marks where flags are shown
(spec: "The header's counts keep their own rules").

**Rationale**: Clarified: lines stay until pressed on Home, not until seen elsewhere. Separate
columns keep the two rules apart. A new link or flag has `homePressedAt` null, so the line comes back.

**Alternatives**: A separate `home_pressed` table keyed by kind and id: more code for the same thing.
Reusing `seenAt`: would drop lines when seen elsewhere, which the spec rules out.

## 5. Pressing a line without JavaScript

**Decision**: Offer and flag lines link to `/home/go?kind=offers&id=<requestId>` (or
`kind=flags&subject=offering|request&id=…`). That web route is a `+server.ts` `GET`: it calls
`POST /me/home/pressed` and redirects `303` to the request or offering page. Arrangement and
due-back lines link straight to the arrangement.

**Rationale**: A plain link works without JavaScript and reads as a link. A `+server.ts` route isn't
a page, so SvelteKit doesn't preload it on hover, which would otherwise mark lines pressed without a
press. The API marks only rows that belong to the caller and are still unpressed, so repeating it is
harmless. If the API call fails, the redirect still happens (the line just stays).

A `GET` that changes something could be triggered by a link on another site. The harm is small (it
only hides one of the member's own Home lines), but the route records the press only when the
request comes from wunan itself (`Sec-Fetch-Site` is `same-origin` or `none`, or, without that
header, the `Referer` is this site); otherwise it just redirects.

**Alternatives**: A form with a button styled as a link: a button that reads as a link confuses
screen-reader users and breaks "open in new tab".

## 6. "See all" in place

**Decision**: Each group shows its first 5. "See all {n}" is a link to `?all=<group>#<group>` with
`data-sveltekit-reset="false"`; with it, that group renders all its lines, the extra ones after the
first 5, and focus moves to the first new line. Several groups can be open (`?all=a,b`).

**Rationale**: Stays put (constitution V), works without JavaScript, no new pages (clarified).

## 7. Landing and the header

**Decision**: `/` loads Home for signed-in members; signed-out keeps today's redirect. Sign-in
already falls back to `/`. Confirming a new account still lands on Offerings with its "Welcome to
wunan" note (`/offerings?welcome=1`): a new member has nothing on Home yet, and browsing is what
they can do first. FR-001 is about signing in, which lands on Home. The header gains "Home" as the first main link, current only on `/`
exactly; the wunan name already links to `/`.

## 8. Schema change and migration

**Decision**: The single initial migration gets the two columns, and databases are rebuilt from
scratch (`npm run db:reset`; the test database the same way with `TEST_DATABASE_URL`). The file has
hand-written parts (the `btree_gist` extension and the loan exclusion constraint), so the two
columns are added to it by hand rather than regenerating it; `drizzle-kit generate` then reports no
changes.

## 9. No live updates

**Decision**: Home doesn't subscribe to live updates (spec: doesn't move by itself). A fresh visit or
reload shows changes.
