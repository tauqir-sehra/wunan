# Research: Arrangements

Decisions that shape the plan. Nothing here needs a new dependency.

## 1. One table instead of two

**Decision**: Replace the `proposal` and `agreement` tables with one `arrangement` table. Its
detail columns are what the requester is asking for while it is open and, from the moment it is
accepted, the fixed record of what was agreed. The few things an agreement copied because they
could change afterwards are stored on acceptance in their own columns: the place as resolved
(`agreed_place`), what is given in return (`agreed_offer`), and the loan's period.
`proposal_offer` becomes `arrangement_offer`.

**Rationale**: The spec makes an arrangement one thing with stages and one address, and says the old
schema and data need not be kept. Today's `agreement` is a one-to-one copy of an accepted proposal
plus loan fields, so two tables mean every read joins them and every reference (conversation,
report, request, notification link) has to know which of two ids to hold. One table gives one id
for the page, the conversation, requests for help, and links. "Fixed once agreed" is enforced where
it already is: details can only be changed while the status is `open`.

**Alternatives considered**:
- *Keep both tables and add an `arrangement` view or a third table over them.* No change to the
  rules code, but two ids per exchange remain, reopening has to keep them in step, and every list is
  a union. More moving parts for no benefit once migration isn't needed.
- *Keep `proposal`, drop `agreement`, and call it done without renaming.* Least work, but the API,
  the code and the words would say "proposal" for something that may have been agreed and returned
  a year ago. Constitution VI (readable code) argues for the honest name.

## 2. Status, stage, and "Waiting on you" are worked out, not stored

**Decision**: Store only `status` (`open`, `agreed`, `declined`, `withdrawn`, `closed`) and facts
(`agreed_at`, `loan_starts_at`, `loan_ends_at`, `returned_at`, `done_at`). The API works out each
arrangement's **stage** (`arranging`, `agreed`, `on_loan`, `returned`, `done`, `ended`) and, per
member, whether it **needs them**, and returns both. The web app only shows them.

- Stage: `open` → `arranging`; `agreed` loan → `agreed` before the loan starts, `on_loan` after,
  `returned` once marked; `agreed` gift, trade or service → `agreed`, or `done` once marked;
  anything else → `ended`.
- Needs me: I'm the requester and details are missing; I'm the lister and it's ready to accept; I'm
  the owner of a loan past its end and not marked returned; or the conversation has a message
  written by the other member (kinds `text` and `call_accepted`) that I haven't read. Notes that
  wunan writes (`done`, `not_done`, `returned`, `accepted`, …) never count, so marking as done
  can't put the arrangement under the other member's "Waiting on you". (Also not: an agreed gift not
  yet marked as done, FR-009a.)

**Rationale**: This is how proposals already work (`proposalIssues` is computed, never stored), and
stages depend on today's date, so a stored stage would go stale. Keeping the rule in the API means
the website and any future app agree (the web app holds no rules).

**Alternatives considered**: a stored `stage` column kept up to date by a job (stale between runs;
another thing to keep in step); computing it in the web app (duplicates rules outside the API).

## 3. The timeline comes from the conversation's notes

**Decision**: Build the timeline from the event messages the API already writes into the
arrangement's conversation (`detail_changed`, `accepted`, `declined`, `withdrawn`, `closed`), plus
four new kinds written the same way: `asked` (also on asking again), `returned`, `done`, and
`not_done`, plus the arrangement's requests for help. The API returns `timeline` as a list of
`{ step, at, by }`, never the note's text, followed by the steps still expected (no date).

- "Details changed" shows only the latest change since the most recent ask.
- Lent and due back come from `loan_starts_at` and `loan_ends_at`, not from messages.
- Expected steps: `agreed` while arranging; `returned` for a loan not yet returned; `done` for an
  agreed gift, trade or service not yet marked.

**Rationale**: Each of these moments already produces exactly one note with a date and an author, in
the one conversation that the spec keeps for the arrangement's whole life, including across a
reopen (FR-010a). Using them avoids a second record of the same facts. Returning only the step,
date and name keeps what helpers see within today's limits: they get the timeline but not the
messages unless shared (FR-021a).

**Alternatives considered**: an `arrangement_event` table (clean, but every event would be written
twice and could drift from the notes); deriving everything from columns (can't show an earlier ask
and decline after a reopen without keeping history somewhere).

## 4. Asking again reopens the same row

**Decision**: `POST /offerings/{id}/arrangements` looks for this requester's arrangement on this
offering that isn't `agreed`. If one is open, it answers as today (`409 already_open`, pointing to
it). If one ended (`declined`, `withdrawn`, `closed`), it is set back to `open` with the new
details, `version + 1`, and the decline note and closed reason cleared; an `asked` note is written
and the lister is notified as for a new proposal. Otherwise a new row is made. A partial unique
index on `(offering_id, requester_id) where status <> 'agreed'` guarantees "at most one that isn't
agreed" (FR-010a).

**Rationale**: Same id, same address, same conversation, exactly as the spec asks, with the rule
enforced by the database rather than by care in the code.

**Alternatives considered**: a new row linked to the old one by `previous_id` (two conversations to
stitch together on one page); reopening from a button on the ended arrangement only (the spec also
expects asking from the offering page to land in the same place).

## 5. Marked as done

**Decision**: Two nullable columns, `done_at` and `done_by_id`, only ever set on an agreed gift,
trade or service. `POST /arrangements/{id}/done` sets them; `POST /arrangements/{id}/not-done`
clears them. Either member may call either. Each writes a quiet note (`done` / `not_done`) to the
conversation and sends **no** notification. Nothing else changes.

**Rationale**: FR-009a: optional, takes back without fuss, never chased. A note in the conversation
is how the other member finds out, the same way they learn of a return.

**Alternatives considered**: a `done` status (would make "fixed once agreed" and the loan rules
check two statuses for no gain); asking both members to confirm (more to press, and the spec says
either member is enough).

## 6. Loans keep their database guard

**Decision**: The hand-written exclusion constraint moves to the new table:
`EXCLUDE USING gist (offering_id WITH =, loan_period WITH &&) WHERE (returned_at IS NULL)`, where
`loan_period` is generated from `loan_starts_at` and `loan_ends_at`. Those two are set only on
acceptance, so open arrangements never take part.

**Rationale**: Same guarantee as 002 research §4 with the same mechanism; only the table name
changes.

## 7. The list in one request

**Decision**: `GET /arrangements?side=asked|offered` returns `{ needsYou, inProgress, finished,
finishedNext }`: the first two in full, `finished` as the 20 most recently changed with a cursor.
`GET /arrangements?group=finished&cursor=…` returns the next 20. Ordered by `last_activity_at`
descending, which every change and message already moves on. `GET /me/summary` returns
`arrangementsNeedingYou` in place of the two old counts, using the same "needs me" rule.

**Rationale**: "Waiting on you" and "In progress" are bounded by what a member is actively doing; only
"Finished" grows for ever, so only it is paged (FR-006). One rule for the list and the count keeps
SC-006 true by construction. With the existing indexes plus one on `(requester_id, status)` and one
on `(offering_id, status)`, 200 arrangements stay well inside SC-007.

**Alternatives considered**: one flat paged list grouped by the web app (a "Waiting on you" item could be
on page 3); three endpoints (three requests for one page).

## 8. What happens to the old pages, endpoints and words

**Decision**: Remove them (spec Clarifications: nothing old needs to keep working).

- Web: `/proposals…` and `/agreements…` are deleted; `/arrangements`, `/arrangements/[id]`,
  `/arrangements/[id]/edit`, `/arrangements/[id]/report` replace them. `/offerings/[id]/propose`
  stays as the way to ask and lands on the arrangement.
- API: the proposal and agreement endpoints are replaced by `…/arrangements…`
  ([contracts/api.md](contracts/api.md)). The rows for the old endpoints are taken out of the 002
  and 003 contracts, which the OpenAPI contract test reads.
- Help: the "Proposals" and "Agreements" topics become one "Arrangements" topic.
- Notification **types** and settings stay (`message`, `agreement`, `reminder`, `report`, …; FR-024); only
  their links and a few words change ([contracts/notifications.md](contracts/notifications.md)).
- The single initial migration is regenerated, as in 003; development and test databases are reset.

**Rationale**: Keeping redirects or duplicate endpoints would be code with no user, against
constitution VI.

## 9. Helpers

**Decision**: `GET /arrangements/{id}` answers a helper (a participant in the conversation of a
request for help about it) with `myRole: 'helper'`, only when the status is `agreed`, with no
actions, the full place, the timeline, and `conversationId: null` unless the messages were shared
with helpers (`messages_shared_at` on the request for help, as today). The list and the summary
count never include it.

**Rationale**: FR-021a restates what `viewableAgreement` and "share proposal messages" do today;
only the names change (`mediator` → `helper` in the API's role, matching the words members see).

## 10. Accessibility and calm design of the new pieces

**Decision**:
- Timeline: an ordered list. Each item is text: the step, then its date, or "not yet" for expected
  steps (visually a filled or hollow marker as well, never the marker alone).
- List filter: the existing `segmented` links (`?side=`), current one marked with `aria-current`.
- Actions: one filled button at a time, chosen from the stage and role (FR-017); the rest outlined.
  Accept, decline, withdraw, mark returned, mark as done and "Not done yet" all use `stayPut` and
  show their result beside the button; confirmations use `reveal`.
- "Mark as done" needs no confirmation (it can be taken back); "Not done yet" is a plain outlined
  button shown in its place.
- The page keeps the two-column layout: details, stage, timeline and actions on the left; the
  messages panel on the right.

**Rationale**: Reuses what 003 and the restyle already proved against the constitution (II, IV, V).
