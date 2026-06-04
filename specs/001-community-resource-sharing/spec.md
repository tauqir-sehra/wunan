# Feature Specification: Community Resource Sharing

**Feature Branch**: `001-community-resource-sharing`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "wunan is a tool to help members of a community share resources among
themselves. Users list resources they would like to share (tools to lend, leftover food, bulk
purchases to split, excess items, services, accommodation), with duration/amount limits, quantity,
photos, optional location, handoff method, and what they would accept in return (money, a trade,
negotiable, or a gift). Other users search listings, then arrange a call, exchange contact info, or
negotiate via direct messages. Once agreed, the listing is marked lent out, gifted, or its remaining
amount updated. Members join only by invitation from existing members, forming chains of trust; the
inviter is accountable for mediating conflicts involving their invitees. Every profile shows who
invited that member."

## Clarifications

### Session 2026-06-03

- Q: Should one wunan installation serve a single community, or many separate communities? → A: One
  community per installation; each community runs its own copy.
- Q: When an inviter can't resolve a reported problem, who should step in next? → A: Up the chain
  once (the inviter's own inviter), then to the founding members.
- Q: Who can remove a member, and what happens to their invitees? → A: Nobody; there is no removal
  and no punishment. Unresolved conflicts may stay unresolved. (Future version: show the number of
  unresolved conflicts on a member's profile.)
- Q: How should members sign in? → A: Email and password, with an emailed password-reset link.
- Q: If a listing is harmful or inappropriate, can anyone other than its owner hide it? → A: No.
  Members can flag a listing with a request to the owner; only the owner can take a listing down.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Join by invitation and see who vouches for whom (Priority: P1)

An existing member invites someone they know. The invitee accepts the invitation, creates a simple
profile, and becomes a member. Any member can open a profile and see who invited that person, and
follow the chain upward ("invited by … who was invited by …").

**Why this priority**: Every other feature depends on membership, and the invite chain is the trust
foundation of the whole community. Without it, nobody can safely share anything.

**Independent Test**: An existing member sends an invitation; the invitee joins; a third member views
the new profile and sees the inviter's name linked.

**Acceptance Scenarios**:

1. **Given** a member, **When** they create an invitation, **Then** they receive a personal invite
   link they can send by any means they choose.
2. **Given** a valid unused invitation, **When** the invitee opens it and completes the short sign-up,
   **Then** they become a member and their profile shows the inviter.
3. **Given** a used or expired invitation, **When** someone opens it, **Then** they see a plain message
   that the invitation is no longer valid and to ask the person who sent it for a new one.
4. **Given** any member's profile, **When** another member views it, **Then** they see the member's
   name, who invited them (linked), when they joined, and the members they have invited.
5. **Given** someone who is not a member, **When** they try to view listings or profiles, **Then**
   they are asked to sign in and see no community content.

---

### User Story 2 - List a resource to share (Priority: P1)

A member creates a listing for something they want to share: a tool, food, a bulk purchase to split,
excess goods, a service, or accommodation. They describe it, say how much is available, for how long
or under what limits, add photos if they want, choose whether and how precisely to share location,
describe how the handoff works, and say what they'd like in return (a gift, a set amount of money, a
specific trade, or "let's talk").

**Why this priority**: Listings are the core content; without them there is nothing to find or share.

**Independent Test**: A member creates a listing with only the required fields, then another with all
optional fields, and both appear correctly to other members.

**Acceptance Scenarios**:

1. **Given** a member, **When** they start a new listing, **Then** they are guided one step at a time
   and only the title, category, and type of exchange are required.
2. **Given** a member choosing "Lend", **When** they set a maximum lending period (e.g., 3 days) or
   choose "to be agreed", **Then** that term is shown on the listing.
3. **Given** a member listing a divisible or countable resource (e.g., 5 kg of rice, 1 drill, 1 hour
   of bodywork), **When** they enter quantity and unit, **Then** the listing shows the amount available.
4. **Given** a member, **When** they choose what they'd accept in return, **Then** they can pick one of:
   Gift (free), Money (with an amount), Trade (describing what they want), or Open to offers.
5. **Given** a member adding location, **When** they choose to share it, **Then** they can share only an
   approximate area (e.g., neighbourhood) publicly, and the exact address is never shown on the listing.
6. **Given** a member, **When** they describe the handoff, **Then** they can choose one or more of:
   I can drop off, Pick up from me, Meet at a specific place, or Online/remote, with an optional note.
7. **Given** a member who uploads photos, **When** the listing is published, **Then** the photos appear
   with a description field for alt text, and embedded location data is removed from the photos.
8. **Given** a member, **When** they view their own listing, **Then** they can edit, pause, or remove it.
9. **Given** a listing owned by someone else, **When** a member flags it and writes a request (e.g.,
   "please remove this, it isn't safe to share"), **Then** the owner is notified with the request and
   the flagging member's name, and the listing stays up unless the owner changes or removes it.

---

### User Story 3 - Find something that's available (Priority: P1)

A member looks for something they need. They type a word ("drill", "rice", "massage") or browse by
category, and can narrow results by exchange type (e.g., only gifts), category, and approximate area.

**Why this priority**: Sharing only happens if people can find what's available.

**Independent Test**: With several listings present, a member searches "drill" and filters by "Gift"
and sees only matching, available listings.

**Acceptance Scenarios**:

1. **Given** available listings, **When** a member searches by keyword, **Then** listings whose title or
   description match are shown, newest first.
2. **Given** search results, **When** the member filters by category, exchange type, or area, **Then**
   only matching listings remain, and the active filters are clearly shown and easy to clear.
3. **Given** a listing that is fully given away, lent out, paused, or removed, **When** a member
   searches, **Then** it is not shown as available (lent-out items may show "currently lent out").
4. **Given** no results, **When** a member searches, **Then** they see a calm message suggesting they
   try other words or clear filters.
5. **Given** a listing, **When** a member opens it, **Then** they see all details, photos, the owner's
   name, and who invited the owner.

---

### User Story 4 - Talk and arrange the exchange (Priority: P2)

A member interested in a listing sends the owner a direct message. They talk through details,
negotiate the terms, propose a time for a call, and—if both choose to—share contact details.

**Why this priority**: Members need a way to agree on details; but members could initially coordinate
outside the app, so this follows the core listing/finding flow.

**Independent Test**: Member A messages Member B about a listing; B replies; A shares their phone
number using the share-contact action; B sees it.

**Acceptance Scenarios**:

1. **Given** a listing owned by someone else, **When** a member taps "Message about this", **Then** a
   conversation opens linked to that listing.
2. **Given** a conversation, **When** either person sends a message, **Then** the other sees it in
   their conversations list, with unread conversations clearly but quietly indicated.
3. **Given** a conversation, **When** a member chooses "Share my contact details", **Then** they pick
   which details to share (e.g., phone, email) and confirm before anything is shared.
4. **Given** a conversation, **When** a member proposes a call time, **Then** the other person can
   accept or suggest another time, and the agreed time is shown in the conversation.
5. **Given** a member who feels unsafe, **When** they block another member, **Then** that member can no
   longer message them or see their listings.

---

### User Story 5 - Record what was agreed (Priority: P2)

Once two members agree, the owner records the outcome: the item was lent (with an agreed return date),
gifted, traded, or part of the amount was given away. The listing updates automatically. For loans,
the owner later marks the item as returned.

**Why this priority**: Keeps listings accurate so others don't chase things that are gone, and creates
a shared record that supports trust and mediation.

**Independent Test**: An owner records "Gave 2 kg of 5 kg rice to Member A"; the listing shows 3 kg
remaining. The owner records lending a drill until Friday; the drill shows as lent out; after marking
it returned it shows as available again.

**Acceptance Scenarios**:

1. **Given** a listing and a conversation with another member, **When** the owner chooses "Record an
   agreement", **Then** they select the other member, what happened (lent / gifted / traded / sold /
   split), the amount, and, for loans, the agreed return date.
2. **Given** a recorded agreement, **When** the other member is notified, **Then** they can confirm it
   or say "this isn't right", and the record shows whether it is confirmed.
3. **Given** a partial give-away, **When** recorded, **Then** the listing's remaining amount decreases,
   and the listing closes automatically when nothing remains.
4. **Given** a lent item, **When** the return date passes and it is not marked returned, **Then** both
   members get one gentle reminder, and the owner can mark it returned or report a problem.
5. **Given** a lent item, **When** the owner marks it returned, **Then** the listing becomes available
   again.

---

### User Story 6 - Ask for help when something goes wrong (Priority: P3)

If a borrowed item isn't returned or an exchange goes badly, a member can report the problem. The
inviter of the member being reported is notified and is responsible for helping resolve it.

**Why this priority**: Important for trust, but expected to be rare; the community can function before
this exists.

**Independent Test**: Owner reports that Member B has not returned a drill; Member B's inviter receives
a notification and can see the agreement record and open a three-way conversation.

**Acceptance Scenarios**:

1. **Given** a recorded agreement, **When** one party chooses "Report a problem", **Then** they describe
   the issue in plain words and confirm before sending.
2. **Given** a report about Member B, **When** it is submitted, **Then** Member B's inviter is notified
   and a shared conversation is opened between the reporter, Member B, and Member B's inviter.
3. **Given** an open report, **When** the inviter or the reporter marks it resolved, **Then** the report
   closes and the outcome note is kept on the agreement record.
4. **Given** a report the inviter cannot resolve, **When** the inviter or reporter escalates it,
   **Then** the inviter's own inviter is added to the shared conversation and notified.
5. **Given** a report already escalated once, **When** it is escalated again, **Then** all founding
   members are added to the shared conversation and notified; founding members are the final step.

---

### Edge Cases

- An inviter deletes their account: their invitees keep their membership; their profiles still show the
  original inviter (marked as "no longer a member"), and mediation for those invitees passes up to the
  next active member in the chain.
- The founding members have no inviter: their profiles show "Founding member".
- A member tries to invite themselves or an existing member's email: the invitation simply works as a
  link; joining with an already-registered email is refused with a plain message.
- Two people ask for the last of an item at the same time: only the owner records the agreement, so
  there is no automatic double-allocation; the second requester sees the updated amount.
- A member deletes their account while an item is lent to or from them: they are told of open loans
  before deletion and must confirm; the agreement record remains visible to the other party.
- A listing photo is very large or not an image: it is refused with a plain explanation.
- A member enters money terms for food or other gift-type categories: allowed; the member decides.
- A member is blocked by the owner: they cannot open the owner's listings or message them.
- A conflict is not resolved even after reaching the founding members: the report stays open with
  no penalty to anyone; members can still close it as resolved later.

## Requirements *(mandatory)*

### Functional Requirements

**Membership & trust**

- **FR-001**: The system MUST only allow people to join through an invitation from an existing member,
  except for founding members set up when the community is created.
- **FR-001a**: Members MUST sign in with email and password. Members MUST be able to reset a
  forgotten password via a single-use, time-limited link sent to their email. Sign-in errors MUST NOT
  reveal whether an email is registered, and repeated failed attempts MUST be slowed down.
- **FR-002**: Members MUST be able to create single-use invitation links that expire after 14 days and
  can be cancelled before use.
- **FR-003**: Every member profile MUST show the member's display name, who invited them (linked),
  join date, and the members they invited; this is visible to all members.
- **FR-004**: Members MUST be able to follow the invite chain upward from any profile.
- **FR-005**: Community content (listings, profiles, messages) MUST be visible only to signed-in members.
- **FR-006**: Each wunan installation MUST serve exactly one community; all members, listings, and
  conversations belong to that community. Other communities run their own separate installation.

**Listings**

- **FR-007**: Members MUST be able to create a listing with: title (required), category (required:
  Tool/Item to lend, Food, Bulk purchase to split, Things to give away, Service, Accommodation, Other),
  exchange type (required), description, quantity and unit, availability limits, photos, approximate
  location, handoff options, and what they'd accept in return.
- **FR-008**: Availability limits MUST support a maximum loan duration (in hours, days, or weeks), a
  session length for services, specific dates for accommodation, or "to be agreed".
- **FR-009**: "What I'd accept in return" MUST support: Gift, Money (amount and currency), Trade (free
  text of what's wanted), and Open to offers.
- **FR-010**: Handoff options MUST support: owner drops off, pick up from owner, meet at a named place,
  and online/remote, each with an optional note.
- **FR-011**: Location MUST be optional, MUST be shown only at an approximate area level on listings,
  and exact addresses MUST be shared only by the owner through direct messages.
- **FR-012**: Members MUST be able to add up to 6 photos per listing, each with an optional
  description used as alt text; location metadata MUST be removed from uploaded photos.
- **FR-013**: Owners MUST be able to edit, pause, resume, and remove their listings.
- **FR-013a**: Members MUST be able to flag another member's listing with a written request to its
  owner. The owner MUST be notified and shown the request and who sent it. Only the owner can edit or
  take down a listing; no other member, including founding members, can hide or remove it.
- **FR-014**: Each listing MUST have a status: Available, Partly available (with remaining amount), Lent
  out (with return date), Paused, or Closed.

**Finding**

- **FR-015**: Members MUST be able to search listings by keyword and browse by category.
- **FR-016**: Members MUST be able to filter by category, exchange type, and approximate area, and
  clear filters in one action.
- **FR-017**: Search MUST show only Available or Partly available listings by default, with an option
  to include items currently lent out.

**Messaging & arranging**

- **FR-018**: Members MUST be able to send direct text messages to other members, optionally linked to
  a listing.
- **FR-019**: Members MUST be able to share chosen contact details within a conversation only after an
  explicit confirmation step; contact details are never shown otherwise.
- **FR-020**: Members MUST be able to propose a call time in a conversation, and the other member can
  accept or propose another time. (The call itself happens outside wunan.)
- **FR-021**: Members MUST be able to block another member, preventing messages and hiding each other's
  listings.

**Agreements**

- **FR-022**: Listing owners MUST be able to record an agreement with another member: outcome (lent,
  gifted, traded, sold, split), amount, and for loans an agreed return date.
- **FR-023**: The other member MUST be notified and able to confirm or dispute the recorded agreement.
- **FR-024**: Recording an agreement MUST update the listing status and remaining amount automatically.
- **FR-025**: For loans, the system MUST send one reminder to both members on the day after the return
  date passes, and owners MUST be able to mark the item returned.
- **FR-026**: Each member MUST be able to see a history of their own agreements (given, received, lent,
  borrowed).

**Problems & mediation**

- **FR-027**: Either party to an agreement MUST be able to report a problem with it.
- **FR-028**: A problem report MUST notify the reported member's inviter and open a shared conversation
  among the reporter, the reported member, and that inviter.
- **FR-029**: Reports MUST be closable as resolved with an outcome note kept on the agreement record.
- **FR-029a**: The reporter or the responsible inviter MUST be able to escalate an unresolved report:
  the first escalation adds the inviter's own inviter; the second adds all founding members, who are
  the final step. Reports may remain unresolved indefinitely. If a mediator in the chain is a founding member or no longer a member, that step is
  skipped and the report goes to the next one.

**Non-extraction, safety, and calm design** (from the constitution)

- **FR-029b**: The system MUST NOT provide any way to remove, suspend, or penalize a member. Problem
  reports MUST NOT affect a member's access or visibility. (Members can still block each other per
  FR-021.)
- **FR-030**: The system MUST NOT show ads, use third-party tracking, or display engagement metrics such
  as view counts, likes, or rankings of members.
- **FR-031**: Notifications MUST be limited to: new messages, agreement confirmations, return
  reminders, problem reports, and listing flags; members MUST be able to turn each type on or off.
- **FR-032**: Members MUST be able to export all their data (profile, listings, agreements, messages)
  in a readable format, and delete their account.
- **FR-033**: wunan MUST NOT process payments; money amounts are recorded as agreed terms only, and
  payment happens between members outside the app.
- **FR-034**: All screens MUST meet WCAG 2.2 AA and the calm-design rules in the constitution.

### Key Entities

- **Member**: A person in the community. Display name, optional short bio, optional photo, join date,
  inviter (or "founding member"), contact details (private until shared), notification preferences.
- **Invitation**: Created by a member for one person. Inviter, status (unused, used, expired,
  cancelled), expiry, and the member who used it.
- **Listing**: A resource offered by a member. Owner, title, category, description, quantity and unit,
  remaining amount, availability limits, photos, approximate area, handoff options, what's accepted in
  return, status.
- **Conversation**: Messages between two members (or three, for a problem report), optionally linked
  to a listing; includes contact-sharing events and proposed call times.
- **Agreement**: A recorded exchange on a listing between owner and another member. Outcome type,
  amount, agreed return date (loans), returned date, confirmation status.
- **Problem Report**: Raised on an agreement. Reporter, reported member, responsible inviter,
  description, status, escalation level (inviter, inviter's inviter, founding members), outcome note.
- **Block**: One member blocking another.
- **Listing Flag**: A request from a member to a listing's owner. Listing, flagging member, request
  text, date, whether the owner has seen it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new invitee can go from opening an invitation to being a member with a profile in
  under 3 minutes.
- **SC-002**: A member can publish a simple listing (title, category, exchange type) in under 2 minutes,
  and a full listing with photos in under 5 minutes.
- **SC-003**: In usability testing with members who describe themselves as not confident with
  technology, at least 90% complete each core task (join, list, find, message, record agreement) on
  their first attempt without help.
- **SC-004**: Members find a matching listing in 3 or fewer actions from the home screen.
- **SC-005**: Every profile shows the inviter; 100% of members (other than founders) have a traceable
  invite chain.
- **SC-006**: Search results appear within 2 seconds for a community of up to 5,000 members and 20,000
  listings.
- **SC-007**: All screens pass a WCAG 2.2 AA audit with zero critical issues before release.
- **SC-008**: Lent items past their return date are marked returned or reported within 7 days in at
  least 80% of cases.

## Assumptions

- wunan does not handle money; members pay each other directly (consistent with the constitution's
  non-extraction principle and lower security risk).
- Calls happen outside wunan (phone or any app the members choose); wunan only helps agree on a time.
- No social-media sign-in.
- Members are adults; age verification is out of scope.
- There is no rating or review system; trust comes from the visible invite chain and recorded
  agreements, avoiding competitive or extractive reputation metrics.
- The web experience works on phones and computers; native mobile apps are out of scope for this
  feature.
- Invitations have no per-member limit initially.
- Listings stay up until the owner closes them or the amount runs out; there is no automatic expiry.
- The interface is in English initially, written in plain language.
- Out of scope for this version: showing the number of unresolved conflicts on a member's profile
  (planned for a future version).
