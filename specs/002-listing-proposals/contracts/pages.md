# Contract: Web App Pages (changes for proposals)

Changes to [001 pages](../../001-community-resource-sharing/contracts/pages.md); routes not listed
are unchanged. The same rules hold: every page calls only the API, has one primary action, shows the
API's plain-language errors. Every action works without JavaScript except the listing form
(`/listings/new`, `/listings/[id]/edit`) and the proposal form (`/listings/[id]/propose`,
`/proposals/[id]/edit`), which need it (research §10) and say so plainly when it's off. Live updates
still fall back to reloading.

## Listings

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/listings/new`, `/listings/[id]/edit` | unchanged | member / owner | Step 2 gains: **How the pickup / trade / service happens** (checkboxes, labels per type, research §6); **Meeting place** (PlaceField, shown when "somewhere else" is ticked); **Area** becomes a PlaceField. Trade: **What you'd accept in return**, rows of what + amount + unit with "Add another" (≤10) and "Remove"; with no rows the form says "Leave this empty if you're open to offers." Service: **How long each time** (minutes/hours/days/weeks), **When it's offered**, rows of weekday + from + to with "Add another" (≤14). Units list gains lb and oz. "Add another" and "Remove" act in place. |
| `/listings/[id]` | adds nothing; `flag` etc. unchanged | member | Shows handover options in words, area as "neighbourhood, city", Trade "Accepts: Eggs (6), Honey (1)" or "Open to offers: <name> hasn't listed anything specific", Service available times, Lend "Already lent: 8–11 Nov". Primary action for others: "Ask to borrow" / "Ask for this" / "Offer a trade" / "Ask for this service" → `/listings/[id]/propose`; if they have an open proposal: "See your proposal". Owner sees "Proposals (3)" linking to `/proposals?role=lister`. |
| `/listings/[id]/propose` | `default` | non-owner | The proposal form for the listing's type (research §10): every field optional with "Not decided yet"; when (date, optional time), how (only the listing's options), where (PlaceField; fixed text "At <name>'s place (<neighbourhood, city>)" for `at_lister`; hidden for online), and per type: how long (Lend, max shown), how much (Gift/Trade, prefilled with all that remains), what you offer (Trade: tick accepted things with amounts, or describe your own), how long each time and how many times (Service, limits shown). Optional first message. Submit "Send proposal" → `/proposals/[id]`. |

## Proposals (replaces Messages)

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/proposals` | — | member | Two groups, "Asked by me" and "On my listings" (`?role=` filters to one), open first, then ended. Each: listing title, other member, state in words ("Waiting for Sam", "Needs details: when, where", "Agreed", "Closed: nothing left"), new-activity marker in text. Calm empty state. Nav label "Proposals". |
| `/proposals/[id]` | `send`, `proposeCall`, `acceptCall`, `accept` (lister), `decline` (lister), `withdraw` (requester) | requester, lister | Top: listing link and current details, each empty one "Not decided yet", then issues in plain words. Primary action: lister "Accept" (only when no issues; posts the shown `version`), requester "Change details" → `/proposals/[id]/edit`. Secondary: "Decline" / "Withdraw" with an optional note and confirmation. Below: messages and history (detail changes shown as quiet notes), message box, call time, "Share contact details". Marked read on open. Live updates as in 001 (FR-018a); a `detail_changed` event refreshes the details block. Ended proposals are read-only. Accepted: links to the agreement. |
| `/proposals/[id]/edit` | `default` | requester, open | Same form as propose, filled in. Submit "Save changes". |
| `/threads/[id]` | `send`, `proposeCall`, `acceptCall` | participant; mediators read-only | A thread on its own: a request for help's shared conversation, or (read-only) a proposal's messages shared with helpers. Proposal members are sent to the proposal's page. Replaces 001 `/messages/[id]`. |
| `/threads/[id]/share-contact` | `review`, `share` | participant | As 001 `/messages/[id]/share-contact`; returns to the proposal or thread. |
| `/threads/[id]/live` | GET (Server-Sent Events) | participant, or mediator reading shared messages | Passes through the thread's live stream. |
| `/places` | GET (JSON, same-origin) | member | Forwards `?q=` to `GET /api/v1/places` for PlaceField. |

Removed: `/messages`, `/messages/start`, `/listings/[id]/agreements/new`. `/messages/[id]` and
its sub-routes became `/threads/[id]`.

## Agreements and problems

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/agreements/[id]` | `returned` (owner, loans) | party, mediator | Details (when, how, full place, loan period, amount, offer, sessions), link to the proposal for parties. No confirm, dispute, or cancel. |
| `/reports/[id]` | adds `share` (reporter, reported member) | reporter, reported, mediators | Report thread as before (uses the thread endpoints). "Let the helpers read your messages about this" with a plain explanation and confirmation; once shared, mediators see a read-only link to the proposal's messages. |

## Help

Topics change: "Messages and sharing contact details" and "Recording an agreement" become
"Proposals and messages" (`/help/proposals`) and "Agreements and returns" (`/help/agreements`).
