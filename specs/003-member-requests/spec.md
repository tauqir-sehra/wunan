# Feature Specification: Requests for Things

**Feature Branch**: `003-member-requests`

**Created**: 2026-06-05

**Status**: Draft

**Input**: User description: "Members can make requests for things (a drill, a service, a bag of
rice, or a trade in reverse). Other members fulfil a request with a listing, which is linked to it.
The asker then makes a proposal as normal; once it's agreed, the request closes. The listing keeps
the normal listing lifetime. While filling out a request, listings that might already fulfil it are
shown."

## Context

Today wunan only works one way: a member lists what they have, and others find it (see
[001 spec](../001-community-resource-sharing/spec.md) and
[002 spec](../002-listing-proposals/spec.md)). If nobody has listed what you need, there is nothing
to find and no way to say you need it. This feature lets a member **ask** for something. Another
member who can help answers the request by making a listing for it, and the asker then makes a
proposal on that listing exactly as in 002. The request is a way to find each other; the exchange
itself still runs through listings, proposals and agreements, unchanged.

Terms used below:

- **Request**: what a member asks for: a short title, a description, a kind, and optional details.
- **Asker**: the member who posts a request. When they make a proposal on a listing they are the
  proposal's requester (002 terms).
- **Helper**: a member who answers a request with a listing; they are that listing's lister.
- **Linked listing**: a listing made (or chosen) to answer a request, connected to it. On screen
  a linked listing says it **fulfils** the request ("Fulfills <asker>'s request"); these docs say
  "answer" for the same thing.
- **Public thread**: short messages on a request or listing page that every member can read and
  post in. Separate from a proposal's private messages (002), which stay private.

Request kinds mirror the listing types:

| Request kind | Asker wants to… | Answered by a listing of type |
|---|---|---|
| Borrow | borrow something and give it back | Lend |
| Receive | be given something to keep | Gift |
| Trade | get something and give something back | Trade |
| Service | have something done for them | Service |

## Clarifications

### Session 2026-06-05

- Q: Should a listing made for a request be open to everyone straight away, or kept for the asker
  first? → A: Open to everyone straight away, but it stays tied to the request: the listing says
  which request it was made for, and the request shows it.
- Q: Where do others see requests? → A: On their own "Requests" page in the main navigation, with
  the same kind of filters as Find. Find stays about what's on offer.
- Q: Can members talk about a request before a proposal exists? → A: Yes, in a public thread on the
  request page that every member can read and post in. As a corollary, listings get a public thread
  too. Public messages are limited to 240 characters to keep threads calm.
- Q: Does a request close when the asker's proposal on a listing that isn't linked to it is
  accepted? → A: No. Only an accepted proposal by the asker on a linked listing closes it.
  Proposals are always made from a listing page; the asker browses the linked listings from the
  request and opens one to propose. Anyone can link one of their listings as possibly answering a
  request.
- Q: How does a request say when it's needed? → A: Two optional dates, labelled in plain words:
  "Needed after" and "Needed by". Both empty means "No fixed date"; only "Needed by" means any time
  up to that date; only "Needed after" means any time from that date on; both means between them.
- Q: Should there be a limit on how often a member can post in a public thread? → A: No limit beyond
  the 240-character length; floods are handled by raising issues.
- Q: Should request and public-thread notices have their own settings? → A: Yes, two new switches:
  "Someone offers something for your request" and "Public messages on your requests and listings",
  each with email and device choices, off until the member turns them on, like the existing ones.
- Q: Who can still read a public message the asker or lister hides? → A: No one can hide messages
  for now. Only the author can remove their own message; anyone can raise an issue about one.

### Session 2026-06-06

- Q: Do public threads update live? → A: Yes, new public messages appear without reloading, like
  proposal messages.
- Q: Must existing data or database migrations be kept? → A: No. Everything can be wiped and the
  database rebuilt from scratch.
- Q: What do the header buttons say? → A: "Request something" and "Offer something" ("Offer
  something" replaces "Share a new listing").
- Q: Is a safety cap on public messages acceptable despite "no limit"? → A: Yes. Public messages
  share the existing private-message cap of 60 per member per hour; there is no per-thread limit.
- Q: Do issues raised about a member's requests show a count? → A: Yes, on "My requests" and on the
  Requests navigation link, like "My listings" does for listing issues.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request something (Priority: P1)

Rana needs a drill for an afternoon. Nobody has listed one. She opens "Request something", picks
Borrow, writes "Drill for putting up shelves", sets "Needed after" and "Needed by" both to this Saturday, her area, and how long
(one day). She posts it. Other members can now see her request. It stays open until she closes it.

**Why this priority**: Without a request there is nothing to answer; this is the base of the feature
and already useful on its own, because people who see it can reach out by listing the thing.

**Independent Test**: Post one request of each kind with and without optional details, view each as
another member, and close one as the asker.

**Acceptance Scenarios**:

1. **Given** a signed-in member, **When** they post a Borrow request with only a title, **Then**
   the request is saved and shown to other members as open, with every empty detail shown as "Not
   decided yet" or left out.
2. **Given** a Borrow request form, **When** the member fills in when it's needed, area, how long, and how the
   handover could happen, **Then** those details are shown on the request.
3. **Given** a Receive request, **When** the member gives an amount and unit (e.g., 5 lb of rice),
   **Then** the amount is shown on the request.
4. **Given** a Trade request, **When** the member lists two things they could give back, **Then**
   both are shown; **When** they list none, **Then** the request says plainly they're open to
   talking about what to give back.
5. **Given** a Service request, **When** the member adds how long each time, how many times, and
   weekly times, **Then** those are shown.
6. **Given** an open request, **When** the asker chooses "Close request" and confirms, **Then** it
   shows as closed and no longer appears in the open requests others browse.
7. **Given** an open request, **When** the asker edits its details, **Then** the changes are shown
   and members who already answered it are told it changed.

---

### User Story 2 - See what's already available while asking (Priority: P1)

As Rana types "drill" in the request form, a short list appears: "These might already have what you
need", showing a drill that Sam listed last month. She opens it and asks to borrow it instead,
without posting a request.

**Why this priority**: The cheapest exchange is one that already exists. This keeps the community
from filling up with requests for things already on offer, and saves the asker a wait.

**Independent Test**: With a few listings in place, start a request whose title matches one and
whose kind matches its type; check the suggestion appears, opens the listing, and that posting the
request still works if none fits.

**Acceptance Scenarios**:

1. **Given** an available Lend listing titled "Cordless drill", **When** a member types "drill" in a
   Borrow request, **Then** that listing is suggested with its title, type, and area.
2. **Given** suggestions shown, **When** the member opens one, **Then** they see the listing page and
   can make a proposal; their unfinished request is kept so they can come back to it.
3. **Given** no listing matches, **When** the member types, **Then** no suggestion box appears and
   nothing gets in the way of posting.
4. **Given** the member's own listings, a paused or closed listing, or a listing of a type that
   doesn't answer the request's kind, **Then** none of them are suggested.

---

### User Story 3 - Answer a request with a listing (Priority: P1)

Sam sees Rana's request. He chooses "I can help with this". wunan opens the listing form for a Lend
listing, already filled in from the request (title, area, how long), which Sam adjusts and posts.
The new listing is linked to Rana's request, and Rana is told someone can help.

**Why this priority**: This is how a request turns into something that can be exchanged; it
completes the loop with the existing proposal flow.

**Independent Test**: As another member, answer one request of each kind; check the listing form is
prefilled, the listing is created as a normal listing, it is linked to the request, and the asker
is told.

**Acceptance Scenarios**:

1. **Given** an open Borrow request, **When** another member chooses "I can help with this",
   **Then** the listing form opens for a Lend listing, prefilled with the request's title,
   description, area, handover options, and loan length as the maximum loan.
2. **Given** an open Trade request listing two things the asker could give back, **When** a helper
   answers it, **Then** the Trade listing form is prefilled with those things as what the helper
   would accept, which the helper can change.
3. **Given** the prefilled form, **When** the helper changes anything and posts, **Then** the
   listing is saved as an ordinary listing with the helper's values, and is linked to the request.
4. **Given** a helper who already has a fitting available listing, **When** they answer the
   request, **Then** they may choose that listing instead of making a new one, and it is linked.
5. **Given** a listing made for a request, **When** any member views it, **Then** it says "Fulfills <asker>'s request: <title>" with a link, and anyone can still make a proposal on it.
6. **Given** a linked listing, **When** the asker opens their request, **Then** the listing is shown
   under "Offered for this request" with the helper's name and a button to make a proposal.
7. **Given** the asker, **When** they answer their own request, **Then** they can't ("I can help"
   isn't offered to them).
8. **Given** a closed request, **Then** "I can help with this" isn't offered.

---

### User Story 4 - From request to agreement (Priority: P1)

From her request, Rana looks through the linked listings, opens Sam's listing page, and chooses
"Ask to borrow" there. Because the listing is linked to her open request, the proposal form is
filled in from her request: Saturday, one day, her preferred handover. She sends it. Sam accepts,
the agreement is made, and Rana's request closes on its own. Sam's drill listing stays up like any
other Lend listing.

**Why this priority**: The point of a request is to end in an exchange; closing it automatically
means the asker doesn't have to remember to tidy up.

**Independent Test**: Answer a request, make a proposal from the request, accept it; check the
request closes, the listing follows its normal lifetime rules, and other helpers are told.

**Acceptance Scenarios**:

1. **Given** a listing linked to the asker's open request, **When** the asker makes a proposal on
   it from the listing page, **Then** the proposal is prefilled with the request's matching details (when, where, handover,
   loan length, amount, things offered in return, session length, times), all still changeable.
2. **Given** a proposal the asker made on a linked listing, **When** the lister accepts it, **Then**
   the request is closed, shows which agreement closed it, and no longer appears among open
   requests.
3. **Given** the request closes, **Then** the linked listing is unchanged except by the agreement
   itself, following its normal lifetime (a Lend listing stays until taken down; a Gift stays until
   all of it is given; a Service stays until taken down; a Trade until all is traded).
4. **Given** other listings linked to the same request, **When** the request closes, **Then** their
   listers are told the request was settled, and their listings stay up as normal listings.
5. **Given** a proposal the asker made on a listing that isn't linked to the request (e.g., one
   suggested while asking, or found in Find), **When** it's accepted, **Then** the request stays
   open; the asker can link that listing first, or close the request themselves.
6. **Given** another member (not the asker) makes a proposal on a linked listing, **When** it's
   accepted, **Then** the request stays open, and the asker sees if the listing has nothing left.

---

### User Story 5 - Browse requests and help (Priority: P2)

Sam wants to see what neighbours need. He opens "Requests" in the main navigation, ticks Service, sets his area,
and sees "Help moving a sofa" and "Bike tune-up". He answers the bike one.

**Why this priority**: Requests only work if helpers can find them; seeing them in one calm list is
the main way that happens. It's P2 because a link to a single request can still be shared without it.

**Independent Test**: With requests of each kind and area, filter by words, kind, and area; check
only open requests from other members appear, newest first, with the same paging as Find.

**Acceptance Scenarios**:

1. **Given** open requests of several kinds, **When** a member browses requests, **Then** they see
   each request's title, kind, area (neighbourhood and city only), when if given, the asker's name,
   and how many listings have been offered for it.
2. **Given** filters for words, kind, and area, **When** the member applies them, **Then** only
   matching open requests are shown, and the active filters are listed in words.
3. **Given** closed requests, **Then** they are not shown when browsing (the asker still sees their
   own under "My requests").
4. **Given** a member's own requests, **Then** they are listed under "My requests", open first, each
   with its offered listings and state.

---

### User Story 6 - Ask and answer in public (Priority: P2)

Sam isn't sure his drill suits Rana's wall, so he writes on her request: "Is it brick or plaster?"
Rana answers below. Kim, a neighbour, adds "Plaster needs a different bit, I have one". On Sam's
drill listing, someone else asks "Does it come with a charger?" and Sam replies there.

**Why this priority**: Quick questions settle whether to answer a request or make a proposal at
all, without starting a proposal just to ask. Keeping them short and public keeps them useful to
everyone and avoids a second private inbox.

**Independent Test**: Post, read, and delete messages on a request and on a listing as different
members; check the 240-character limit, that everyone sees them, that the asker or lister is told,
and that closed requests and listings are read-only.

**Acceptance Scenarios**:

1. **Given** an open request or an available listing, **When** any member posts a message of up to
   240 characters, **Then** it appears under the request or listing for every member, with the
   author's name and time, oldest first.
2. **Given** the message box, **Then** it shows how many characters are left, says plainly that
   everyone can read it and not to share contact details, and refuses messages over 240 characters
   with a plain explanation.
3. **Given** a new public message, **Then** the asker or lister is told (if they turned on "Public
   messages on your requests and listings"); members who posted in the thread are told of replies.
4. **Given** their own message, **When** a member deletes it and confirms, **Then** it shows as
   "Message removed".
5. **Given** a message that breaks the community's rules, **When** a member raises an issue about
   it, **Then** it is handled like other issues. No one but the author can remove or hide a
   message.
6. **Given** a closed request or a removed listing, **Then** its thread can still be read by those
   who can see the page, but no one can post.

---

### User Story 7 - Keep requests safe and tidy (Priority: P3)

A member posts something inappropriate as a request. Another member raises an issue about it, just
as with listings. When a member deletes their account or exports their data, their requests are
included.

**Why this priority**: Needed for trust and the constitution, but uses the existing patterns.

**Independent Test**: Raise an issue about a request; export data and find requests in it; delete
an account and check its open requests are closed.

**Acceptance Scenarios**:

1. **Given** another member's request, **When** a member raises an issue about it, **Then** it goes
   to the asker the same way listing issues do.
2. **Given** a member exports their data, **Then** their requests, details, links to listings, and
   public messages are included.
3. **Given** a member deletes their account, **Then** their open requests are closed and no longer
   shown, their public messages are removed, and listings linked to their requests stay as normal
   listings.

---

### Edge Cases

- **Request answered, then the listing is removed or paused**: the link stays, shown as "No longer
  available"; the request stays open.
- **Several helpers answer**: all linked listings are shown; the asker may propose on any; the first
  accepted proposal closes the request.
- **Asker has open proposals when the request closes**: other open proposals the asker made on
  other linked listings stay as they are; the asker is reminded they're still open and can withdraw them.
- **Partly met**: a Receive request for 10 lb of rice is met by a 5 lb gift; the request still
  closes on agreement. The asker can reopen a closed request to ask for more.
- **Request closed by hand while a helper is filling in the listing form**: the listing is still
  saved as a normal listing, and the helper is told the request was closed so it couldn't be linked.
- **Asker edits the request after it's answered**: linked listings don't change; their listers are
  told what changed.
- **Helper answers with an existing listing of the wrong type**: not allowed; only listings whose
  type answers the request's kind can be chosen.
- **Place privacy**: a request's area shows only neighbourhood and city to others, like listings.
- **Asker deleted**: linked listings stay; the request disappears.
- **Contact details in a public message**: the box says not to share them; wunan doesn't block them,
  but the author can delete the message at any time.
- **One member posts a lot**: there's no per-thread limit and no hiding, only the shared cap of 60
  messages per member per hour (FR-023f); anyone can raise an issue about the messages. Notices stay at most one per thread per day (FR-023e), so a flood
  doesn't flood inboxes.
- **A busy thread**: messages are shown oldest first; long threads show the latest 20 with "Show
  earlier messages".
- **Public message vs proposal**: once a proposal exists, the proposal page points to its private
  messages for arranging the details; the public thread stays for general questions.
- **"Needed by" before "Needed after"**: refused with a plain message asking to fix the dates.
- **"Needed by" has passed**: the request stays open (it never closes on its own) but shows "The
  date has passed" to the asker, who can change it or close the request.
- **Request with no title**: refused with a plain message; a title is the only required field.

## Requirements *(mandatory)*

### Functional Requirements

**Making requests**

- **FR-001**: A member MUST be able to post a request with a title (required, up to 100 characters),
  an optional description (up to 2,000 characters), and a kind: Borrow, Receive, Trade, or Service.
- **FR-002**: Every request detail other than the title and kind MUST be optional, shown as "Not
  decided yet" or left out when empty.
- **FR-002a**: Every request MAY say when it's needed with two optional dates, "Needed after" and
  "Needed by" ("Needed by" not before "Needed after"). The request MUST show it in words: both empty
  "No fixed date"; only "Needed by" "Needed by <date>"; only "Needed after" "Any time after <date>";
  both "Needed between <date> and <date>" (or "Needed on <date>" when they're the same day). When the
  asker proposes from a linked listing, the proposal's date MUST be prefilled with "Needed after"
  (or left empty if there is none).
- **FR-003**: A Borrow request MAY hold: when it's needed (FR-002a), area, how the
  handover could happen (from the listing handover options for Lend), and how long (with the 002
  loan length units).
- **FR-004**: A Receive request MAY hold: when it's needed (FR-002a), area, handover, and an amount with a unit from the
  listing unit list (including lb and oz).
- **FR-005**: A Trade request MAY hold: when it's needed (FR-002a), area, handover, what is wanted with an optional amount
  and unit, and up to 10 things the asker could give back (description, optional amount and unit).
  With none listed, the request MUST say plainly the asker is open to talking about what to give
  back.
- **FR-006**: A Service request MAY hold: when it's needed (FR-002a) and, optionally, the weekly
  times that suit the asker (like the 002 service
  availability), area, handover, how long each time (minutes, hours, days, weeks), and how many
  times.
- **FR-007**: The asker MUST be able to edit a request's details while it is open, and to close it
  at any time, with confirmation. The asker MUST be able to reopen a closed request.
- **FR-008**: A request MUST stay open until the asker closes it or an accepted proposal closes it
  (FR-016). Requests MUST NOT close for being quiet.

**Suggestions while asking**

- **FR-009**: While the asker fills in a request, wunan MUST show up to 5 available listings that
  might already answer it: matching words in the title, of the type that answers the request's
  kind, available, not the asker's own, those in the same neighbourhood or city as the asker's
  area first when an area is given.
- **FR-010**: Suggestions MUST update as the title changes, after a short pause, and MUST be
  announced politely to screen readers; with none, nothing is shown.
- **FR-011**: Opening a suggestion MUST keep the unfinished request so the asker can return to it.

**Answering requests**

- **FR-012**: Any member other than the asker MUST be able to answer an open request ("I can help
  with this") by making a new listing of the matching type, with the listing form prefilled from
  the request: title, description, area, handover options, and per kind: loan length as the
  maximum loan (Borrow); amount (Receive, Trade); things the asker could give back as things the
  helper would accept (Trade); session length, times, and number of times (Service).
- **FR-013**: A helper MUST also be able to answer with one of their own available listings of the
  matching type, instead of making a new one.
- **FR-014**: A listing answering a request MUST be an ordinary listing: visible and findable like
  any other, open to proposals from any member straight away, and following the normal listing
  lifetime rules. It MUST stay tied to the request: the listing page and its search result MUST say
  which request it was made for ("Fulfills <asker>'s request"), with a link.
- **FR-015**: A request MUST show its linked listings ("Offered for this request") with each
  helper's name, the listing's state, and a way to make a proposal; a listing MUST show which
  request it answers, with a link.

**Closing**

- **FR-016**: When a proposal the asker made on a listing linked to their request is accepted, the
  request MUST close and show the agreement that closed it. Accepted proposals on listings not
  linked to the request MUST NOT close it.
- **FR-017**: Proposals MUST still be made only from a listing page (002). When the asker proposes on
  a listing linked to their open request, the proposal MUST be prefilled from the request's matching
  details, each still changeable, following all 002 proposal rules. If the listing is linked to more
  than one of the asker's open requests, the asker MUST pick which one the proposal is for.
- **FR-017a**: Any member other than the asker MUST be able to link one of their own available
  listings of the matching type to an open request, as possibly answering it (FR-013); the asker
  MAY also link a listing they found, so a proposal on it can close the request.
- **FR-018**: Proposals by other members on a linked listing MUST NOT close the request.
- **FR-019**: Closing a request MUST NOT change any linked listing.

**Browsing**

- **FR-020**: Members MUST be able to browse open requests on their own "Requests" page in the main
  navigation, filtered by words, kind, and area, newest first, with paging like Find. Requests MUST
  NOT appear in Find.
- **FR-021**: Each request shown to others MUST show its title, kind, area as neighbourhood and city
  only, when it's needed in words (FR-002a), the asker's name, and the number of linked listings.
- **FR-022**: A member MUST be able to see their own requests ("My requests"), open first, with
  their linked listings and state. "My requests" and the Requests navigation link MUST show a count
  of issues raised about the member's requests that they haven't seen yet, as "My listings" does.

**Public threads**

- **FR-023**: Every request and every listing MUST have a public thread that all signed-in members
  can read and post in. This changes 002 FR-022 ("no messaging outside proposals") only for these
  public threads; proposal messages stay private to the two members.
- **FR-023a**: A public message MUST be plain text of 1 to 240 characters; the box MUST show the
  characters left and say that everyone can read it and not to share contact details.
- **FR-023b**: Messages MUST show oldest first with author and time; threads longer than 20 messages
  MUST show the latest 20 with "Show earlier messages".
- **FR-023c**: An author MUST be able to delete their own message (shown as "Message removed"). Others,
  including the asker or lister, MUST NOT be able to hide or remove it. Any member MUST be
  able to raise an issue about a message.
- **FR-023f**: There MUST be no per-thread limit on public messages beyond the 240-character length
  of each. As an abuse backstop, public and private messages together MUST be capped at 60 per
  member per hour, with 001's plain "slow down" message past it.
- **FR-023g**: New public messages and removals MUST appear on an open request or listing page
  without reloading, as proposal messages do (002 FR-025), announced politely to screen readers;
  without live updates the page still shows them on reload.
- **FR-023d**: Posting MUST stop when the request is closed or the listing is closed or removed; the
  thread stays readable to those who can see the page.
- **FR-023e**: The asker or lister MUST be told of new public messages, and members who posted in a
  thread MUST be told of later messages there, under the "Public messages" notification type
  (FR-024), at most one notice per thread per day.

**Notifications, safety, and data**

- **FR-024**: Notification settings MUST gain two types, each with the same email and device
  switches as the existing ones and off until the member turns them on: **"Someone offers something
  for your request"** (a listing is linked to your request; a request you answered is edited,
  closed, or reopened) and **"Public messages on your requests and listings"** (FR-023e). Notices
  are never urgent in tone.
- **FR-025**: Members MUST be able to raise an issue about a request, handled like listing issues.
- **FR-026**: The data export MUST include the member's requests, their links, and the member's
  public messages. Deleting an account MUST close the member's open requests and remove their public
  messages; linked listings stay.
- **FR-027**: All new screens MUST meet WCAG 2.2 AA and the calm-design rules: one primary action
  per screen, plain words, no urgency, keyboard usable, nothing by colour alone.
- **FR-028**: Request places MUST use the 002 place field and its privacy rules: full place kept,
  only neighbourhood and city shown to others.

### Key Entities

- **Request** (new): asker, kind (Borrow, Receive, Trade, Service), title, description, state (Open,
  Closed), how it closed (by the asker, by an agreement, by account deletion), the agreement that
  closed it, and optional details: needed after and needed by (dates), weekly times (Service), area,
  handover options, loan length, amount and unit, session length, number of times.
- **Request give-back item** (new): one thing a Trade asker could give back; description, optional
  amount and unit.
- **Request link** (new): connects a request and a listing that answers it; who linked it and when.
- **Listing** (changed): may be linked to requests it answers.
- **Proposal** (changed): may record the asker's request it answers (only for a listing linked to
  that request), so acceptance can close it.
- **Public message** (new): belongs to a request or a listing; author, text (1–240 characters),
  time, and state (shown, or removed by its author).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can post a request with just a title and kind in under 1 minute.
- **SC-002**: A helper can answer a request with a new listing in under 3 minutes, starting from the
  request page, where every detail the request already gives is prefilled, so only details the
  request left empty need typing.
- **SC-003**: 100% of requests whose asker's proposal is accepted close without the asker doing
  anything more.
- **SC-004**: When a matching available listing exists, it is shown to the asker within 2 seconds of
  typing a matching word, in at least 9 of 10 tries.
- **SC-005**: In usability testing with members not confident with technology, at least 4 of 5 can
  post a request, and at least 4 of 5 can answer one, without help.
- **SC-006**: No linked listing is changed or removed when its request closes.
- **SC-007**: 100% of public messages are 240 characters or fewer, and a member can post one in
  under 30 seconds from the request or listing page.

## Assumptions

- Requests reuse 002's building blocks: place field and place privacy, handover options per type,
  units (including lb and oz), loan lengths, session lengths, weekly times, and the proposal rules.
- A request has no expiry and no 30-day quiet close; it stays open until closed (as the description
  says).
- Requests have no photos in this feature.
- A request may have any number of linked listings; a listing may answer more than one request.
- The header has two outlined buttons, **Request something** and **Offer something** ("Offer
  something" replaces "Share a new listing"), so each page keeps one filled primary action.
  "Request something" is also the primary action on the Requests page.
- Public threads have no reactions, likes, or counts beyond the number of messages (constitution I).
- Reopening a closed request keeps its links; listings linked before it closed stay shown.
- No new notification channels: the two new types use the existing email and device delivery.
- No existing data or migrations need keeping: the database may be wiped and rebuilt from scratch.
