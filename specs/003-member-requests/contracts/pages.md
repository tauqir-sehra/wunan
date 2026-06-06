# Contract: Web App Pages (additions for requests)

Additions to the [002 pages contract](../../002-listing-proposals/contracts/pages.md); its rules
hold: every page calls only the API, has one filled primary action, and shows the API's plain errors.
The request form needs JavaScript like the offering and proposal forms (research §11) and says so
plainly when it's off; every other new page and action works without JavaScript.

## App shell

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| (header) | — | member | Main links: **Offerings** (with a count of unseen issues raised about my offerings), **Requests** (with a count of unseen issues raised about my requests), Proposals, Agreements ("Invite someone" moved to the menu under your name, so the header fits the page width); counts are in words for screen readers. The current link is shown by its background only, never bolder text, so nothing shifts (constitution V). Two outlined buttons: **Request something** → `/requests/new` and **Offer something** → `/offerings/new` (replaces "Share a new offering"); "Request" and "Offer" on narrow screens. Both are outlined so each page's own primary action stays the only filled one. |

## Requests

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/offerings` | GET search | member | "What people are offering", **Offer something** (the page's primary button, with an up-right arrow; Request something has a down-left arrow), and two tabs like Requests: **All offerings** (the search, as 002) and **My offerings** (`?mine=true`: my offerings grouped Available / Paused / Closed, each with "N new requests from members" when there are some; the tab carries the same count). Results are headed "Results", and under them (and in the empty state) "Can't find what you need? Request from the community" links to `/requests/new`, with the search words as the title. The current tab is shown by its background only. |
| `/requests` | GET search | member | "What people are asking for". Words, **Kind** tick-boxes (Borrow, Receive, Trade, Service; all ticked by default), optional Area, "Search". Tabs: **All requests** / **My requests** (`?mine=true`; shows a count of unseen issues raised about my requests, as does the **Requests** nav link). Results section like All offerings: cards with title, kind, area (neighbourhood, city), when in words, asker, "2 offers". "Show more" appends in place (no-JS: next page link). Primary: "Request something". Calm empty states: "Nobody's asking for anything that matches." / "You haven't asked for anything yet." |
| `/requests/more` | GET (JSON, same-origin) | member | Next page for "Show more". |
| `/requests/new` | `default` | member | The request form (needs JavaScript). Step 1: kind (Borrow / Receive / Trade / Service, with one plain line each) and title. As the title is typed, a box "These might already have what you need" shows up to 5 offerings (title, type, area; links). Step 2, all optional: description, **Needed after**, **Needed by** (with "Leave both empty if there's no fixed date"), area (PlaceField), how it could happen (handover options for the kind), and per kind: how long (Borrow), how much (Receive/Trade), "What you could give back" rows with "Add another" (Trade; "Leave this empty if you're open to talking about it"), how long each time, how many times, and times that suit you (Service). Submit "Post request" → `/requests/[id]`. The unfinished form is kept if the member opens a suggestion and comes back. |
| `/requests/[id]` | `close`, `reopen`, `link`, `unlink` ("Withdraw this offer" for the helper, "Not for my request" for the asker), `flag`, `post`, `removeMessage` | member | Title, kind, "Asked by <name>", description in a quoted box, details table ("Needed between 8 and 9 Nov", area, handover, how long / how much / give-back / sessions), "The date has passed" note for the asker when it has. **Offered for this request**: linked offerings as cards with helper name, state ("No longer available" when paused or closed), and for the asker "Ask to borrow" / "Ask for this" / … as outlined buttons linking to the offering page. On a request closed by an agreement, the asker sees a quiet note offering their other open proposals on its linked offerings, with links to withdraw them. Primary action — others: **I can help with this**, a pop-up "How would you like to help?" with two choices: "With a new offering" (**Make a new offering** → `/offerings/new?forRequest=<id>`) and "With an offering you already have" (their matching available offerings, outlined "Offer this offering"; none → "You haven't listed anything to lend." (give away, trade; "a service to offer"); the new-offering choice reads "Lend with a new offering. The form will start with what <asker> asked for." (Give, Trade, Offer your help)); no-JS page `/requests/[id]/help`; asker: **Edit request**, secondary "Close request" (confirmation). Closed: "Closed: settled by an agreement" / "Closed by <name>", "Reopen" for the asker. Then the public thread (below). "Raise an issue" pop-up for others (no-JS page `/requests/[id]/issue`). |
| `/requests/[id]/edit` | `default` | asker, open | The request form, filled in. "Save changes". |
| `/requests/[id]/help` | `default` | non-asker | The page behind "I can help with this": heading "How would you like to help?" and the same two choices as the pop-up. |
| `/requests/[id]/issue` | `default` | non-asker | The page behind "Raise an issue" (no JavaScript). |
| `/requests/[id]/messages/live`, `/offerings/[id]/messages/live` | GET (Server-Sent Events) | member | Pass through the API's public thread streams. |

## Offerings (changed)

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/offerings/new` | `default` | member | `?forRequest=<id>`: a note "You're answering <asker>'s request: <title>" with a link; the type is fixed to the one that answers the request; fields prefilled per spec FR-012 and changeable. After posting, if the link couldn't be made, the offering page says why calmly ("The request was closed, so this offering wasn't linked to it. Your offering is up as usual."). |
| `/offerings/[id]` | adds `post`, `removeMessage`, `flagMessage` | member | A small muted line "For <asker>'s request <title>" (linked) when it answers an open request. For the asker of a linked request, the proposal button carries the request so the form is prefilled; if linked to several of their requests, the proposal form asks "Which request is this for?" first. Public thread below the details. |
| `/offerings/[id]/propose` | `default` | non-owner | `?request=<id>`: prefilled from the request (research §3) and tied to it; a line "This is for your request: <title>. When it's accepted, your request closes." When the offering isn't linked to any of my requests but I have open requests of the matching kind, a first step asks "Is this for one of your requests?" ("Yes, for my request “<title>”" for each, or "No, it's not for a request"; `?request=<id>` or `?request=none`). Yes prefills from that request, and sending links the offering to it first (the link is undone if the proposal can't be made). |
| Offering cards (All offerings) | — | member | A small muted "For <asker>'s request" line when it answers an open request. |

## Public thread (on `/requests/[id]` and `/offerings/[id]`)

A section **Public messages** with a refresh button beside the heading. New messages and removals
appear live (`/requests/[id]/messages/live`, `/offerings/[id]/messages/live` pass through the API
streams), announced politely ("New message from Sam"); without JavaScript, reload or the refresh
button shows them. Messages oldest first with
author and time; "Show earlier messages" above when there are more than 20 (no-JS: link with
`?before=`). Removed: "Message removed". Each of my own messages has "Remove" (with confirmation)
and, if someone raised an issue about it, the request shown beneath it. Others' messages have a
quiet "Raise an issue" link (pop-up; no-JS page `/public-messages/[id]/issue`). The box: label
"Write a public message", hint "Everyone on wunan can read this. Please don't share phone numbers or
addresses here.", a live "240 characters left" counter (polite, announced at 20 and 0 left), and
"Post" (outlined, so the page's own primary stays the only filled button). When closed: "This
request is closed, so no new messages can be posted." Without JavaScript the counter is replaced by
"Up to 240 characters" and the server checks the length.

## Settings (changed)

`/settings/notifications` gains the two new types with their plain names (contracts/notifications.md).

## Help

New topic "Asking for things" (`/help/requests`): what a request is, how others answer it, how it
closes, public messages (who can read them, what not to share). "Help" buttons on `/requests`,
`/requests/new`, and `/requests/[id]`.
