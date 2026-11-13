# Contract: Web App Pages (changes for proposals)

> **Since feature 004** the Proposals and Agreements pages (`/proposals…`, `/agreements…`) are replaced by Arrangements: see [004 contracts/pages.md](../../004-arrangements/contracts/pages.md).

Changes to [001 pages](../../001-community-resource-sharing/contracts/pages.md); routes not listed
are unchanged. The same rules hold: every page calls only the API, has one primary action, shows the
API's plain-language errors. Every action works without JavaScript except the offering form
(`/offerings/new`, `/offerings/[id]/edit`) and the proposal form (`/offerings/[id]/propose`,
`/proposals/[id]/edit`), which need it (research §10) and say so plainly when it's off. Live updates
still fall back to reloading.

## App shell and Offerings

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| (header, every page) | — | member | "wunan" links to Offerings. Main links: Offerings, Proposals, Agreements (003 adds Requests and moves Invite into the menu under your name), each with a count in words where something is new. "Share a new offering" (outlined, with a + icon; "Share" on narrow screens) → `/offerings/new`; outlined so each page's own primary action stays the only filled button. Your name opens a menu: Your profile, Settings, Help, Sign out. Below `lg` everything folds into "Menu". Both menus are `<details>` and work without JavaScript. Page bodies use the header's full width. |
| `/` | — | anyone | No home page: redirects to `/offerings`. |
| `/offerings` | GET search | member | The landing page, on its "All offerings" tab (003 adds "My offerings"). "What are you looking for?", **Kind** tick-boxes (Lend, Gift, Trade, Service; all ticked by default, sent as `type=lend,gift,…`), optional Area, "Include items currently lent out", "Search". Then a separated **Results** section with the active filters ("Showing: …", "Clear filters") and the cards. "Show more" appends the next page in place, keeps the scroll position and moves focus to the first new result; without JavaScript it's a link to the next page. |
| `/offerings/more` | GET (JSON, same-origin) | member | The next page of "All offerings" results for "Show more": `{ offerings, nextQuery }`. |
| `/offerings?mine=true` | — | member | The "My offerings" tab (replaces the old My listings page): my offerings by status, with flags received. |

## Offerings

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/offerings/new`, `/offerings/[id]/edit` | unchanged | member / owner | Step 2 gains: **How the pickup / trade / service happens** (checkboxes, labels per type, research §6); **Meeting place** (PlaceField, shown when "somewhere else" is ticked); **Area** becomes a PlaceField. Trade: **What you'd accept in return**, rows of what + amount + unit with "Add another" (≤10) and "Remove"; with no rows the form says "Leave this empty if you're open to offers." Service: **How long each time** (minutes/hours/days/weeks), **When it's offered**, rows of weekday + from + to with "Add another" (≤14). Units list gains lb and oz. "Add another" and "Remove" act in place. |
| `/offerings/[id]` | adds nothing; `flag` etc. unchanged | member | Shows handover options in words, area as "neighbourhood, city", Trade "Accepts: Eggs (6), Honey (1)" or "Open to offers: <name> hasn't listed anything specific", Service available times, Lend "Already lent: 8–11 Nov". Primary action for others: "Ask to borrow" / "Ask for this" / "Offer a trade" / "Ask for this service" → `/offerings/[id]/propose`; if they have an open proposal: "See your proposal". Owner sees "Proposals (3)" linking to `/proposals?role=lister`. Description in a quoted box beside the details table; a quiet "Listed by <name>" line (no "invited by"). "Raise an issue" opens a pop-up (see below). |
| `/offerings/[id]/issue` | `default` | non-owner | The page behind the "Raise an issue" pop-up, for use without JavaScript: the 001 flag form on its own page; returns to the offering. |
| `/offerings/[id]/propose` | `default` | non-owner | The proposal form for the offering's type (research §10): every field optional with "Not decided yet"; when (date, optional time), how (only the offering's options), where (PlaceField; fixed text "At <name>'s place (<neighbourhood, city>)" for `at_lister`; hidden for online), and per type: how long (Lend, max shown), how much (Gift/Trade, prefilled with all that remains), what you offer (Trade: tick accepted things with amounts, or describe your own), how long each time and how many times (Service, limits shown). Optional first message. Submit "Send proposal" → `/proposals/[id]`. |

## Proposals (replaces Messages)

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/proposals` | — | member | Two groups, "Asked by me" and "On my offerings" (`?role=` filters to one), open first, then ended. Each: offering title, other member, state in words ("Waiting for Sam", "Needs details: when, where", "Agreed", "Closed: nothing left"), new-activity marker in text. Calm empty state. Nav label "Proposals". |
| `/proposals/[id]` | `send`, `acceptCall`, `accept` (lister), `decline` (lister), `withdraw` (requester) | requester, lister | Top: offering link and current details, each empty one "Not decided yet", then issues in plain words. Primary action: lister "Accept" (enabled only when no issues; posts the shown `version`), requester "Change details" → `/proposals/[id]/edit`. Secondary: "Decline" / "Withdraw" with an optional note and confirmation. Below: a **Messages** heading with a refresh button, messages and history (detail changes shown as quiet notes), message box with a small "+" by Send that adds contact details or a call time to the message (see below). A note appears when an earlier loan of the item is past its end and not marked returned. The Accept button is always shown, disabled with the reasons listed until nothing blocks it. Marked read on open. Live updates as in 001 (FR-018a); a `detail_changed` event refreshes the details block. Ended proposals are read-only. Accepted: links to the agreement. |
| `/proposals/[id]/edit` | `default` | requester, open | Same form as propose, filled in. Submit "Save changes". (Became `/arrangements/[id]/edit` in 004, then removed in 006: each detail is changed in its row.) |
| `/threads/[id]` | `send`, `acceptCall` | participant; mediators read-only | A thread on its own: a request for help's shared conversation, or (read-only) a proposal's messages shared with helpers. Proposal members are sent to the proposal's page. Replaces 001 `/messages/[id]`. |
| `/threads/[id]/live` | GET (Server-Sent Events) | participant, or mediator reading shared messages | Passes through the thread's live stream. |
| `/places` | GET (JSON, same-origin) | member | Forwards `?q=` to `GET /api/v1/places` for PlaceField. |

Removed: `/messages`, `/messages/start`, `/offerings/[id]/agreements/new`. `/messages/[id]` and
its sub-routes became `/threads/[id]`.

## Agreements and problems

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/agreements/[id]` | `returned` (owner, loans) | party, mediator | Details (when, how, full place, loan period, amount, offer, sessions), link to the proposal for parties, a Help button beside the heading, and a calm note when an earlier loan of the item is past its end and not marked returned. No confirm, dispute, or cancel. |
| `/reports/[id]` | adds `share` (reporter, reported member) | reporter, reported, mediators | Report thread as before (uses the thread endpoints). "Let the helpers read your messages about this" with a plain explanation and confirmation; once shared, mediators see a read-only link to the proposal's messages. |

## Settings

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/settings` and its sub-pages | `default` on `/settings` | member | A shared settings layout (one heading and section links, so the page doesn't shift between sections). `/settings` is one form with a single "Save" for profile, contact details and proposal preferences. Notifications, export and account deletion keep their own pages and actions. |

## Pop-up dialogs

The "+" by Send opens a small panel beside it: "My phone number" and "My email" (each showing exactly what will be shared) and "A time to call" (day and time). What's chosen shows as small pills in the box, each with an X; Send sends them with any text as one message, where they show as the same pills (a call time with "Accept this time" for the other person). It's a disclosure, so it works the same without JavaScript. "Raise an issue" opens a small dialog (title, a line saying what happens, the form, a close button; focus stays inside and returns afterwards). Without JavaScript the button is a link to its page (`/offerings/[id]/issue`), which does the same thing. Every heading with a help topic has a "Help" button beside it.

## Help

Topics change: "Messages and sharing contact details" and "Recording an agreement" become
"Proposals and messages" (`/help/proposals`) and "Agreements and returns" (`/help/agreements`).
