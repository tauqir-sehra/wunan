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
- Q: Which modern stack should wunan be built on? → A: SvelteKit + TypeScript + PostgreSQL. (Project
  direction: use a modern stack; avoid unnecessary dependencies, but wunan need not be
  technologically minimal. Applied in the plan, not in the requirements.)
- Q: While a conversation is open, should new messages appear by themselves? → A: Yes, only inside an
  open conversation; everything else updates on reload. Live updates elsewhere may come later.
- Q: Email only, or also phone notifications? → A: Email plus optional device notifications, off
  until the member turns them on, with the same per-type switches.
- Q: Who will set up and run each community's copy of wunan? → A: Each community self-hosts; the
  volunteer running it is expected to have server experience.
- Q: Does wunan need to work in languages other than English? → A: English only, with no
  preparation for translation.
- Q: How detailed should listings be in this first version? → A: Simplified to three offering types:
  Lend, Gift, Trade. Each can have an amount with a unit chosen from a list. Lend can have a maximum
  loan length; Gift tracks the remaining amount; Trade describes what's wanted in return (optionally
  with an amount and unit) or is marked "open to offers". Categories, money terms, structured
  handoff options, and availability dates are dropped for now; handoff details go in the
  description or messages.
- Q: Should services be their own listing type? → A: Yes, a fourth type, Service, with how long each
  session lasts and how many times it is available.
- Q: Should members be able to block each other? → A: No. There is no blocking; every member can
  message any other member and see all listings.

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
2. **Given** a valid unused invitation, **When** the invitee completes the short sign-up, **Then**
   wunan emails them a confirmation link, and once they open it they become a member and their
   profile shows the inviter. The invitation stays reserved for 7 days while they confirm.
3. **Given** a used or expired invitation, **When** someone opens it, **Then** they see a plain message
   that the invitation is no longer valid and to ask the person who sent it for a new one.
4. **Given** any member's profile, **When** another member views it, **Then** they see the member's
   name, who invited them (linked), when they joined, and the members they have invited.
5. **Given** someone who is not a member, **When** they try to view listings or profiles, **Then**
   they are asked to sign in and see no community content.

---

### User Story 2 - List a resource to share (Priority: P1)

A member creates a listing for something they want to share, choosing one of four offering types:
**Lend** (e.g., a drill for up to 3 days), **Gift** (e.g., 5 kg of rice to give away), **Trade**
(e.g., a pair of sneakers for leather boots, or open to offers), or **Service** (e.g., a 1-hour
bodywork session, available 3 times). They give it a title, can
add an amount with a unit, a description, photos, and an approximate area.

**Why this priority**: Listings are the core content; without them there is nothing to find or share.

**Independent Test**: A member creates a listing with only the required fields, then another with all
optional fields, and both appear correctly to other members.

**Acceptance Scenarios**:

1. **Given** a member, **When** they start a new listing, **Then** they first choose Lend, Gift,
   Trade, or Service, and only the offering type and a title are required.
2. **Given** a member listing something countable or measurable (e.g., 5 kg of rice, 1 drill, 1 hour
   of bodywork), **When** they enter an amount and choose a unit from a list, **Then** the listing
   shows the amount available.
3. **Given** a member choosing Lend, **When** they set a maximum loan length (a number of hours, days,
   or weeks), **Then** it is shown on the listing (e.g., "Lend for up to 3 days"); if left empty, the
   listing says "Loan length to be agreed".
4. **Given** a member choosing Gift with an amount, **When** part of it is given away, **Then** the
   listing shows the remaining amount.
5. **Given** a member choosing Trade, **When** they describe what they'd like in return (optionally
   with an amount and unit, e.g., "2 kg of flour") or tick "Open to offers", **Then** the listing shows
   that; at least one of the two is required.
6. **Given** a member choosing Service, **When** they set how long each session lasts (e.g., 1 hour)
   and how many times it is available (e.g., 3), **Then** the listing shows "1 hour · 3 sessions
   available", and the count goes down as sessions are agreed.
7. **Given** a member adding location, **When** they choose to share it, **Then** they can share only an
   approximate area (e.g., neighbourhood) publicly, and the exact address is never shown on the listing.
8. **Given** a member who uploads photos, **When** the listing is published, **Then** the photos appear
   with a description field for alt text, and embedded location data is removed from the photos.
9. **Given** a member, **When** they view their own listing, **Then** they can edit, pause, or remove it.
10. **Given** a listing owned by someone else, **When** a member flags it and writes a request (e.g.,
   "please remove this, it isn't safe to share"), **Then** the owner is notified with the request and
   the flagging member's name, and the listing stays up unless the owner changes or removes it.

---

### User Story 3 - Find something that's available (Priority: P1)

A member looks for something they need. They type a word ("drill", "rice", "massage") or browse by
offering type (Lend, Gift, Trade, Service), and can narrow results by offering type and approximate area.

**Why this priority**: Sharing only happens if people can find what's available.

**Independent Test**: With several listings present, a member searches "drill" and filters by "Gift"
and sees only matching, available listings.

**Acceptance Scenarios**:

1. **Given** available listings, **When** a member searches by keyword, **Then** listings whose title or
   description match are shown, newest first.
2. **Given** search results, **When** the member filters by offering type or area, **Then**
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
   their conversations list, with unread conversations clearly but quietly indicated; if the other
   person has that conversation open, the message appears there without reloading.
3. **Given** a conversation, **When** a member chooses "Share my contact details", **Then** they pick
   which details to share (e.g., phone, email) and confirm before anything is shared.
4. **Given** a conversation, **When** a member proposes a call time, **Then** the other person can
   accept or suggest another time, and the agreed time is shown in the conversation.

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
   agreement", **Then** they select the other member, the amount (if the listing has one), and, for
   loans, the agreed return date, or for services, the number of sessions; the outcome (lent,
   gifted, traded, or provided) follows the offering type.
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

- An inviter deletes their account: their invitees keep their membership. Profiles and invite chains
  still show the inviter's display name with "(no longer a member)"; all other personal data is
  removed. Mediation for those invitees passes to the next active member in the chain.
- The founding members have no inviter: their profiles show "Founding member".
- A member tries to invite themselves or an existing member's email: the invitation simply works as a
  link; joining with an already-registered email is refused with a plain message.
- Two people ask for the last of an item at the same time: only the owner records the agreement, so
  there is no automatic double-allocation; the second requester sees the updated amount.
- A member deletes their account while an item is lent to or from them: they are told of open loans
  before deletion and must confirm; the agreement record remains visible to the other party.
- A listing photo is very large or not an image: it is refused with a plain explanation.
- A member wants money for a trade: they can write it in what they'd like in return (e.g., "$30");
  wunan only records it as text and never handles payment.
- A member needs a unit that isn't in the list: they choose "other" and describe it in the title or
  description.
- A member's sign-in runs out while they are filling in a form (e.g., a listing or a message): they
  are asked to sign in again on the same page, and what they typed is kept and sent once they have
  signed in. Chosen photos cannot be kept this way; the page says plainly that they need to be
  chosen again. Sign-ins last 30 days and renew while the member keeps using wunan.
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
- **FR-001b**: A new member's email address MUST be confirmed through a link sent to it before their
  account is active, so password resets always reach them. An account not confirmed within 7 days
  MUST be deleted, and its invitation can be used again (by the same email or another).
- **FR-002**: Members MUST be able to create single-use invitation links that expire after 14 days and
  can be cancelled before use.
- **FR-003**: Every member profile MUST show the member's display name, who invited them (linked),
  join date, and the members they invited; this is visible to all members.
- **FR-004**: Members MUST be able to follow the invite chain upward from any profile.
- **FR-005**: Community content (listings, profiles, messages) MUST be visible only to signed-in members.
- **FR-006**: Each wunan installation MUST serve exactly one community; all members, listings, and
  conversations belong to that community. Other communities run their own separate installation.

**Listings**

- **FR-007**: Members MUST be able to create a listing with: offering type (required: Lend, Gift,
  Trade, or Service), title (required), and optionally a description, an amount with a unit (not
  used for Service), photos, and an approximate area.
- **FR-008**: Amounts MUST be a positive number paired with a unit chosen from a fixed list: item,
  kg, g, litre, hour, portion, bag, box, other.
- **FR-009**: Lend listings MAY have a maximum loan length (a whole number of hours, days, or weeks);
  without one, the listing shows "Loan length to be agreed".
- **FR-010**: Trade listings MUST have either a description of what's wanted in return (optionally
  with an amount and unit) or "Open to offers" ticked, or both.
- **FR-010a**: Service listings MAY have a session length (a whole number of minutes or hours) and a
  number of times available (a whole number ≥ 1). When a number of times is set, the listing MUST
  show how many sessions remain and close automatically when none remain.
- **FR-011**: Location MUST be optional, MUST be shown only at an approximate area level on listings,
  and exact addresses MUST be shared only by the owner through direct messages. The area is a short
  free-text field with the hint "Your neighbourhood, not your address"; wunan does not check what is
  typed.
- **FR-012**: Members MUST be able to add up to 6 photos per listing, each with an optional
  description used as alt text; location metadata MUST be removed from uploaded photos.
- **FR-013**: Owners MUST be able to edit, pause, resume, and remove their listings.
- **FR-013a**: Members MUST be able to flag another member's listing with a written request to its
  owner. The owner MUST be notified and shown the request and who sent it. Only the owner can edit or
  take down a listing; no other member, including founding members, can hide or remove it.
- **FR-013b**: Owners MUST be able to reopen a listing they removed, returning it to Available (with
  its remaining amount unchanged), unless it closed because nothing remained.
- **FR-014**: Each listing MUST have a status: Available, Lent out (with return date), Paused, or
  Closed. Gift and Trade listings with an amount MUST show the remaining amount and close
  automatically when it reaches zero (for Service sessions, see FR-010a).

**Finding**

- **FR-015**: Members MUST be able to search listings by keyword and browse by offering type.
- **FR-016**: Members MUST be able to filter by offering type and approximate area, and clear filters
  in one action.
- **FR-017**: Search MUST show only Available listings by default, with an option to include items
  currently lent out.

**Messaging & arranging**

- **FR-018**: Members MUST be able to send direct text messages to other members, optionally linked to
  a listing.
- **FR-018a**: While a member has a conversation open, new messages in it MUST appear without
  reloading, quietly: no sound, no animation, no automatic scrolling if the member has scrolled up, and
  announced politely to screen readers. Other pages (conversation list, unread counts, listings)
  update only when reloaded.
- **FR-019**: Members MUST be able to share chosen contact details within a conversation only after an
  explicit confirmation step; contact details are never shown otherwise.
- **FR-020**: Members MUST be able to propose a call time in a conversation, and the other member can
  accept or propose another time. (The call itself happens outside wunan.)
- **FR-021**: The system MUST NOT provide blocking. Every member can message any other member and
  see every listing.

**Agreements**

- **FR-022**: Listing owners MUST be able to record an agreement with another member: amount (when the
  listing has one), for loans an agreed return date, and for services the number of sessions
  (default 1). The outcome (lent, gifted, traded, provided) follows the listing's offering type.
- **FR-023**: The other member MUST be notified and able to confirm or dispute the recorded agreement.
- **FR-024**: Recording an agreement MUST update the listing status and remaining amount automatically.
- **FR-024a**: While an agreement is still pending (not yet confirmed or disputed), the owner MUST be
  able to cancel it. Cancelling restores the listing's remaining amount or sessions and its previous
  status, and tells the other member.
- **FR-025**: For loans, the system MUST send one reminder to both members on the day after the return
  date passes, and owners MUST be able to mark the item returned.
- **FR-026**: Each member MUST be able to see a history of their own agreements (given, received, lent,
  borrowed, provided).

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
  reports MUST NOT affect a member's access or visibility.
- **FR-030**: The system MUST NOT show ads, use third-party tracking, or display engagement metrics such
  as view counts, likes, or rankings of members.
- **FR-031**: Notifications MUST be limited to: new messages, agreement confirmations, return
  reminders, problem reports, and listing flags; members MUST be able to turn each type on or off.
  Notifications are sent by email and, optionally, as device notifications. Both are off until the
  member turns them on. When joining, members see one plainly explained choice, "Email me when
  someone messages me or something needs my attention", which is unticked by default; they can
  change it per type in Settings. Each channel has its own per-type switches.
- **FR-031a**: Members MUST be able to add wunan to their phone's home screen and receive device
  notifications without installing anything from an app store. Turning device notifications on
  MUST be a single, plainly explained step in settings and MUST never be prompted automatically.
- **FR-032**: Members MUST be able to export all their data (profile, listings, agreements, messages)
  in a readable format, and delete their account. Deleting an account keeps only the display name,
  for invite chains and shared agreement history.
- **FR-033**: wunan MUST NOT process payments; any money mentioned in a trade is free text only, and
  payment happens between members outside the app.
- **FR-034**: All screens MUST meet WCAG 2.2 AA and the calm-design rules in the constitution.

### Key Entities

- **Member**: A person in the community. Display name, optional short bio, join date,
  inviter (or "founding member"), contact details (private until shared), notification preferences.
- **Invitation**: Created by a member for one person. Inviter, status (unused, waiting for email confirmation, used, expired,
  cancelled), expiry, and the member who used it.
- **Listing**: A resource offered by a member. Owner, offering type (Lend, Gift, Trade, Service),
  title, description, amount and unit, remaining amount, maximum loan length (Lend), what's wanted in
  return and "open to offers" (Trade), session length and sessions available/remaining (Service), photos, approximate area, status.
- **Conversation**: Messages between two members (or three or more, for a problem report), optionally linked
  to a listing; includes contact-sharing events and proposed call times.
- **Agreement**: A recorded exchange on a listing between owner and another member. Outcome type,
  amount, sessions (services), agreed return date (loans), returned date, confirmation status.
- **Problem Report**: Raised on an agreement. Reporter, reported member, responsible inviter,
  description, status, escalation level (inviter, inviter's inviter, founding members), outcome note.
- **Listing Flag**: A request from a member to a listing's owner. Listing, flagging member, request
  text, date, whether the owner has seen it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new invitee can go from opening an invitation to being a member with a profile in
  under 3 minutes.
- **SC-002**: A member can publish a simple listing (offering type and title) in under 1 minute,
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
  feature (members can still add wunan to their home screen, per FR-031a).
- Each community self-hosts its own installation. The person running it (the operator) has server
  experience and handles hosting, HTTPS, email sending, backups, and updates using written
  operator documentation. No hosted service is provided by the wunan project.
- There is no limit on how many people a member can invite in total; a generous daily limit
  (20 new invitations per day) only guards against misuse.
- Listings stay up until the owner closes them or the amount runs out; there is no automatic expiry.
- The interface is in English only, written in plain language; translation support is out of scope
  and not prepared for.
- Out of scope for this version: showing the number of unresolved conflicts on a member's profile
  (planned for a future version).
- Out of scope for this version: live updates outside an open conversation (e.g., unread counts,
  conversation list); may be added later.
