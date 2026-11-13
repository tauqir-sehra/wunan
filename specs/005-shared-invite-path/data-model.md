# Data Model: How You're Connected

Nothing new is collected. One column is added to `member` so the connection can be read in one query
(research §1).

## `member` (changed)

| Column | Type | Rule |
|--------|------|------|
| `invite_line` | `uuid[] not null` | The ids from this member's founding member down to this member, inclusive. Written once when the account is created; never updated. |

**Checks** (in addition to the existing ones):

- `member_invite_line_ends_with_self`: `invite_line[cardinality(invite_line)] = id`
- `member_invite_line_matches_inviter`: either `is_founder and invited_by_id is null and
  cardinality(invite_line) = 1`, or `invited_by_id is not null and cardinality(invite_line) >= 2 and
  invite_line[cardinality(invite_line) - 1] = invited_by_id`

No index on `invite_line`: it is only ever read from rows already found by primary key.

**Written by**: `createAccount` (the only code that inserts members) reads the inviter's
`invite_line` in the same transaction and stores `inviter.invite_line || new_id`, with `new_id`
generated before the insert. Founders store `{new_id}`. `seed-demo.ts` builds lines in memory the
same way.

**Why it never goes stale**: `invited_by_id` never changes; leaving keeps the row (`deleted_at`); only
unconfirmed sign-ups are deleted, and they have no invitees.

## Connection (worked out, not stored)

Computed by `connectionOf(viewerLine, memberLine)` for the signed-in viewer and the profile's member.

| `kind` | When | `top` | `toYou` | `toThem` |
|--------|------|-------|---------|----------|
| `self` | viewer is the member | founding member (`line[0]`) | the rest of the line, ending with the viewer (empty for a founder) | empty |
| `shared` | lines share a prefix and neither member is in the other's line | last shared person (common ancestor) | below it down to the viewer | below it down to the member |
| `theyAreAbove` | member is in the viewer's line | the member | below them down to the viewer | empty |
| `youAreAbove` | viewer is in the member's line | the viewer | empty | below them down to the member |
| `separate` | lines share no one (different founders) | `null` | viewer's full line | member's full line |

Each person is `{ id, displayName, isFounder, isFormerMember }`, with "(no longer a member)" added
to the name as everywhere else (`shownName`).
