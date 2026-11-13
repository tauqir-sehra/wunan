# Research: How You're Connected

## 1. How to find the common ancestor quickly

**Decision**: Store each member's **invite line** on their own row: `member.invite_line uuid[]`, the
ids from their founding member down to and including themselves (`{fay, ben, you}`). It is written
once, when the account is created, as the inviter's line plus the new id. The common ancestor of two
members is the last id their two lines share from the start (the longest common prefix). Building the
tree is then one query that reads the two lines and the names of everyone on them by primary key, and a
loop over at most two short arrays in the API.

**Rationale**:

- **The tree never changes shape.** A member's inviter is set when they join and never changes.
  Members who leave keep their row (`deleted_at`); the only rows ever deleted are unconfirmed
  sign-ups, which are always leaves (they can't invite anyone before confirming). So a stored line
  never needs updating: no triggers, no rewrites, no cache to invalidate.
- **Cost**: one round trip, two primary-key reads plus one `id = any(...)` read of at most
  `len(a) + len(b)` rows, then O(depth) work in memory. At depth 20 that's well under a millisecond in
  the database, against a 2 s budget (SC-003). Today's chain page walks the tree with a recursive
  query, one index probe per level; that is also fast at this scale, but the stored line makes the
  common-ancestor step trivial and removes recursion entirely.
- **Size**: 16 bytes per level per member. A community of 10,000 members with lines 30 deep stores
  about 5 MB. Negligible.
- **Kept honest by the database**: check constraints make the line agree with `invited_by_id`
  (data-model.md), so a bug can't store a wrong line silently.

**Alternatives considered**:

- **Recursive query for each of the two members, as today** (no schema change). Fine for speed at
  community scale (two walks of ~20 index probes), but finding the meeting point needs both full
  lines anyway, and the stored line gives them in one read. Rejected only because the user asked for
  this to be very efficient and the schema may change freely.
- **Closure table** (one row per ancestor–descendant pair). Built for "everyone under X" queries,
  which this feature doesn't need; O(depth) rows per member and a second table to keep in step.
  Rejected as more than needed.
- **PostgreSQL `ltree`**: needs an extension and text labels instead of uuids. Rejected: no gain over
  a uuid array for prefix comparison.
- **Caching the tree in memory**: another moving part for a sub-millisecond query. Rejected.

## 2. Where the API returns it

**Decision**: `GET /members/{id}` gains a `connection` field worked out for the signed-in viewer.
`GET /members/{id}/chain` is removed.

**Rationale**: The profile page already makes that call, so the tree costs no extra request. The
profile response is already per-viewer-safe (members only), and `connection` shows nothing a member
couldn't see before through the chain page (FR-011).

**Alternatives considered**: a separate `GET /members/{id}/connection`. Cleaner for other clients
but an extra round trip for the only page that uses it. Can be split out later if a phone app wants
it.

## 3. Shape of the answer

**Decision**: The API returns which case it is plus two lines, already ordered from the top down, so
the web page only draws:

- `kind`: `self` | `shared` | `theyAreAbove` | `youAreAbove` | `separate`.
- `top`: the person at the top (the common ancestor for `shared`; the member or the viewer for a
  single line; the founding member for `self`; `null` for `separate`).
- `toYou`, `toThem`: the people below `top`, in order, ending with the viewer and the member.
  For `separate` they are each full line from its founding member.

**Rationale**: The rules for which case applies live in one pure, unit-tested function in the API
(`connectionOf(viewerLine, memberLine)`), not in the page.

## 4. Drawing it accessibly

**Decision**: Two parts in one `<section>`:

1. **One sentence** ("You both trace back to Fay."; for a single line, the line itself: "Fay invited
   Ben, who invited you."), visible plain text (FR-005).
2. **The drawing**: the top person, then two columns, one per branch, each a stack of names joined
   by CSS lines, with "You both trace back to Fay" under the top person and "You" in the viewer's
   box; the viewer's and the member's boxes have a heavier border. Each branch is an `<ol>` named
   "From Fay down to you"; the names are the links, so keyboards and screen readers reach each
   person once.

**Rationale**: A short summary sentence plus a picture that screen readers read as named lists,
without ARIA tree widgets, which are hard to use for the people wunan is for.

**Alternatives considered**: an ARIA `tree` role (expects arrow-key navigation; heavy for a static
picture); nested `<ul>` as the only content (reads as a list of names without saying who invited
whom); an SVG (harder to make wrap and zoom).

## 5. Fitting in the side column and at 320 px

**Decision**: The two branches are side-by-side columns that share the width equally; names wrap
onto more lines rather than overflow. Depth grows downward, which the page can always take. With
lines of 20 or more, every name is still shown (spec edge case). On narrow screens the side column
falls below the main content (FR-012) at full width.

## 6. The profile's two-column layout

**Decision**: The profile page uses the existing `page-columns` utility from the restyle: main column
with the name, bio, "Invited by" and "People they invited"; side column with "How you're connected".

## 7. Schema change and migration

**Decision**: As in 004, nothing is kept: the single initial migration is regenerated with the new
column and checks, and the demo database is reset and reseeded. `createAccount` computes the line
from the inviter's row inside the same transaction; `seed-demo.ts` builds lines in memory as it
creates members in order.
