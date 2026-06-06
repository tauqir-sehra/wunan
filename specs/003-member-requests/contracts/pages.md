# Contract: Web App Pages (additions for requests)

Additions to the [002 pages contract](../../002-listing-proposals/contracts/pages.md); its rules
hold: every page calls only the API, has one filled primary action, and shows the API's plain errors.
The request form needs JavaScript like the listing and proposal forms (research §11) and says so
plainly when it's off; every other new page and action works without JavaScript.

## App shell

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| (header) | — | member | Main links gain **Requests** after Find (with no count). Two outlined buttons: **Request something** → `/requests/new` and **Offer something** → `/listings/new` (replaces "Share a new listing"); "Request" and "Offer" on narrow screens. Both are outlined so each page's own primary action stays the only filled one. |

## Requests

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/requests` | GET search | member | "What people are asking for". Words, **Kind** tick-boxes (Borrow, Receive, Trade, Service; all ticked by default), optional Area, "Search". Tabs: **All requests** / **My requests** (`?mine=true`). Results section like Find: cards with title, kind, area (neighbourhood, city), when in words, asker, "2 offers". "Show more" appends in place (no-JS: next page link). Primary: "Request something". Calm empty states: "Nobody's asking for anything that matches." / "You haven't asked for anything yet." |
| `/requests/more` | GET (JSON, same-origin) | member | Next page for "Show more". |
| `/requests/new` | `default` | member | The request form (needs JavaScript). Step 1: kind (Borrow / Receive / Trade / Service, with one plain line each) and title. As the title is typed, a box "These might already have what you need" shows up to 5 listings (title, type, area; links). Step 2, all optional: description, **Needed after**, **Needed by** (with "Leave both empty if there's no fixed date"), area (PlaceField), how it could happen (handover options for the kind), and per kind: how long (Borrow), how much (Receive/Trade), "What you could give back" rows with "Add another" (Trade; "Leave this empty if you're open to talking about it"), how long each time, how many times, and times that suit you (Service). Submit "Post request" → `/requests/[id]`. The unfinished form is kept if the member opens a suggestion and comes back. |
| `/requests/[id]` | `close`, `reopen`, `link`, `unlink`, `flag`, `post`, `removeMessage` | member | Title, kind, "Asked by <name>", description in a quoted box, details table ("Needed between 8 and 9 Nov", area, handover, how long / how much / give-back / sessions), "The date has passed" note for the asker when it has. **Offered for this request**: linked listings as cards with helper name, state ("No longer available" when paused or closed), and for the asker "Ask to borrow" / "Ask for this" / … linking to the listing page. Primary action — others: **I can help with this** → `/listings/new?forRequest=<id>`, with a secondary "Link one of your listings" (pop-up listing their matching available listings; no-JS page `/requests/[id]/link`); asker: **Edit request**, secondary "Close request" (confirmation). Closed: "Closed: settled by an agreement" / "Closed by <name>", "Reopen" for the asker. Then the public thread (below). "Raise an issue" pop-up for others (no-JS page `/requests/[id]/issue`). |
| `/requests/[id]/edit` | `default` | asker, open | The request form, filled in. "Save changes". |
| `/requests/[id]/link` | `default` | non-asker | The page behind "Link one of your listings": radio list of the member's available listings of the matching type, "Link this listing"; none → "You don't have a matching listing. You can make one." with a link to `/listings/new?forRequest=<id>`. |
| `/requests/[id]/issue` | `default` | non-asker | The page behind "Raise an issue" (no JavaScript). |
| `/requests/[id]/messages/live`, `/listings/[id]/messages/live` | GET (Server-Sent Events) | member | Pass through the API's public thread streams. |

## Listings (changed)

| Route | Actions | Access | Behaviour |
|-------|---------|--------|-----------|
| `/listings/new` | `default` | member | `?forRequest=<id>`: a note "You're answering <asker>'s request: <title>" with a link; the type is fixed to the one that answers the request; fields prefilled per spec FR-012 and changeable. After posting, if the link couldn't be made, the listing page says why calmly ("The request was closed, so this listing wasn't linked to it. Your listing is up as usual."). |
| `/listings/[id]` | adds `post`, `removeMessage`, `flagMessage` | member | "Made for <asker>'s request: <title>" line with a link when it answers an open request. For the asker of a linked request, the proposal button carries the request so the form is prefilled; if linked to several of their requests, the proposal form asks "Which request is this for?" first. Public thread below the details. |
| `/listings/[id]/propose` | `default` | non-owner | `?request=<id>`: prefilled from the request (research §3) and tied to it; a line "This is for your request: <title>. When it's accepted, your request closes." |
| Find result cards | — | member | "Made for <asker>'s request" line when it answers an open request. |

## Public thread (on `/requests/[id]` and `/listings/[id]`)

A section **Public messages** with a refresh button beside the heading. New messages and removals
appear live (`/requests/[id]/messages/live`, `/listings/[id]/messages/live` pass through the API
streams), announced politely ("New message from Sam"); without JavaScript, reload or the refresh
button shows them. Messages oldest first with
author and time; "Show earlier messages" above when there are more than 20 (no-JS: link with
`?before=`). Removed: "Message removed". Each of my own messages has "Remove" (with confirmation)
and, if someone raised an issue about it, the request shown beneath it. Others' messages have a
quiet "Raise an issue" link (pop-up; no-JS page `/public-messages/[id]/issue`). The box: label
"Write a public message", hint "Everyone in wunan can read this. Please don't share phone numbers or
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
