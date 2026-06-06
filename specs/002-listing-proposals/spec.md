# Feature Specification: Proposals for Offerings

**Feature Branch**: `002-listing-proposals`

**Created**: 2026-06-05

**Status**: Draft

**Input**: User description: "Agreement regarding an offering needs a different workflow: offerings get
'how it happens' details and trades list several things accepted in return; members make a proposal
on an offering (borrow, receive a gift, trade, receive a service) with when, where, how and how much;
the proposal page holds its details and its messages; the lister accepts before the agreement is
confirmed; messages belong to proposals; lb and oz units; days and weeks for service length;
location pickers with autocompletion."

## Context

This feature changes how an exchange is arranged in wunan (see
[001 spec](../001-community-resource-sharing/spec.md)). Today a member messages the owner, they agree
in conversation, the owner records an agreement and the other member confirms it. With this
feature, the member who wants something **makes a proposal** on the offering. The proposal is one
page holding what is being asked for, the handover details, and the messages about it. Only the
requester fills in or changes the details, and whatever the proposal says is what the requester
has agreed to. Once every detail is filled in, the lister can accept it at any time, and it becomes
the agreement.

Terms used below:

- **Lister**: the member who posted the offering.
- **Requester**: the member who makes a proposal on someone else's offering.
- **Handover**: how the thing or service gets from one member to the other (the "how").
- **Proposal details**: the when, where, how, and how much of a proposal.

## Clarifications

### Session 2026-06-05

- Q: Can members message without an offering, and where does a problem report's discussion live? →
  A: No general messaging; messages only in proposals; problem reports keep their own discussion.
- Q: Where do place suggestions come from? → A: An outside place-search service the operator
  chooses (replaceable, self-hostable); lets wunan check "within the offering's area".
- Q: What form do a service's available times take? → A: Weekly days with time ranges, checked.
- Q: Who agrees to what? → A: The proposal's details are the requester's agreement; only the
  requester changes them; the lister accepts a complete proposal at any time.
- Q: What happens to other proposals when one is accepted? → A: If nothing is left, they close and
  requesters are told; if some is left, they stay and can be amended to fit.
- Q: How are offering places stored and shown? → A: Full place kept; only neighbourhood and city
  shown, full place revealed to the requester once accepted.
- Q: Does a lent-out item close other lend proposals? → A: No; it comes back. Loans are periods;
  a lend proposal can be accepted for any period not overlapping an accepted loan.
- Q: For a handover at the lister's place, how is "where" filled in? → A: Automatically from the
  offering's area; the requester sees neighbourhood and city until accepted.
- Q: What counts as "within the offering's area" for a service? → A: Same neighbourhood, or same
  city when the area is a whole city.
- Q: Can mediators read a reported agreement's proposal messages? → A: Only if the reporter or
  reported member chooses to share them; agreement details are always visible to mediators.
- Q: Can members message after a proposal ends? → A: Yes on accepted proposals; declined,
  withdrawn, and closed ones are read-only.
- Q: Do quiet open proposals close by themselves? → A: Yes, after 30 days with no activity; both
  members are told.
- Q: Must existing data be kept? → A: No; nothing is in production, the database can be rebuilt,
  no conversion steps in the repo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Make a proposal and have it accepted (Priority: P1)

Robin sees Sam's offering "Drill (lend), up to 3 days". Robin taps "Ask to borrow", which creates a
proposal. Robin can fill in when to pick it up, where, how (Sam drops it off, Robin picks it up,
meet somewhere else, or online), and for how long, or leave any of these empty and write a message
instead. Sam opens the proposal, sees the details and messages on one page, and asks by message for
Saturday morning. Robin updates the proposal, and Sam accepts it. The proposal is now a confirmed
agreement for Saturday to Tuesday. The drill shows as lent out during those days, and other
members can still ask to borrow it for days when it's free.

**Why this priority**: This is the new core way to arrange any exchange; nothing else in this
feature is useful without it.

**Independent Test**: With two members and one offering of each type, create a proposal, exchange a
message, fill in all details as the requester, accept as the lister, and see the agreement and
offering status.

**Acceptance Scenarios**:

1. **Given** an available offering, **When** a member who isn't the lister opens it, **Then** they
   see one primary action that names the proposal for that type: "Ask to borrow" (Lend), "Ask for
   this" (Gift), "Offer a trade" (Trade), or "Ask for this service" (Service).
2. **Given** a new proposal, **When** the requester leaves when, where, and how empty and writes a
   message, **Then** the proposal is created with those details shown as "Not decided yet" and the
   message appears on the proposal page.
3. **Given** a proposal with any detail still empty, **When** the lister opens it, **Then** they see
   which details the requester still needs to fill in, and cannot accept it yet.
4. **Given** a proposal with every detail filled in, **When** the lister accepts it, **Then** it
   becomes a confirmed agreement with no further step, the offering's status and remaining amount
   update, and the requester is told.
5. **Given** an open proposal, **When** the requester changes a detail, **Then** the change is shown
   in the proposal's history ("Robin changed the pickup time to Saturday, 10:00"), and the lister
   can accept the new details. The lister cannot change details; they ask by message.
6. **Given** an open proposal, **When** the lister declines it or the requester withdraws it,
   **Then** it closes with a note in its history, the offering is unaffected, and the other member
   is told.

---

### User Story 2 - Say how the handover happens when offering (Priority: P1)

When Sam lists the drill, Sam chooses how the handover can happen: "I can drop it off", "Pick it up
from me", "Meet somewhere else" (Sam enters the place), or "Online". Requesters choose from those
options in their proposal.

**Why this priority**: Proposals need the lister's handover options to offer sensible choices.

**Independent Test**: Create one offering of each type with handover options, view it as another
member, and see the options both on the offering and in a new proposal.

**Acceptance Scenarios**:

1. **Given** a member creating a Lend or Gift offering, **When** they reach "How the pickup
   happens", **Then** they can tick one or more of: Dropped off to the recipient, Picked up from
   me, Meet somewhere else, Online.
2. **Given** a Trade offering, **When** the member reaches "How the trade happens", **Then** the
   options are: At the recipient's, At my place, Meet somewhere else, Online.
3. **Given** a Service offering, **When** the member reaches "How the service happens", **Then** the
   options are: At the recipient's, At my place, Somewhere else, Online.
4. **Given** "Meet somewhere else" is ticked, **When** the member saves without entering a place,
   **Then** they are told a place is needed for that option.
5. **Given** an offering with handover options, **When** a requester picks "how" in a proposal,
   **Then** only the lister's ticked options are offered.

---

### User Story 3 - List several things accepted in a trade (Priority: P2)

Kim lists sourdough starter for trade and adds what they'd accept: "Eggs, 6 item", then taps "Add
another" and adds "Honey, 1 item". Ana offers a trade and picks eggs. A second trade offering with
nothing added shows "Open to offers: Kim hasn't listed anything specific", and a requester there
describes their own offer.

**Why this priority**: Trades are less common than lends and gifts, but the old single "wanted"
field and separate "Open to offers" tick are being replaced.

**Independent Test**: Create a Trade offering with two accepted items and one with none; make a
proposal on each.

**Acceptance Scenarios**:

1. **Given** a member creating a Trade offering, **When** they fill in "What you'd accept in
   return", **Then** they can add pairs of what and how much (amount and unit, optional), and add
   another pair with an "Add another" button, up to 10.
2. **Given** a Trade offering with nothing added under "What you'd accept", **When** anyone views it
   or its form, **Then** it plainly says the lister is open to offers; there is no separate "Open
   to offers" choice.
3. **Given** a Trade offering with accepted items, **When** a requester makes a proposal, **Then**
   they choose one or more of those items (and how much of each) as their offer.
4. **Given** a Trade offering that's open to offers, **When** a requester makes a proposal, **Then**
   they describe what they offer in their own words, optionally with an amount and unit.

---

### User Story 4 - Ask for a service within what's offered (Priority: P2)

Jo offers "Bike repair", 1 hour each time, 4 times available, at Jo's place or online, on weekday
evenings. Leo asks for the service: 2 times, 1 hour each, at Jo's place, next Tuesday at 18:00.
wunan only accepts choices that fit what Jo offered.

**Why this priority**: Services have the most detail to negotiate, and limits keep requests
sensible.

**Independent Test**: Create a service offering with session length, number of times, handover
options, area, and available times; try a proposal inside and outside each limit.

**Acceptance Scenarios**:

1. **Given** a service offering with a session length, **When** a requester enters how long each
   time, **Then** it must not exceed the offering's session length. Units are minutes, hours, days,
   or weeks.
2. **Given** a service offering with a number of times remaining, **When** a requester asks for
   more times than remain, **Then** they are told how many remain.
3. **Given** a service offering with available times, **When** a requester picks a time outside
   them, **Then** they are told when the service is available.
4. **Given** a service offering with an area, **When** a requester picks a place outside that area,
   **Then** they are told the service is offered in that area only.

---

### User Story 5 - Everything about an exchange on one page (Priority: P2)

Robin opens "My proposals" and sees each proposal with its offering, the other member, its state
("Waiting for Sam", "Needs details", "Agreed"), and the latest message. Opening one shows the
current details at the top and the messages below, where Robin can also share contact details or
suggest a call time.

**Why this priority**: Members who find technology hard need one place to look, not a separate
inbox and agreement page.

**Independent Test**: With proposals in several states, open the list and each page; send a
message, share contact details, and suggest a call time from a proposal page.

**Acceptance Scenarios**:

1. **Given** a member with proposals they made and received, **When** they open their proposals,
   **Then** they see both, grouped as "Asked by me" and "On my offerings", with each one's state.
2. **Given** a proposal page, **When** a member reads it, **Then** the current details appear
   first, with each empty one marked "Not decided yet", and the messages follow in order.
3. **Given** a proposal page, **When** a member shares contact details or suggests a call time,
   **Then** it works as before (explicit confirmation for contact details), inside the proposal.
4. **Given** the proposal page is open, **When** the other member sends a message or changes a
   detail, **Then** it appears without reloading, quietly, as messages do today.

---

### User Story 6 - New units and lengths (Priority: P3)

A member gives away "2 lb of coffee beans"; another offers a service lasting "2 days" each time.

**Why this priority**: Small additions that remove friction for common cases.

**Independent Test**: Create a gift with lb, a gift with oz, and a service with a length in days and
in weeks; view each.

**Acceptance Scenarios**:

1. **Given** the amount unit list, **When** a member picks a unit, **Then** lb and oz are offered
   alongside the existing units.
2. **Given** a service offering, **When** the member sets how long each time, **Then** minutes,
   hours, days, and weeks are offered.

---

### User Story 7 - Pick places easily (Priority: P3)

When entering an area, a meeting place, or a handover place, a member starts typing "Riv" and sees
suggestions such as "Riverside" or "Riverside Library" to pick from.

**Why this priority**: Typing places is error-prone for less confident members, and constraints
like "within the offering's area" need places wunan understands.

**Independent Test**: Type part of a neighbourhood, a city, a street address, and a business name in
each place field; pick a suggestion; use the keyboard only.

**Acceptance Scenarios**:

1. **Given** any place field, **When** a member types three or more characters, **Then** up to 8
   matching suggestions (addresses, neighbourhoods, cities, business names) appear, usable by
   keyboard and announced to screen readers.
2. **Given** no suggestion fits, **When** the member keeps their own text, **Then** it is accepted
   as typed.
3. **Given** an offering place that is a full street address, **When** anyone views the offering,
   **Then** only its neighbourhood and city are shown. **When** a proposal on it is accepted,
   **Then** the full address is shown to that requester on the proposal and agreement.

### Edge Cases

- **Several proposals on one offering**: allowed. When one is accepted and nothing is left (amount
  or sessions at zero), every other open proposal on it closes and its requester is told why. Lend
  items always come back, so lend proposals never close for this reason (see "Overlapping loans"). When some is left but less than another proposal asks for, that proposal
  stays open, its requester is told how much remains, and it can't be accepted until they amend it.
- **Offering changes during a proposal**: if the lister edits, pauses, or removes the offering, open
  proposals stay; any detail that no longer fits the offering is marked "Needs a new choice" and the
  proposal can't be accepted until the requester amends it.
- **Gift amount**: defaults to all that remains; it can't exceed what remains or be zero.
- **Overlapping loans**: a lend proposal whose borrowing period overlaps an accepted loan of the
  same item can't be accepted. It stays open, its page shows the dates already taken, and its
  requester is told and can amend the dates.
- **Earlier loan not back in time**: if a loan isn't marked returned by the next loan's pickup, the
  lister and the next borrower both see this on the next loan; reminders follow the 001 rules.
- **Loan length**: must not exceed the offering's maximum loan length; the return date is the pickup
  time plus the loan length.
- **Quiet proposals**: an open proposal with no activity for 30 days closes; the requester can make
  a new one.
- **Times in the past**: a proposal whose "when" has passed can't be accepted; the requester is asked
  to pick a new time.
- **Online handover**: no place is needed; "where" is not asked.
- **Proposing on your own offering**: not offered.
- **A member leaves wunan**: their open proposals close with a note; agreed ones keep their record
  as today.
- **Suggestions not available**: if place suggestions can't be fetched, the field works as plain
  text and says so quietly.
- **Change just before accepting**: the lister accepts exactly the details they were shown; if the
  requester changed them in the meantime, the lister is shown the new details and asked again.

## Requirements *(mandatory)*

### Functional Requirements

**Offering details**

- **FR-001**: Lend and Gift offerings MUST let the lister tick one or more ways the pickup happens:
  Dropped off to the recipient, Picked up from the lister, Meet somewhere else, Online.
- **FR-002**: Trade offerings MUST let the lister tick one or more ways the trade happens: At the
  recipient's, At the lister's, Meet somewhere else, Online.
- **FR-003**: Service offerings MUST let the lister tick one or more ways the service happens: At
  the recipient's, At the lister's, Somewhere else, Online.
- **FR-004**: When "Meet somewhere else" / "Somewhere else" is ticked, the offering MUST have a
  place entered. When an "at the lister's" option (Picked up from the lister, At the lister's) is
  ticked, the offering's area MUST be filled in. Leaving all handover options unticked MUST mean "to
  be agreed".
- **FR-004a**: When a proposal's handover is at the lister's, its "where" MUST be filled in
  automatically from the offering's area and not be editable by the requester; the requester sees
  only its neighbourhood and city until the proposal is accepted (FR-029).
- **FR-005**: Trade offerings MUST allow up to 10 things accepted in return, each a description with
  an optional amount and unit, added one at a time with an "Add another" button and removable.
- **FR-006**: A Trade offering with no accepted things MUST be shown, on the offering and in its form,
  as open to offers in plain words. The separate "Open to offers" choice MUST be removed.
- **FR-007**: The amount unit list MUST add lb and oz.
- **FR-008**: Service session length MUST allow minutes, hours, days, and weeks.
- **FR-009**: Service offerings MAY have weekly available times: one or more days of the week, each
  with a time range (e.g. Monday–Friday, 18:00–21:00). A proposal's time MUST fall within them.

**Proposals**

- **FR-010**: Any member other than the lister MUST be able to make a proposal on an Available
  offering, or on a Lend offering that is currently lent out (for later dates). The proposal names the offering, the requester, and the lister.
- **FR-011**: A Lend proposal MUST hold: when the pickup happens, where, how (one of the offering's
  pickup options, or any if none were ticked), and for how long (not more than the maximum loan
  length). Its borrowing period runs from the pickup time to the pickup time plus the loan length.
- **FR-011a**: A Lend offering MUST show the periods it is already lent for (accepted loans that
  haven't ended), to the requester and on the proposal form, so they can pick free dates. A Lend
  proposal MUST NOT be accepted if its borrowing period overlaps an accepted loan of the item that
  hasn't been marked returned.
- **FR-012**: A Gift proposal MUST hold: when, where, how, and the amount to receive, defaulting to
  all that remains and not more than that.
- **FR-013**: A Trade proposal MUST hold: when, where, how (one of the offering's trade options), the
  amount to receive (default all that remains), and what is offered in return: chosen from the
  offering's accepted things when there are any, or described freely when the offering is open to
  offers.
- **FR-014**: A Service proposal MUST hold: when, where, how, how long each time, and how many
  times. Each MUST fit the offering when the offering sets it: how long ≤ session length, how many ≤
  times remaining, when within the available times, and, when meeting somewhere else, where within
  the offering's area. "Within" means the place has the same neighbourhood as the offering's area, or
  the same city when the offering's area is a whole city. A place at the recipient's (drop-off) is
  never checked: how far is fine is agreed in messages.
- **FR-015**: Every proposal detail MUST be optional when the proposal is made and when changed, so
  members can agree details by message instead (Gift and Trade amounts start at all that remains).
- **FR-016**: Only the requester MUST be able to fill in or change details while the proposal is
  open; the proposal's current details are always what the requester has agreed to. Each change
  MUST appear in the proposal's history with the new value.
- **FR-017**: The lister MUST NOT be able to accept a proposal while any detail is empty or doesn't
  fit the offering; they MUST be shown which details need attention. Details that don't apply (place,
  when the handover is Online) are not required.
- **FR-018**: The lister MUST be able to accept a complete proposal at any time. Accepting MUST make
  it a confirmed agreement on exactly the details shown to the lister, with no further confirmation
  step.
- **FR-019**: When a proposal becomes an agreement, the offering status and remaining amount or
  times MUST update as agreements do today. If nothing is left (amount or sessions at zero), every
  other open proposal on the offering MUST close and its requester MUST be told. If some is left,
  other proposals asking for more MUST stay open but not be acceptable until amended, and their
  requesters MUST be told how much remains. For Lend, other open proposals MUST stay open; those
  that now overlap MUST not be acceptable until amended, and their requesters MUST be told.
- **FR-019a**: A Lend offering MUST show as Lent out (with its return date) only while a loan's
  period is in progress and the item isn't marked returned; otherwise it shows as Available.
- **FR-020**: The lister MUST be able to decline an open proposal, and the requester MUST be able to
  withdraw it, each with an optional note; the other member is told.
- **FR-020a**: An open proposal with no message, detail change, or other event for 30 days MUST
  close by itself, with a note in its history, and both members MUST be told. Accepted proposals
  never close this way.
- **FR-021**: The separate "record an agreement" and "confirm or dispute" steps from the 001 spec
  (its FR-022, FR-023, FR-024a) MUST be replaced by FR-018. Marking a loan returned, return
  reminders, agreement history, and problem reports on agreements MUST continue to work on
  agreements made from proposals.

**Messages**

- **FR-022**: Messages MUST belong to a proposal; there MUST be no separate inbox and no messaging
  a member outside a proposal. The one exception is a problem report: its discussion among
  reporter, reported member, and mediators MUST live on the report's own page, as today.
- **FR-022a**: Mediators on a problem report MUST see the agreement's details, but not the
  proposal's messages, unless the reporter or the reported member chooses to share them (after a
  confirmation step). Sharing MUST be noted in the report discussion and can't be undone.
- **FR-022b**: Members MUST be able to keep messaging on an accepted proposal (to arrange the
  handover and return). Declined, withdrawn, and closed proposals MUST be read-only; the requester
  can make a new proposal on the offering instead.
- **FR-023**: A proposal page MUST show its current details first, then its messages and history in
  order, with the message box, contact sharing (explicit confirmation as today), and call-time
  suggestions on the same page.
- **FR-024**: A member MUST be able to see all proposals they made and received in one list, each
  with its offering, the other member, its state, and whether there's something new.
- **FR-025**: New messages and detail changes MUST appear on an open proposal page without
  reloading, under the same quiet rules as messages today (001 FR-018a).
- **FR-026**: Notifications MUST map to the existing types: a new proposal, a message, or a change
  counts as "new messages"; a proposal becoming an agreement counts as "agreement confirmations".
  No new notification types are added.

**Places**

- **FR-027**: Every place field (offering area, offering meeting place, proposal place) MUST offer
  suggestions while typing: addresses, neighbourhoods, cities, and business names, from an outside
  place-search service chosen by the operator. Only the typed text MUST be sent to it, from
  wunan's server, never with anything identifying the member; the operator guide MUST say this
  is sent, and the service MUST be replaceable (including a self-hosted one).
- **FR-028**: Suggestions MUST be optional to use; typed text MUST be accepted as is.
- **FR-029**: Offering places (area and meeting place) MUST keep the full place entered, but show
  only its neighbourhood and city to other members. The full place MUST be shown to a requester
  only once their proposal is accepted.
- **FR-030**: Places in a proposal MUST be visible only to its two members (and, for a problem
  report on its agreement, to the mediators).

**Existing data and constraints**

- **FR-031**: No existing data needs to be kept. The database MAY be rebuilt from scratch, and the
  repository MUST NOT carry steps to convert data from the 001 structure.
- **FR-032**: All new screens and fields MUST meet WCAG 2.2 AA and the calm-design rules: one primary
  action per screen, visible labels, plain error messages, keyboard use, no urgency.
- **FR-033**: The data export MUST include proposals, their details, history, and messages.

### Key Entities

- **Offering** (changed): gains handover options (set of values per type), meeting place,
  accepted-in-return list (Trade), available times (Service); loses "open to offers" and the single
  "wanted" field; amount units gain lb and oz; session length units gain days and weeks.
- **Accepted thing** (new): one item a Trade offering accepts; description, optional amount and unit.
- **Proposal** (new): offering, requester, lister, type, state (Open, Agreed, Declined, Withdrawn,
  Closed), details (when, place, handover, loan length, amount, offered things or own offer,
  session length, times).
- **Proposal event** (new): a message, a detail change, acceptance, a contact share, or a
  call-time suggestion, with author and time; the proposal's history.
- **Agreement** (changed): created when a proposal is accepted, linked to it; for loans, holds the
  borrowing period (pickup to return); no longer has a
  pending/confirm/dispute stage.
- **Conversation** (replaced): its role passes to proposals; problem reports keep their own
  discussion (FR-022).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can make a proposal with no details filled in, from the offering page, in
  under 1 minute and 2 actions.
- **SC-002**: Two members can go from a new proposal to a confirmed agreement, all details filled
  in, in under 5 minutes of their combined time.
- **SC-003**: 100% of agreements made through proposals have every required detail filled in.
- **SC-004**: In usability testing with members not confident with technology, at least 4 of 5
  complete a proposal and agreement unaided, and can say where to find their messages.
- **SC-005**: Place suggestions appear within 1 second of typing for at least 95% of lookups.
- **SC-006**: All new screens pass a WCAG 2.2 AA audit with zero critical issues.

## Assumptions

- No community is using wunan in production yet, so existing data can be discarded (FR-031).
- Handover options on an offering are optional and may be several; a proposal picks exactly one.
- "When" is a date with an optional time of day; for Lend it is the pickup time, and the return
  date follows from the loan length.
- One lend offering is one item: loans can't overlap, but any number of future loans may be accepted
  for separate periods. No buffer time between loans is required; members arrange it in messages.
- Making or amending a proposal is the requester's agreement to its details; the lister's
  acceptance completes the agreement.
- The requester's trade offer is part of the proposal details and changes under FR-016.
- The 001 spec rules on no blocking, no ranking, no payments, and mediation still hold.
