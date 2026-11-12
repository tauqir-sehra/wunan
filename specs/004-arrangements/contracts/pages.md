# Contract: Web App Pages (changes for arrangements)

Changes to the [002](../../002-listing-proposals/contracts/pages.md) and
[003](../../003-member-requests/contracts/pages.md) pages contracts; their rules hold: every page
calls only the API, has one filled primary action, shows the API's plain errors, and works without
JavaScript except the detail forms, which say so plainly (002 research §10). Actions update the
page in place (`stayPut`), show their result beside the button pressed, and have an `#anchor`
fallback; confirmations that open under a button scroll just into view (`reveal`).

## App shell

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| (header) | — | member | Main links: Offerings, Requests, **Arrangements** (in place of Proposals and Agreements), with one count: `arrangementsNeedingYou`, read to screen readers as "N waiting on you". The phone "Menu" dot shows when any count is above zero, as before. |

## Arrangements

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/arrangements` | GET | member | Heading "Arrangements", one line under it ("Everything you're arranging with other members, from asking to the end."), Help. A `segmented` choice **All** / **I asked** / **On my offerings** (`?side=asked\|offered`; the current one has `aria-current`). Three groups in order, each shown only when it has something: **Waiting on you**, **In progress**, **Finished**. Cards in two columns on wide screens, whole card a link: offering title; my side in words ("You asked to borrow" / "Rosa asked for"); "With <name>"; the stage in words (see Stage words); "New activity" when unread; the latest message's first line. Finished shows 20 and a "Show more" button that adds the next 20 below (a plain link to `?group=finished&cursor=…` without JavaScript). Empty: "You're not arranging anything yet." with links to Offerings and "Request something". No filled button: the page's action is choosing an arrangement. |
| `/arrangements/more` | GET (JSON, same-origin) | member | The next finished page for "Show more". |
| `/arrangements/[id]` | `send`, `acceptCall`, `accept` (lister), `decline` (lister), `withdraw` (requester), `returned` (owner), `done`, `notDone` | requester, lister; helper read-only | See "The arrangement page". Its address never changes, including when it is accepted or asked again. |
| `/arrangements/[id]/edit` | `default` | requester, while open | The details form, filled in (was `/proposals/[id]/edit`). "Save changes" returns to the arrangement. |
| `/arrangements/[id]/report` | `default` | requester or lister, while agreed | "Ask for help" (was `/agreements/[id]/report`). |
| `/offerings/[id]/propose` | `default` | non-owner | Unchanged form. Sending it lands on `/arrangements/[id]` (new, or the reopened one). When the member's earlier arrangement ended, the heading says "Ask again" and a note says "This continues your earlier arrangement, with its messages." |

Removed: `/proposals`, `/proposals/[id]`, `/proposals/[id]/edit`, `/agreements`, `/agreements/[id]`,
`/agreements/[id]/report`. They show the usual "We couldn't find that page" (no redirects).

### The arrangement page

Header, full width: "You asked to borrow **<offering>**" / "<Name> asked for **<offering>**" (the
offering is a link), then "With <name>" and, when it answers a request, "For your request: <title>".
Help link.

Then two columns on wide screens (`page-columns`), one on narrow with the messages last:

**Left**

1. **Stage**: one line in words, with a `Badge` (see Stage words), and under it why, when there is
   a why: how it ended, who it's waiting for, or the note that came with a decline.
2. **Timeline** (`Timeline.svelte`): an ordered list. Each step is a line of text: the step, then
   its date ("Asked · 3 Nov", "Agreed · 6 Nov", "Due back · Sat 14 Nov"). Steps still expected
   follow in muted text with "not yet". A filled or hollow dot sits beside each line as decoration
   (`aria-hidden`); the words alone say everything. After asking again, earlier asks and how they
   ended stay in the list.
3. **Details** (`ArrangementDetails.svelte`, from `ProposalDetails`): the rows as today, "Not
   decided yet" for empty ones while arranging; once agreed, headed "What was agreed", with the full
   place and what is given in return, and no "Change details".
4. **Still to settle** (while arranging, when there are issues), as today.
5. **Actions** (`#decision`), exactly one filled:

   | Stage | I'm the requester | I'm the lister |
   |-------|-------------------|----------------|
   | Being arranged, details missing | **Change details** (filled), Withdraw | Decline; Accept shown but can't be pressed, with why |
   | Being arranged, nothing missing | Change details, Withdraw; "Waiting for <lister>." | **Accept** (filled), Decline |
   | Agreed loan, not started or out | (none); Send is the filled button | **Mark returned** (filled) |
   | Agreed gift, trade, service | **Mark as done** (filled) | **Mark as done** (filled) |
   | Returned | (none) | (none) |
   | Done | Not done yet (outlined) | Not done yet (outlined) |
   | Ended | **Ask again** (filled, a link to `/offerings/[id]/propose`) while the offering is available | (none) |

   When no action is filled, the message box's Send is. Decline and Withdraw keep their
   confirmation with an optional note. "Mark as done" has no confirmation; its result ("Marked as
   done. You can take this back.") shows under it.
6. **Help from the invite chain** (once agreed): requests for help and their outcomes, and
   "Something went wrong? Ask for help" as on today's agreement page; plus the earlier-loan note.

**Right**: the messages panel (`ArrangementMessages`, from `ProposalMessages`), unchanged. Read-only
with "This arrangement has ended, so no new messages can be added." when it ended without
agreement.

**A helper** sees the header, a note ("You're seeing this to help. Only <A> and <B> can change
it."), stage, timeline, what was agreed, and the requests for help; no actions; the messages panel
only when the messages were shared with helpers, read-only.

### Stage words

| Stage (API) | Badge | Line in the list and on the page |
|-------------|-------|----------------------------------|
| `arranging` | Being arranged | "Needs details: when, how" / "Ready for you to accept" / "Waiting for <name>" (as the proposals list says today) |
| `agreed` | Agreed | "Agreed for Sat 14 Nov, 10 am" or "Agreed" when no day |
| `on_loan` | On loan | "Due back Sat 14 Nov" / "It was due back Sat 14 Nov" (never "late" or "overdue" as a label) |
| `returned` | Returned | "Returned on 15 Nov" |
| `done` | Done | "Done on 15 Nov" |
| `ended` | Ended | "Declined" / "Withdrawn" / "Closed: nothing left" / "Closed after a quiet month" / "Closed: one of you left wunan" |

## Pages that point to an arrangement

| Route | Change |
|-------|--------|
| `/offerings/[id]` | "See your proposal" → **See your arrangement** when the member's is open; **Ask again** when theirs ended; owner's "Proposals (N)" → **Arrangements (N)**, linking to `/arrangements?side=offered`. |
| `/requests/[id]` | "See the agreement" and the list of the asker's other open proposals link to `/arrangements/[id]` and say "arrangement". |
| `/reports/[id]` | Links to the arrangement; "Let the helpers read your messages about this" posts to the renamed action. |
| `/members/[id]`, `/offerings?welcome`, error page | No links to proposals or agreements remain. |

## Help

`/help/proposals` and `/help/agreements` become one topic, `/help/arrangements` ("Arranging and
agreeing"): what an arrangement is, its stages in the words above, that details are fixed once
agreed, marking returned and marking as done (optional, can be taken back), asking again, and
sharing contact details with "+". Other topics that mention the Proposals or Agreements pages are
reworded (`asking-for-help`, `requests`, `offering`, `notifications`).

## Components

| Component | Change |
|-----------|--------|
| `ArrangementCard.svelte` | New: one arrangement in the list. |
| `Timeline.svelte` | New. |
| `ArrangementDetails.svelte` | Renamed from `ProposalDetails`; adds the agreed view. |
| `ArrangementMessages.svelte`, `lib/arrangement-thread.ts` | Renamed from `ProposalMessages`, `proposal-thread.ts`. |
| `ProposalFields.svelte` | Kept as `ArrangementFields.svelte` (the details form). |
| `lib/format.ts` | `stageWords(arrangement, myName)` and `sideWords(arrangement)` in place of the proposals list's `state()` and `agreementSentence()`. |
