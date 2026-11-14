# Feature Specification: A home page of what needs you

**Feature Branch**: `007-home-needs-you`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "A home page of what needs you: proposals waiting on you, things due
back, new offers on your requests, etc. Search/browsing stays one click away."

## Context

Today a signed-in member lands on Offerings (search and browse). What needs them is spread out:
arrangements waiting on them are under Arrangements, offerings made for their requests are on each
request, and requests from other members to change something are counted on Offerings and Requests.
A member has to visit several places to find out whether anything needs them.

This feature gives signed-in members one calm home page that lists, in plain words, only what needs
them now, under "Waiting on you", each with a link to where they act on it. When nothing needs them,
it says "Nothing right now." Searching and browsing stay one click away, in the header as today.

## Clarifications

### Session 2026-11-13

- Q: How early should Home start reminding a borrower that something is due back? → A: 2 days before it's due.
- Q: How should members get back to Home from other pages? → A: A "Home" link first in the header's main links, and the wunan name also goes Home.
- Q: Should the lender also see "due back soon" in the 2 days before, or only once it's late? → A: Also in the 2 days before, as a plain reminder, with weekday and date ("Thursday 20 November").
- Q: When a group on Home has many lines, show all or a few and "See all"? → A: First 5 per group, then "See all {n}", which shows the rest in place below.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what's waiting on me in one place (Priority: P1)

Rosa signs in. Instead of the search page, she lands on Home. It lists one row each, with the
thing's name and, under it, in the same words as the Arrangements list: "Ladder", "Sam asked you ·
Ready for you to accept"; "Rice", "Kim asked you · Agreed for Sat 14 Nov", with "New message";
"Guitar lessons", "You asked Fay · Needs details: when". Each row links to that arrangement. She
opens one, accepts it, comes back to Home, and that row is gone.

**Why this priority**: This is the feature: one place that answers "does anything need me?" It
reuses what "Waiting on you" already decides, so it delivers value alone.

**Independent Test**: As a member with one arrangement waiting on them and one not, sign in: Home
shows only the one waiting, with a link to it; after acting on it, Home no longer shows it.

**Acceptance Scenarios**:

1. **Given** a signed-in member, **When** they open the site's address or sign in, **Then** they see
   Home, not the search page.
2. **Given** arrangements that are waiting on the member (the same ones Arrangements lists under
   "Waiting on you"), **When** they open Home, **Then** each is listed with who it's with, what it's
   for, and what's needed, in plain words, linking to that arrangement.
3. **Given** arrangements that are in progress or finished but not waiting on the member, **When**
   they open Home, **Then** those aren't listed.
4. **Given** the member acted on a listed arrangement, **When** they come back to Home, **Then**
   that line is gone.
5. **Given** a member signed out, **When** they open the site's address, **Then** they see what they
   see today (nothing about any member's own things).

---

### User Story 2 - Nothing needs me (Priority: P1)

Ana opens Home and nothing needs her. Under "Waiting on you" it says "Nothing right now." She
carries on to Offerings from the header, as she would today.

**Why this priority**: Most visits will find nothing waiting. Home must then be calm and quick to
leave, never a page that invents reasons to stay (constitution I, V).

**Independent Test**: As a member with nothing waiting, open Home: "Waiting on you" with "Nothing
right now." and nothing else; Offerings and Requests are in the header.

**Acceptance Scenarios**:

1. **Given** nothing needs the member, **When** they open Home, **Then** under "Waiting on you" it
   says "Nothing right now." and shows no empty group headings, counts of zero or suggestions to do
   more.
2. **Given** Home, **Then** Offerings and Requests are each one press away, in the header as today.

---

### User Story 3 - Things due back (Priority: P2)

Sam borrowed Fay's drill. Two days before it's due back, Home shows Sam "Drill", "From Fay · Due
back Thursday 20 November", and shows Fay "Drill", "Lent to Sam · Due back Thursday 20 November".
If it's late, Sam's row reads "Was due back Thursday 20 November", and Fay's moves to Arrangements,
which already counts it waiting on her ("Sam asked you · It was due back …").

**Why this priority**: Remembering returns is the part of lending people most often forget, and the
borrower currently gets no reminder in the app; the lender gets one to be ready for the handover.

**Independent Test**: With a loan due within 2 days, Home lists it for both the borrower and the
lender, with the weekday and date; a loan due later isn't listed.

**Acceptance Scenarios**:

1. **Given** a member borrowing or lending something due back within the next 2 days, or past due
   and not marked returned, **When** they open Home, **Then** it's listed with what, who with, and
   the due day as weekday and date ("Due back Thursday 20 November", "Was due back Thursday 20
   November").
2. **Given** a loan due later than 2 days from now, **Then** Home doesn't list it.
3. **Given** a loan marked returned, **Then** Home doesn't list it.
4. **Given** the lender, **Then** a loan due within 2 days is a plain reminder: it doesn't count
   as waiting on them on Arrangements. Once past due it's listed under arrangements (as "Waiting on
   you" does today), and only once, not twice.

---

### User Story 4 - New offers on my requests (Priority: P2)

Rana asked to borrow a tent. Sam answers with an offering. Next time Rana opens Home, it shows
"Tent", "Sam offered Camping tent", linking to her request, where she can make a
proposal. The line stays on Home until she presses it, however she reached the request
otherwise, so it can't get lost.

**Why this priority**: An answered request is the moment the asker needs to act; today she learns it
only by email (if she turned it on) or by looking at the request.

**Independent Test**: As an asker whose open request gets a new linked offering, Home lists it;
opening the request some other way leaves it listed; pressing the line on Home takes her to the
request, and Home no longer lists it.

**Acceptance Scenarios**:

1. **Given** an open request of the member's with an offering linked to it that they haven't
   pressed on Home yet, **When** they open Home, **Then** it's listed with the helper's name, the
   request and the offering, linking to the request.
2. **Given** the member opened that request from somewhere else, **Then** Home still lists it.
3. **Given** the member pressed the line on Home, **Then** they reach the request and Home no longer
   lists those offerings; an offering linked later brings the line back.
4. **Given** a closed request, **Then** Home doesn't list offerings linked to it.
5. **Given** several new offerings on one request, **Then** Home shows one line for that request
   naming how many ("Tent", "2 new offers · From Sam and Kim").

---

### User Story 5 - Asked to change something (Priority: P3)

A member asked Fay to change something about her offering (a flag). Home lists "Drill", "Someone
asked you to change something", linking to where she sees it. The line stays on Home until she
presses it, even if she has seen the request elsewhere.

**Why this priority**: These are rare and already counted in the header, but Home should be the one
place that answers "does anything need me?".

**Independent Test**: As an owner with a request to change an offering, Home lists it; seeing it on
the offering leaves it listed; pressing the line on Home takes her there and Home no longer lists it.

**Acceptance Scenarios**:

1. **Given** requests to change something about the member's offerings or requests that they
   haven't pressed on Home yet, **When** they open Home, **Then** each thing is listed once, linking
   to where those requests are shown.
2. **Given** they've been seen elsewhere, **Then** Home still lists them.
3. **Given** the member pressed the line on Home, **Then** Home no longer lists them; a new request
   to change that thing brings the line back.

---

### Edge Cases

- **Many things at once**: Home lists everything that needs the member, grouped under at most four
  short headings (Arrangements, Due back, Offers on your requests, Asked to change), each group only
  when it has something. More than 5 in a group: the first 5 and "See all 8", which shows the rest
  below them.
- **Something changes while Home is open**: Home doesn't move by itself. A new item is not inserted
  above what the member is reading; they see it the next time they open Home (constitution V).
- **An arrangement that needs the member and is a loan due back**: listed once, under Arrangements,
  not also under "Due back". Its line still says when it's due back ("Due back Thursday 20
  November", "It was due back …"), as the Arrangements list does, so the due day isn't lost.
- **An offering paused, closed or deleted after it was offered for a request**: no longer counted
  under "Offers on your requests"; no error.
- **A helper (someone from a request for help)**: sees only their own things, never another member's
  arrangement.
- **A request deleted after it was listed**: it's simply no longer listed; no error.
- **Member suspended or signed out mid-visit**: the usual sign-in page, as on any page.
- **Bookmarks to the old landing**: the Offerings address keeps working as the search page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Signed-in members MUST land on Home: at the site's address and after signing in
  (unless signing in was to reach a specific page, which they then get).
- **FR-002**: The header MUST have a "Home" link first among its main links, marked as current on
  Home in the same way as other pages, and the wunan name MUST also lead to Home for signed-in
  members. Offerings and Requests stay in the header.
- **FR-003**: Home MUST list, for the signed-in member only, the arrangements that are waiting on
  them, using exactly the same rule as "Waiting on you" on Arrangements, so the two never disagree.
- **FR-004**: Home MUST list loans the member is borrowing or lending that are due back within the
  next 2 days, or past due and not marked returned, unless already listed under arrangements. The due
  day MUST be shown as weekday and date ("Thursday 20 November"). For the lender, the line before
  it's due is a reminder only and doesn't change "Waiting on you" on Arrangements.
- **FR-005**: Home MUST list the member's open requests with linked offerings the member hasn't
  pressed on Home yet, one line per request. The line MUST stay until the member presses it on Home;
  opening the request any other way doesn't remove it.
- **FR-006**: Home MUST list things of the member's with requests to change something the member
  hasn't pressed on Home yet, one line per thing. The line MUST stay until the member presses it on
  Home; seeing them elsewhere doesn't remove it.
- **FR-006a**: Pressing a line from FR-005 or FR-006 MUST take the member to the page it names and
  mark everything that line covered as dealt with on Home, also without JavaScript. Something new
  arriving later brings a line back. The header's counts keep their own rules.
- **FR-007**: Each line MUST say in plain words who, what, and what's needed, and link to the page
  where the member acts on it. No icons or colour alone carry meaning.
- **FR-008**: Home's heading MUST be "Waiting on you", with the groups under it. Groups with nothing
  in them MUST NOT be shown. When nothing at all needs the member, Home MUST say "Nothing right now."
  under the heading, and nothing more.
- **FR-009**: Home MUST NOT add its own search box or browse links: Offerings and Requests stay
  reachable from the header, one press away.
- **FR-010**: Home MUST NOT have a filled button (its action is choosing a line), MUST NOT show
  suggestions, activity from others, or anything meant to keep the member on the page, and MUST NOT
  update or move by itself while open.
- **FR-011**: Each group MUST show at most 5 lines, oldest first, then "See all {n}", which shows
  the rest of that group in place, below the first 5, without moving anything above (also without
  JavaScript). No new list pages are added for this.
- **FR-012**: Home MUST work fully without JavaScript and meet WCAG 2.2 AA: headings for groups,
  lists as lists, keyboard reachable, readable at 320 px and 200% zoom, in both themes.
- **FR-013**: Signed-out visitors to the site's address MUST get what they get today.

### Key Entities

- **Home line**: one thing that needs the member: kind (arrangement, due back, offers on a request,
  asked to change), who it's with, what it's about, what's needed, when (for due back), and where to
  go. Worked out each time Home opens; nothing new is stored for it, except:
- **Pressed on Home**: which linked offerings and which requests to change something the member has
  pressed on Home, so those lines stay until pressed (FR-005, FR-006, FR-006a).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can tell whether anything needs them from one page, without visiting another,
  in every case the four groups cover.
- **SC-002**: Everything Arrangements shows under "Waiting on you" appears on Home, and nothing else
  from Arrangements, checked in the browser tests.
- **SC-003**: From Home, reaching Offerings or Requests takes one press, from the header.
- **SC-004**: Home, with items and with nothing, passes the automatic accessibility scan in both
  themes, fits 320 px without sideways scrolling, and works without JavaScript.
- **SC-005**: In usability testing, at least 4 of 5 members not confident with technology say, from
  Home alone, what needs them and open it on their first try.

## Assumptions

- "Waiting on you" on Arrangements (004) stays the rule for which arrangements need a member,
  including unread messages and a lender's overdue loan; Home reuses it rather than adding a new one.
- "Due back soon" is 2 days (from the start of the day 2 days before it's due), a fixed calm reminder window, not a setting.
- The due-back line before it's due (for borrower and lender) is a reminder only; it doesn't make the arrangement "waiting on you"
  on Arrangements, and sends no new notice.
- The header's existing counts stay as they are.
- Public messages (questions) on a member's requests and offerings aren't listed on Home in this
  feature; they keep their opt-in notices.
- No new notices or emails are sent by this feature.
