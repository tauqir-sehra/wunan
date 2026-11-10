# Contract: API (changes for arrangements)

Changes to the [002](../../002-listing-proposals/contracts/api.md) and
[003](../../003-member-requests/contracts/api.md) API contracts, whose conventions (base path
`/api/v1`, bearer tokens, error shape, places, pagination) are unchanged.

The "Proposals" section and the agreement rows of 002, and the proposal rows of 003, are
**replaced** by this document; those rows are removed from the two older contracts when this is
built, because the OpenAPI contract test (`apps/api/src/openapi.test.ts`) reads all three. Nothing
old keeps working (spec Clarifications).

## Arrangements

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `POST /offerings/{id}/arrangements` | non-owner | Ask. Body as 002's create-proposal body (every detail optional, optional first `message`, optional `requestId` per 003). If the caller has an arrangement on this offering that ended without agreement, it is **reopened** with these details (same `id`, `version + 1`, note and closed reason cleared) → `200`; otherwise a new one → `201`. Either way an `asked` note is written and the lister is notified. `409 already_open` with the existing `id` if theirs is open. `400 own_offering`, `409 not_available` as 002. |
| `GET /arrangements` | member | `?side=asked\|offered` (optional). → `{ needsYou: [summary], inProgress: [summary], finished: [summary], finishedNext: cursor \| null }`. `needsYou` and `inProgress` in full; `finished` the 20 most recently changed. All ordered by `lastActivityAt`, newest first. With `?group=finished&cursor=…` it returns only the next 20 finished: `{ finished, finishedNext }`. Never includes arrangements the caller only helps with. |
| `GET /arrangements/{id}` | requester, lister; helper per below | The arrangement in full (see shape). Anyone else: `404`. |
| `PATCH /arrangements/{id}` | requester, while `open` | As 002 `PATCH /proposals/{id}`: same fields and rules, bumps `version`, posts `detail_changed`, notifies the lister. `409 arrangement_ended` otherwise. |
| `POST /arrangements/{id}/accept` | lister | `{ version }`. As 002 accept, on the same row: `409 arrangement_changed` (with the current arrangement), `409 arrangement_not_ready` (with `issues`), `409 dates_taken`. Sets `status = agreed`, `agreedAt`, `agreedPlace`, `agreedOffer`, and the loan period for Lend; lowers what's left on the offering; closes other open arrangements when nothing is left; closes the tied request (003). → the arrangement. |
| `POST /arrangements/{id}/decline` | lister, while `open` | `{ note? }` → `declined`; conversation read-only; notifies the requester. |
| `POST /arrangements/{id}/withdraw` | requester, while `open` | `{ note? }` → `withdrawn`; conversation read-only; notifies the lister. |
| `POST /arrangements/{id}/returned` | owner, agreed loan | Sets `returnedAt`; frees the dates; posts a `returned` note; moves `lastActivityAt`. `409 already_returned`. |
| `POST /arrangements/{id}/done` | requester or lister, agreed gift, trade or service | Sets `doneAt`, `doneById`; posts a `done` note; moves `lastActivityAt`; sends **no** notification and never makes it "need" the other member. `409 not_agreed`, `409 is_a_loan`, `409 already_done`. |
| `POST /arrangements/{id}/not-done` | requester or lister | Clears them; posts a `not_done` note; no notification. `409 not_done`. |
| `POST /arrangements/{id}/reports` | requester or lister, while `agreed` | `{ description }` → a request for help and its shared conversation, as 002 `POST /agreements/{id}/reports`. |

### Shapes

**summary** (list item)

```text
{ id, offering: { id, title, type }, otherMember: { id, displayName },
  myRole: "requester" | "lister",
  status, closedReason, stage, needsMe,
  issues: [{ field, message }],          // while open; empty otherwise
  startsAt, hasTime,                     // the agreed or asked day, when there is one
  loanEndsAt, overdue,                   // agreed loans
  unread, lastActivityAt, lastMessagePreview }
```

**arrangement** (`GET /arrangements/{id}`, and returned by every action above)

```text
{ id, status, closedReason, stage, version, myRole: "requester" | "lister" | "helper",
  offering: (summary, places per Conventions), requester, lister,
  request: { id, title, status } | null,
  details: { startsAt, hasTime, handover, place, loanLength, loanLengthUnit, amount,
             ownOffer, ownOfferAmount, ownOfferUnit, sessionLength, sessionLengthUnit, sessions },
  offers: [...], issues: [...], canAccept, decisionNote,
  agreed: null | { at, place, offer, loanStartsAt, loanEndsAt, overdue, returnedAt,
                   doneAt, doneBy: { id, displayName } | null },
  earlierLoanNotBack, areaUnchecked,     // as 002
  timeline: [{ step, at, by: { id, displayName } | null }],
  reports: [...],                        // requests for help, as on 002's agreement
  conversationId: string | null,
  canAskAgain }                          // requester, ended without agreement, offering available
```

- `stage`: `arranging`, `agreed`, `on_loan`, `returned`, `done`, `ended` (data-model, "Worked out").
- `details.place` is the place as asked while open and `agreed.place` the place as resolved once
  agreed; both follow the place rules of 002 (the full place only for the two members once agreed,
  and for helpers).
- `timeline` steps, oldest first: `asked`, `details_changed` (only the latest since the most recent
  ask), `agreed`, `declined`, `withdrawn`, `closed`, `lent`, `due_back`, `returned`, `done`,
  `help_asked`, `help_outcome`. Steps that have happened have `at`; expected steps follow with
  `at: null` (`agreed` while arranging; `returned` for a loan out; `done` for an agreed gift, trade
  or service not yet marked). A `done` later taken back is not listed. `by` is who did it, or null
  for wunan. The note's text is never included.

### Helpers

A member who takes part in the conversation of a request for help about an arrangement gets, from
`GET /arrangements/{id}`: `myRole: "helper"`, only while it is `agreed` (otherwise `404`), the same
fields with `canAccept: false`, `canAskAgain: false`, and `conversationId: null` unless the two
members shared their messages with the helpers (then it can be read, never written). Every other
endpoint in the table answers a helper `404`.

## Changed elsewhere

| Endpoint | Change |
|----------|--------|
| `GET /me/summary` | `{ arrangementsNeedingYou, unseenFlags, unseenRequestFlags }`. `arrangementsNeedingYou` is the length of `needsYou` from `GET /arrangements`. Replaces `proposalsWithNews` and `agreementsNeedingAttention`. |
| `GET /offerings/{id}` | `myOpenProposalId` → `myArrangement: { id, status } \| null` (the caller's arrangement on it that isn't agreed, open or ended). `openProposalCount` → `openArrangementCount` (owner). |
| `GET /me/offerings` | `openProposalCount` → `openArrangementCount`. |
| `GET /requests/{id}` | `closedByAgreementId` → `closedByArrangementId`; `myOtherOpenProposals` → `myOtherOpenArrangements`. |
| `GET /conversations/{id}/messages` | Kinds gain `asked`, `returned`, `done`, `not_done`. `conversation.canWrite` is true while its arrangement is `open` or `agreed`. |
| `GET /reports/{id}` | `agreementId` → `arrangementId`; `proposalMessagesShared` → `messagesShared`; `proposalConversationId` → `arrangementConversationId`. |
| `POST /reports/{id}/share-messages` | Renamed from `/share-proposal-messages`; same behaviour. |
| `GET /me/export` | `proposals` and `agreements` become `arrangements` (data-model, "Export"). |

## Removed

`POST /offerings/{id}/proposals`, `GET /proposals`, `GET /proposals/{id}`, `PATCH /proposals/{id}`,
`POST /proposals/{id}/accept`, `/decline`, `/withdraw`, `GET /me/agreements`,
`GET /agreements/{id}`, `POST /agreements/{id}/returned`, `POST /agreements/{id}/reports`,
`POST /reports/{id}/share-proposal-messages`.

## Rules that stay exactly as they are

What blocks accepting (`issues`), version checking, loans not overlapping, amounts and sessions
left, closing others when nothing is left, the quiet-month close, closing on a member leaving,
request closing on agreement (003), place privacy, message limits, and who a request for help
brings in. Only the names in error codes change: `proposal_ended` → `arrangement_ended`,
`proposal_changed` → `arrangement_changed`, `proposal_not_ready` → `arrangement_not_ready`.
