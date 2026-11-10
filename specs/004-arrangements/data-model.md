# Data Model: Arrangements

Changes to the 003 model. One new table replaces two; four tables point at it; nothing else
changes. No migration: the single initial migration is regenerated and development and test
databases are reset (spec Clarifications, research §8).

## arrangement (new; replaces `proposal` and `agreement`)

One exchange between a requester and an offering's owner, from the first ask to its end
(research §1). While `status = open` the detail columns are what's being asked; from `agreed` on
they are the fixed record.

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | Primary key; also the page address |
| offeringId | uuid → offering | Required; `on delete restrict` |
| requesterId | uuid → member | Required; never the offering's owner |
| requestId | uuid → request, nullable | The asker's request this answers (003); `on delete set null` |
| status | enum `arrangement_status` | `open`, `agreed`, `declined`, `withdrawn`, `closed`; default `open` |
| closedReason | enum `arrangement_closed_reason`, nullable | `nothing_left`, `quiet`, `member_left`; set exactly when `status = closed` |
| version | integer | Default 1; +1 on every detail change and on asking again; accepting names the version seen |
| startsAt, hasTime | timestamptz, boolean | "When"; a date without a time is midnight in the community's time zone |
| handover | enum `handover`, nullable | As 002 |
| place | jsonb (Place), nullable | As asked; not stored for `at_lister` or `online` |
| loanLength, loanLengthUnit | integer, enum, nullable | Lend; both or neither; > 0 |
| amount | numeric(12,3), nullable | > 0 |
| ownOffer, ownOfferAmount, ownOfferUnit | text ≤300, numeric, enum, nullable | Trade open to offers; amount and unit both or neither |
| sessionLength, sessionLengthUnit, sessions | integer, enum, integer, nullable | Service; length and unit both or neither; sessions ≥ 1 |
| decisionNote | text ≤500, nullable | The note with a decline or withdrawal; cleared on asking again |
| lastActivityAt | timestamptz | Moved on by every change and message; orders the list; a quiet month closes an open one |
| **agreedAt** | timestamptz, nullable | Set exactly when `status = agreed` (was `proposal.acceptedAt` / `agreement.createdAt`) |
| **agreedPlace** | jsonb (Place), nullable | The place as resolved on accepting (the offering's area for `at_lister`); only when agreed |
| **agreedOffer** | jsonb (AgreementOfferSnapshot), nullable | Trade: what is given in return, copied on accepting; only when agreed |
| **loanStartsAt, loanEndsAt** | timestamptz, nullable | Agreed loans only: both set, start < end |
| loanPeriod | tstzrange, generated | `tstzrange(loanStartsAt, loanEndsAt)`, null when there is no loan period |
| **returnedAt** | timestamptz, nullable | Loans: set when the owner marks it returned |
| reminderSentAt | timestamptz, nullable | Loans: the one return reminder was sent |
| **doneAt, doneById** | timestamptz, uuid → member, nullable | Gift, trade, service: marked as done (FR-009a); both or neither |
| createdAt, updatedAt | timestamptz | |

**Checks**

- `closed` has a reason, and only `closed` does (as `proposal_closed_has_reason`).
- The number, unit and text-length checks of `proposal`, unchanged.
- `agreedAt is not null` exactly when `status = 'agreed'`.
- `agreedPlace`, `agreedOffer`, `loanStartsAt`, `loanEndsAt`, `returnedAt`, `reminderSentAt`,
  `doneAt` are null unless `status = 'agreed'`.
- `loanStartsAt` and `loanEndsAt` are both set or both null; when set, start < end.
- `returnedAt` only with a loan period; `doneAt` only without one (a loan is returned, not "done").
- `doneAt` and `doneById` both set or both null.

Whether an agreed arrangement is a loan follows the offering's type, which cannot change (002);
the service layer sets the loan period for `lend` and never otherwise.

**Indexes and constraints**

- Unique `(offeringId, requesterId) where status <> 'agreed'`: at most one arrangement per requester
  and offering that isn't agreed (FR-010a). Replaces `proposal_one_open_per_requester`.
- `(requesterId, status)`, `(offeringId, status)`, `(status, lastActivityAt)` (the quiet-month job).
- Written by hand in the migration, as before (drizzle-kit can't express it):
  `EXCLUDE USING gist (offering_id WITH =, loan_period WITH &&) WHERE (returned_at IS NULL)`
  (research §6).

**State changes**

```text
            ask                    accept (lister; nothing blocks; version matches)
 (none) ─────────► open ───────────────────────────────────────────────► agreed
                    │  ▲                                                    │
   decline (lister) │  │ ask again (requester; offering available):         │ loan: mark returned (owner)
 withdraw (requester)  │ same row, new details, version + 1,                │   → returnedAt
   close (nothing left,│ note and reason cleared                            │ gift/trade/service:
   quiet month,     ▼  │                                                    │   mark as done ⇄ not done yet
   member left)   declined / withdrawn / closed                             ▼   → doneAt set / cleared
                                                                     (stays agreed for good)
```

- Details can be changed only while `open`. An `agreed` arrangement never changes status again.
- Stage and "needs me" are worked out from these facts and today's date, never stored (research §2).

## arrangement_offer (renamed from `proposal_offer`)

The listed things a Trade requester chose to give. Same fields and rules, with `arrangementId` in
place of `proposalId` (`on delete cascade`), unique per `(arrangementId, tradeAcceptId)`. Replaced
as a whole on each detail change; copied into `agreedOffer` on accepting.

## conversation (changed)

| Field | Change |
|-------|--------|
| ~~proposalId~~ → **arrangementId** | uuid → arrangement, unique, `on delete cascade`. Exactly one of `arrangementId` and `problemReportId` is set, as before |

One conversation per arrangement for its whole life, including across asking again. It can be
written to while the arrangement is `open` or `agreed`.

## message (changed)

`message_kind` gains four values, written by the API as notes like the existing ones (research §3):

| Kind | Written when | Author |
|------|--------------|--------|
| `asked` | An arrangement is made, and each time it is asked again | The requester |
| `returned` | The owner marks a loan returned | The owner |
| `done` | A member marks a gift, trade or service as done | That member |
| `not_done` | A member takes that back | That member |

Existing kinds are unchanged (`text`, `call_accepted`, `system`, `detail_changed`, `accepted`,
`declined`, `withdrawn`, `closed`, `messages_shared`).

## problem_report (changed)

| Field | Change |
|-------|--------|
| ~~agreementId~~ → **arrangementId** | uuid → arrangement, required. A request for help can only be made while it is `agreed` (service rule, as today) |
| ~~proposalMessagesSharedAt, proposalMessagesSharedById~~ → **messagesSharedAt, messagesSharedById** | Renamed; same meaning |

## request (changed)

| Field | Change |
|-------|--------|
| ~~closedByAgreementId~~ → **closedByArrangementId** | uuid → arrangement, `on delete set null`; only when `closedReason = 'agreed'` |

## Removed

`proposal`, `proposal_offer`, `agreement`, and the enums `proposal_status`,
`proposal_closed_reason`. The enum `agreement_outcome` goes too: "lent / gifted / traded /
provided" follows from the offering's type and is worked out where it is shown.

## Worked out, not stored (returned by the API)

| Name | Values | From |
|------|--------|------|
| stage | `arranging`, `agreed`, `on_loan`, `returned`, `done`, `ended` | status, loan period, `returnedAt`, `doneAt`, now |
| needsMe | boolean, per member | my role, `issues`, stage, unread messages (research §2) |
| group | `needsYou`, `inProgress`, `finished` | `needsMe`, then stage (`returned`, `done`, `ended` are finished) |
| issues | as 002 | details against the offering, while `open` |
| timeline | `[{ step, at, by }]` then expected steps | conversation notes, loan dates, requests for help (research §3) |
| myRole | `requester`, `lister`, `helper` | who is asking |

## Shared schemas (`packages/shared`)

`schemas/proposals.ts` and `schemas/agreements.ts` become `schemas/arrangements.ts`:
`ArrangementStatus`, `ArrangementStage`, `ArrangementDetailsInput` (the 002 details input,
unchanged), `CreateArrangement`, `Arrangement`, `ArrangementSummary`, `ArrangementList`,
`TimelineStep`. `Summary` (home counts) replaces `proposalsWithNews` and
`agreementsNeedingAttention` with `arrangementsNeedingYou`. `Message` kinds gain the four above.
`RequestDetail.closedByAgreementId` becomes `closedByArrangementId`; an offering's
`myOpenProposalId` and `openProposalCount` become `myArrangement: { id, status } | null` and
`openArrangementCount`.

## Export

In `my-wunan-data.json`, the `proposals` and `agreements` sections become one `arrangements`
section: for each of the member's arrangements, its offering title, the other member's name, my
side, status, details, every message, and when agreed: `agreedAt`, the agreed place and offer,
loan dates, `returnedAt`, `doneAt` (FR-025). The export's README text is updated to match.
