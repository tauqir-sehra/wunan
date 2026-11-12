# Feature Specification: Arrangements

**Feature Branch**: `004-arrangements`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Merge Proposals and Agreements into one 'Arrangements' page: one
timeline per exchange, from asked to agreed to returned."

## Context

Today an exchange lives in two places. While two members are working out the details it is a
**proposal**, listed under "Proposals". Once the lister accepts, an **agreement** is made and listed
under "Agreements", on a different page with a different address (see
[002 spec](../002-listing-proposals/spec.md)). The messages already carry over from one to the other,
but the member has to know which of the two lists to look in, and the story of one exchange (asked,
agreed, lent, returned) is split across two pages.

Members don't think in proposals and agreements. They think "the drill I'm borrowing from Fay". This
feature gives each exchange **one place**, called an **arrangement**, from the first ask to the end:

- **One list**, "Arrangements", replaces the "Proposals" and "Agreements" lists and their two places
  in the navigation.
- **One page per arrangement** shows where it stands, what happened so far as a short timeline, the
  details, what the member can do next, and the messages.

Nothing about the rules changes: who can accept, decline or withdraw, what must be filled in before
accepting, what an agreement records, loans and returns, and asking the invite chain for help all
stay as they are in 001 to 003. This feature changes where members find these things and how their
progress is shown.

## Clarifications

### Session 2026-11-09

- Q: Must links to proposal and agreement pages from before this change keep working? → A: No. Old
  addresses (in bookmarks and in emails already sent) don't need to be preserved.
- Q: Must existing data and its shape be kept or migrated? → A: No. The old schema doesn't need to
  be preserved and no migration steps are needed; existing proposals and agreements need not be
  carried over.
- Q: Must proposals and agreements stay separate things in the data? → A: No. An arrangement may be
  one thing with stages, if that makes more sense.
- Q: How should a helper from the invite chain see an arrangement they've been asked to help
  with? → A: They open the arrangement page read-only from the request for help: stage, timeline
  and agreed details, and the messages only if shared with them. It is not in their own
  "Arrangements" list.
- Q: When should an agreed gift, trade or service move to "Finished"? → A: When either member
  presses a new "Mark as done" button. Until then it stays under "In progress".
- Q: After a proposal is declined or withdrawn, does asking again for the same offering continue
  the same arrangement or start a new one? → A: It continues the same arrangement: it reopens as
  "Being arranged", keeps its messages, and the timeline shows the decline or withdrawal and the
  new ask.
- Q: Does a note that wunan writes (such as "marked as done" or "returned") put the arrangement
  under "Waiting on you" for the other member? → A: No. Only a message written by the other member
  counts as something new.
- Q: When is a loan under "Waiting on you" for its owner? → A: Only once it is past its due date.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See everything I'm arranging in one list (Priority: P1)

Sam has asked to borrow Fay's drill, agreed last week to give Olu some rice, and lent Rosa a ladder
that is due back tomorrow. Sam opens "Arrangements" and sees all three in one list, each saying in
plain words where it stands, with the ones that need Sam at the top.

**Why this priority**: This is the heart of the change: one place to look instead of two. Without it
nothing else here has value.

**Independent Test**: With one open proposal, one agreement, and one loan not yet returned, open
"Arrangements" and check that all three appear once each, with the right stage and under the right
heading.

**Acceptance Scenarios**:

1. **Given** a member has open proposals and agreements, **When** they open "Arrangements", **Then**
   each exchange appears exactly once, showing the thing, the other member, and its stage in words
   (for example "Needs details: when, how", "Waiting for Fay", "Agreed for Saturday 14 November",
   "Due back tomorrow", "Returned").
2. **Given** some arrangements need the member to do something (accept, fill in details, mark a loan
   returned, read a new message), **When** they open the list, **Then** those are under "Waiting on you"
   at the top, the ones still going are under "In progress", and finished or ended ones are under
   "Finished".
3. **Given** the navigation, **When** a member looks at it, **Then** there is one "Arrangements" link
   with one count (the number under "Waiting on you") where "Proposals" and "Agreements" used to be.
4. **Given** a member with no arrangements, **When** they open the list, **Then** it says so calmly
   and points to finding an offering or making a request.
5. **Given** a long list, **When** the member chooses "I asked" or "On my offerings", **Then** only
   those arrangements show, and choosing "All" shows everything again.

---

### User Story 2 - Follow one arrangement from start to finish on one page (Priority: P1)

Sam opens the drill arrangement. One page shows where it stands now, a short timeline of what has
happened (asked, agreed, due back), the details, the next thing Sam can do, and the messages. When
Fay accepts, Sam stays on the same page at the same address: the stage changes to "Agreed", the
timeline gains a line, and the agreed details are shown as settled.

**Why this priority**: The list tells a member where to go; this page is where they act. It removes
the jump from a proposal page to a separate agreement page.

**Independent Test**: Make a proposal, fill in the details, accept it as the lister, and mark the
loan returned, checking after each step that the same page shows the new stage and a new timeline
line, and that every action available before is still available.

**Acceptance Scenarios**:

1. **Given** an arrangement still being worked out, **When** either member opens it, **Then** they
   see its stage, what is still to settle, the details so far, the actions they had on the proposal
   page (change details, accept, decline, withdraw), and the messages.
2. **Given** the lister accepts, **When** the page updates, **Then** it stays where it was, the stage
   reads "Agreed", the timeline shows "Agreed" with the date, the agreed details are shown as
   settled and can no longer be changed, and the same messages are still there.
3. **Given** an agreed loan, **When** the owner marks it returned, **Then** the stage reads
   "Returned", the timeline shows "Returned" with the date, and the arrangement moves to
   "Finished" in the list.
4. **Given** an agreed gift, trade or service, **When** either member presses "Mark as done",
   **Then** the page stays where it was, the stage reads "Done" for both members, the timeline
   shows "Done" with the date and who marked it, and the arrangement moves to "Finished". Until
   then it stays under "In progress", however long ago the agreed day was.
5. **Given** an arrangement marked done by mistake, **When** either member presses "Not done
   yet", **Then** it goes back to "Agreed" and to "In progress".
6. **Given** any arrangement, **When** a member looks at the timeline, **Then** it lists, oldest
   first, the steps that have happened with their dates, and the steps still to come without a
   date, in plain words and never by colour alone.
7. **Given** an arrangement that ended without agreement (declined, withdrawn, or closed), **When** a
   member opens it, **Then** the stage says how it ended and why, in the same blame-free words used
   today. The messages can be read but not added to, and the only action offered is, for the
   requester while the offering is still available, "Ask again", which reopens this same
   arrangement with its messages and adds the new ask to the timeline.
8. **Given** an agreement with a request for help from the invite chain, **When** the two members
   open the arrangement, **Then** the request for help and its outcome appear on the page and in the
   timeline, as they do on the agreement page today.

---

### User Story 3 - Everything in wunan leads to the arrangement (Priority: P2)

Rosa gets an email saying Sam accepted. Its link opens the arrangement. So does "See your
arrangement" on the offering, and the link from her request that the agreement closed.

**Why this priority**: With one place per exchange, every way in must lead to it, or members land
on pages that no longer exist.

**Independent Test**: Follow the link in each kind of notification and from each page that points
to an exchange, and check each lands on the arrangement's page.

**Acceptance Scenarios**:

1. **Given** a notification (email or device) about a proposal, an agreement, a message, or a return
   reminder sent after this change, **When** the member follows its link, **Then** they arrive at
   the arrangement's page.
2. **Given** pages that point to an exchange (an offering's link to the member's own proposal, a
   request closed by an agreement, a request for help), **When** a member follows them, **Then**
   they arrive at the arrangement's page, and the words say "arrangement".
3. **Given** an address of a proposal or agreement page, or of the old "Proposals" or "Agreements"
   lists, **When** anyone opens it, **Then** they see the usual "couldn't find that page", which
   offers a way back into wunan.

---

### User Story 4 - Words and help match the one idea (Priority: P3)

A new member reads the help pages and the buttons. They talk about "arrangements" as one thing with
stages, and explain that "agreed" is the point where the details are fixed.

**Why this priority**: Consistent words make the change understandable, but the feature works
without them being perfect.

**Independent Test**: Read the help pages, navigation, page titles, notices, and notification
settings, and check that none sends the member to a "Proposals" or "Agreements" page that no longer
exists.

**Acceptance Scenarios**:

1. **Given** the help pages, **When** a member reads about proposing and agreeing, **Then** they
   describe one arrangement with stages, and where to find it.
2. **Given** the notification settings and notices, **When** a member reads them, **Then** they use
   the same words as the pages (a "proposal" is still the name for what you send to ask; an
   "agreement" is still what is recorded when it's accepted; both are stages of an arrangement).

---

### Edge Cases

- **Several members ask for one offering**: each requester has their own arrangement. If one is
  accepted and nothing is left, the others end with "Closed: nothing left" and move to "Finished".
- **A member asks again after a decline, withdrawal or closing**: the same arrangement reopens
  with its messages, and its timeline keeps the earlier ask and how it ended (FR-010a). Asking
  again after an arrangement was agreed (a second bag of rice next month) starts a new one.
- **Helpers from the invite chain** reach the arrangement only from the request for help. They can
  read it but not act on it, see its messages only if those were shared with them, and don't find
  it in their own "Arrangements" list. They can still open it after the request for help is over,
  as with agreements today.
- **The other member left wunan**: the arrangement stays in the list, in "Finished" if it was still
  open, saying it closed because one of you left.
- **A loan is overdue**: the stage says "It was due back" with the date, in the same calm words as
  today, and the arrangement stays under "Waiting on you" for the owner only until it is marked returned.
- **Old addresses**: links to proposal and agreement pages from before this change (bookmarks,
  emails already sent) are not kept. They show the usual "couldn't find that page".
- **Someone who isn't part of an arrangement** opens its address: they see the same "couldn't find
  that page", and learn nothing about it.
- **Very many finished arrangements**: "Finished" shows the most recent first, a page at a time, so
  the list stays quick to load and to read.
- **Without JavaScript**: the list, its filter, the page, and every action work as plain pages and
  forms.

## Requirements *(mandatory)*

### Functional Requirements

**The list**

- **FR-001**: There MUST be one "Arrangements" page listing every exchange the member is part of as
  requester or lister, each exactly once, whether it is still a proposal or already an agreement.
- **FR-002**: Each arrangement in the list MUST show the offering's title, the other member's name,
  the member's side of it in words (for example "You asked to borrow" or "Rosa asked for"), its
  stage in words, and, when there is one, the latest message's first line.
- **FR-003**: The list MUST be grouped under three headings, in this order: **"Waiting on you"**
  (the member can or must do something: details to fill in, a proposal ready to accept, a loan
  past its due date for its owner, or a message from the other member they haven't read; notes
  that wunan writes, such as "marked as done" or "returned", don't count), **"In progress"**
  (open or agreed and waiting on the other member or on a date, including an agreed gift, trade or
  service not yet marked as done), and **"Finished"** (returned, marked as done, declined,
  withdrawn, or closed). A heading with nothing under it is not shown.
- **FR-004**: Within each heading, arrangements MUST be ordered by what changed most recently first.
- **FR-005**: The list MUST offer a simple choice of "All", "I asked", and "On my offerings" that
  narrows it, works without JavaScript, can be bookmarked, and shows the current choice without
  changing text weight or size.
- **FR-006**: "Finished" MUST show the 20 most recent and offer "Show more" for older ones, adding
  them below without moving what is already on screen.
- **FR-007**: When the member has no arrangements, the page MUST say so in one calm sentence and link
  to offerings and to making a request.

**Stages**

- **FR-008**: Every arrangement MUST have exactly one stage at a time, shown in words, from this
  set: **Being arranged** (with what's missing or who it's waiting for, as the proposals list says
  today), **Agreed** (with the agreed day when there is one), **On loan** (with when it's due back,
  or that it was due back), **Returned**, **Done** (an agreed gift, trade or service that a member has
  marked as done), and **Ended** (declined, withdrawn, or closed, with the existing
  reason words).
- **FR-009**: The stage MUST follow from whether the arrangement is open, agreed or ended, its
  dates, whether a loan was marked returned, and whether a gift, trade or service was marked as
  done (FR-009a). Marking as done is the only new thing this feature asks of members.
- **FR-009a**: On an agreed gift, trade or service, either member MUST be able to press "Mark as
  done". It then reads "Done" for both, with the date and who marked it, and moves to "Finished".
  Either member MUST be able to take it back with "Not done yet". Marking as done changes nothing
  else (amounts left, the offering, and the request are as they were on agreeing) and is never
  required: wunan MUST NOT remind, count, or nudge members about arrangements not marked as done,
  and they MUST NOT appear under "Waiting on you" for that reason.

**The arrangement page**

- **FR-010**: Each arrangement MUST have one page with one address that stays the same from the
  first proposal to the end, including after it is accepted.
- **FR-010a**: When a requester asks for an offering and their earlier arrangement for that same
  offering ended without agreement (declined, withdrawn, or closed), that arrangement MUST reopen
  as "Being arranged" with the new details, instead of a new one being made. It keeps its address
  and its messages, moves back out of "Finished", and the lister is told as for any new proposal.
  A requester therefore has at most one arrangement per offering that isn't agreed. An arrangement
  that was agreed never reopens; asking again starts a new one.
- **FR-011**: The page MUST show, in this order: who and what it is (title, the other member, the
  offering, and the request it answers if any), the current stage, the timeline, the details, the
  actions, and the messages.
- **FR-012**: The timeline MUST list the steps that have happened, oldest first, each with its date:
  asked; details changed (the latest change only); agreed; lent from and due back (loans); returned
  (loans); done, with who marked it (gifts, trades, services); help asked and its outcome; and how it ended, if it ended without agreement. When an arrangement
  was reopened (FR-010a), each earlier ask and how it ended stay in the timeline. Steps still
  expected MUST be listed after them without a date (for example "Agreed" and "Returned" for a loan
  still being arranged, or "Done" for an agreed gift).
- **FR-013**: The timeline MUST be readable as text by screen readers, in order, and MUST NOT rely on
  colour, icons alone, or position alone to say which steps are done.
- **FR-014**: While being arranged, the page MUST offer every action the proposal page offers today,
  under the same rules: change details, accept (lister, only when nothing blocks it), decline
  (lister), withdraw (requester), each with its existing confirmation.
- **FR-015**: Once agreed, the page MUST show everything the agreement page shows today: the agreed
  details as a fixed record, the full place for those allowed to see it, the earlier-loan note, mark
  returned (owner), mark as done (FR-009a), requests for help and "Ask for help", under the same
  rules.
- **FR-016**: Accepting, declining, withdrawing, and marking returned MUST update the page in place:
  the page stays scrolled where it was, the result shows next to the button that was pressed, and
  the stage and timeline update without the member being sent to another page.
- **FR-017**: The page MUST have one primary action at a time: the next thing this member can do at
  this stage. Other actions are shown as secondary.
- **FR-018**: The messages MUST be the same single conversation before and after agreeing, shown
  beside the details on wide screens and after them on narrow ones, as they are today.

**Finding it from elsewhere**

- **FR-019**: The navigation MUST show one "Arrangements" link in place of "Proposals" and
  "Agreements", with one count: the number of arrangements under "Waiting on you". The count's meaning
  MUST be available to screen readers in words.
- **FR-020**: Every link inside wunan, and every link in an email or device notification sent after
  this change, that points to an exchange MUST lead to its arrangement page or to "Arrangements".
  The old proposal and agreement pages and lists MUST NOT remain as second ways in; their addresses
  need not keep working.
- **FR-021**: Only the requester and the lister may open an arrangement, plus helpers as FR-021a
  allows. Anyone else MUST get the same "couldn't find that page" answer as today.
- **FR-021a**: A helper brought in by a request for help MUST be able to open that arrangement's
  page from the request for help, under the same limits as helpers have on agreements today: only
  once it is agreed, read-only (stage, timeline, agreed details, the place in full, requests for
  help), with no actions, and with the messages shown only if they were shared with the helper. The
  page MUST say they are seeing it to help. The arrangement MUST NOT appear in the helper's own
  "Arrangements" list or count.
- **FR-022**: Pages that point to a proposal or agreement (offering, request, report, profile, help)
  MUST point to the arrangement and say "arrangement" where they name the place.

**Words, notifications, and data**

- **FR-023**: Help pages, page titles, notices, and notification settings MUST be updated so none
  names a "Proposals" or "Agreements" page. "Proposal" and "agreement" remain the words for the two
  stages' records.
- **FR-024**: Notification types, their switches, and when they are sent MUST stay as they are; only
  their links (FR-020) and wording (FR-023) change. Asking again (FR-010a) counts as asking, so the
  lister is told as for a new proposal.
- **FR-025**: The data export MUST include each of the member's arrangements in full: what was
  asked, the details, how it stands, the agreed record and its dates when there is one, and whether
  a loan was returned or the arrangement was marked as done. Its shape may differ from today's export of proposals and agreements.
- **FR-026**: All new and changed screens MUST meet WCAG 2.2 AA and the calm-design rules: one
  primary action per screen, plain words, no urgency, keyboard usable, nothing by colour alone,
  nothing that shifts when the member acts.
- **FR-027**: Nothing from before this change needs carrying over: old page addresses, the old
  shape of stored and exported data, and existing proposals and agreements need not keep working,
  and no migration is provided. Privacy is not relaxed: nobody may see an arrangement, its place,
  or its messages unless FR-021 allows it.

### Key Entities

- **Arrangement**: One exchange between a requester and a lister about one offering, from the first
  ask to its end. It is one thing with stages, not a proposal and a separate agreement: it holds
  what was asked and the details being worked out, then, once accepted, the agreed record (fixed
  from then on) with its dates and, for loans, when it was returned. It has one conversation, any
  requests for help, one stage at a time, and one page. Beyond what wunan records today it holds one new
  fact: whether, when and by whom a gift, trade or service was marked as done.
- **Stage**: Where an arrangement stands, worked out from whether it is open, agreed or ended, its
  dates, and whether a loan was returned.
- **Timeline step**: Something that happened in an arrangement, with its date (asked, details
  changed, agreed, lent, due back, returned, done, help asked, ended), or something still expected,
  without a date.
- **Proposal, Agreement**: No longer separate things. "Proposal" names an arrangement before it is
  accepted (and what the requester sends); "agreement" names its fixed record after.
- **Conversation, Request for help**: Unchanged from 001 to 003, attached to the arrangement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can find any exchange they are part of from one list, in one step from the
  navigation, without needing to know whether it has been agreed yet.
- **SC-002**: In usability testing with members not confident with technology, at least 4 of 5 can
  say what stage a given arrangement is at and what they can do next, within 30 seconds of opening
  it.
- **SC-003**: Going from "ready to accept" to seeing the agreed record takes one action and no
  change of page.
- **SC-004**: 100% of links inside wunan and in notifications sent after the change that point to
  an exchange open its arrangement page; none leads to a proposals or agreements page.
- **SC-005**: Everything a member could do on the proposal and agreement pages before the change
  can still be done, under the same rules, with no extra steps.
- **SC-006**: The navigation has one fewer main link, and its one count for arrangements equals the
  number shown under "Waiting on you".
- **SC-007**: The "Arrangements" list shows within 2 seconds for a member with 200 arrangements.
- **SC-008**: Nobody can open an arrangement, see its full place, or read its messages unless they
  could have for the same exchange before the change.

## Assumptions

- **The name is "Arrangements".** It is a plain word for "what you're arranging with someone" and
  covers both before and after agreeing. "Proposal" and "agreement" stay as plain words for an
  arrangement before and after it is accepted.
- **One arrangement per requester and offering until it's agreed.** Asking again after a decline,
  withdrawal or closing reopens it (FR-010a). Different requesters on one offering, and a new ask
  after an agreement, are separate arrangements.
- **One new thing to press, and it's optional.** "Mark as done" on gifts, trades and services is
  the only new record. It covers the whole arrangement (a service of several sessions is marked
  once), needs no confirmation because it can be taken back, and wunan never chases it.
- **A fresh start is fine.** Existing proposals, agreements, links, and the shape of stored and
  exported data don't need to be kept or migrated (see Clarifications). Other apps using wunan's
  programming interface for proposals and agreements would need to change to arrangements.
- **Rules are unchanged.** Who can do what, what blocks accepting, how places are shown, how loans
  and reminders work, quiet-month closing, and asking for help all stay as specified in 001 to 003.
- **Helpers see what they see today, on the new page.** What a helper may read, and for how long,
  follows the existing rules for requests for help (001, 002); only the page changes (FR-021a).
- **The grouping by "what kind of exchange" on the agreements list goes away** ("You lent", "You
  borrowed", …). The member's side is said in words on each arrangement instead, and the filter
  covers "I asked" and "On my offerings".
- **The two-column layout from the restyle is the starting point** for the arrangement page (details
  on the left, messages on the right on wide screens).
- **Depends on** 002 (proposals, agreements, places) and 003 (requests closing on agreement).
