# Feature Specification: How You're Connected

**Feature Branch**: `005-shared-invite-path`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Instead of just showing the invite chain from me to the founders when I
click on someone's invite chain, it would be more helpful to show the paths up from me and the person
whose profile I am viewing up to our common ancestor. It should be visible on the user's profile when
I click on it instead of clicking on "View the full invite chain". As a tree would be useful too, e.g.
what I drew out in example-tree but of course it wouldn't be ASCII tree in the web app. The tree
should highlight that the person at the root is the common inviter and the two leaves are you and the
person's whose profile you are viewing."

## Overview

Today a profile shows who invited the member and links to a separate page listing their whole invite
chain up to a founding member. That answers "who vouched for them?" but not the question a member
usually has: "how am I connected to this person?"

This feature puts the answer on the profile itself. It shows two short paths that meet: one going up
from the viewer, one going up from the person they're looking at, joined at the nearest person both
paths share (the **common ancestor**). It's drawn as a small tree with the common ancestor at the top
and the two members at the bottom, for example:

```text
          Fay  ← you both trace back to Fay
         /    \
      Ben     Chloe
       |        |
      You     Faraz
                |
              Rosa  ← the profile you're viewing
```

The separate full-chain page goes away; each name in the tree links to that member's profile, so the
chain can still be followed upward one step at a time.

## Clarifications

### Session 2026-11-12

- Q: What should the person at the top of the tree be labelled, given they may not have invited either
  member directly? → A: "You both trace back to {name}" (screen-reader sentence: "You both trace back
  to Fay."). The person is called the **common ancestor** in this spec, never "inviter" of both.
- Q: Should the separate "full invite chain" page be removed now that the profile shows the
  connection? → A: Yes. The page and its link are removed; the tree's names and "Invited by" cover
  following the chain upward (FR-009).
- Q: Should the tree sit beside "Invited by" or replace it? → A: Keep "Invited by" (and "People they
  invited") in the main column; the tree goes in the profile's side column, and below the main
  content on narrow screens (FR-012).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how I'm connected to someone on their profile (Priority: P1)

A member opens another member's profile and, without clicking anything else, sees how the two of them
are connected through invitations: who the common ancestor is, and the people between that person and
each of them.

**Why this priority**: Trust in wunan comes from the invite chain. "We both trace back to Fay, through
Ben and Chloe" is something a member can act on ("I'll ask Ben about her"); a list of strangers up to
a founder is not. It is the whole point of the request.

**Independent Test**: With Fay inviting Ben and Chloe, Ben inviting the viewer, Chloe inviting Faraz,
and Faraz inviting Rosa, the viewer opens Rosa's profile and sees a tree with Fay at the top marked
as the common ancestor, Ben and then the viewer on one side, Chloe, Faraz and Rosa on the other, the
viewer marked "You" and Rosa marked as the person being viewed.

**Acceptance Scenarios**:

1. **Given** the viewer and the profile's member share a common ancestor further up, **When** the
   viewer opens the profile, **Then** a "How you're connected" section shows the common ancestor at
   the top, a branch down to the viewer and a branch down to the member, each listing every person
   in between in order.
2. **Given** the tree is shown, **When** the viewer looks at it, **Then** the common ancestor is
   labelled in words ("You both trace back to Fay") and the viewer's box reads "You"; the profile's
   member is the person named at the top of the page, and their box has a heavier border as extra
   emphasis.
3. **Given** any name in the tree, **When** the viewer selects it, **Then** they go to that member's
   profile.
4. **Given** a screen reader or the page without styles, **When** the viewer reaches the section,
   **Then** it starts with one plain sentence naming the common ancestor, for example: "You both trace
   back to Fay."; then each branch of the drawing reads as a list named, for example, "From Fay down
   to you", so everyone in between is read once, in order.
5. **Given** a phone 320 px wide or 200% zoom, **When** the viewer opens the profile, **Then** the
   whole tree is readable without scrolling sideways; long branches stack rather than run off the
   screen.

---

### User Story 2 - The connection when one of us invited the other's line (Priority: P1)

Some connections aren't two branches: the viewer may have invited the member (directly or a few steps
down), or the member may be in the viewer's own line upward. The section still says plainly how they
are connected.

**Why this priority**: These are common (a member looking at their own inviter, or at someone they
invited) and must not show a broken or confusing tree.

**Independent Test**: The viewer opens their own inviter's profile, and then the profile of someone
their invitee invited; each shows one straight line with the right labels.

**Acceptance Scenarios**:

1. **Given** the member invited the viewer (directly or further up the viewer's line), **When** the
   viewer opens their profile, **Then** the section shows one line from that member down to the
   viewer (no "You both trace back to" label, since one of you is the top of the line), for example
   "Ben invited you." or "Fay invited Ben, who invited you."
2. **Given** the viewer invited the member (directly or further down), **When** the viewer opens their
   profile, **Then** the section shows one line from the viewer down to the member, for example "You
   invited Sam, who invited Rosa."
3. **Given** the viewer opens their own profile, **When** the page loads, **Then** the section shows
   their own line up to a founding member ("Fay invited Ben, who invited you."), since there is no
   second person; a founding member viewing their own profile sees that they started the community.

---

### User Story 3 - Members with no common ancestor (Priority: P2)

A community can have more than one founding member. Two members whose lines go up to different
founding members have no common ancestor.

**Why this priority**: Rare in a small community, but the page must still be truthful and calm.

**Independent Test**: Founding members Fay and Omar each invite someone; one invitee opens the
other's profile.

**Acceptance Scenarios**:

1. **Given** the viewer's and the member's lines end at different founding members, **When** the
   viewer opens the profile, **Then** the section shows both lines, each up to its founding member,
   and says in one sentence that they're connected through the founding members rather than one
   person, without suggesting anything is wrong.

---

### Edge Cases

- **Someone in a path left wunan**: they're shown in their place with their display name and "(no
  longer a member)", as profiles and chains show today, and are not a link. They can still be the
  common ancestor.
- **The member being viewed left wunan**: their profile already says so; the section still shows how
  you were connected, with the same rule as above.
- **A founding member's profile**: the viewer's line goes up to that founder if it does; otherwise the
  no-common-inviter case applies.
- **Very long paths** (ten or more people on one side): every person is shown; nothing is cut off or
  hidden behind "show more", and the tree stays readable on a phone.
- **Two members with the same display name** in one tree: the viewer's box reads "You", so the ends
  can be told apart; names elsewhere link to different profiles.
- **Without JavaScript**: the section is part of the page as it loads; nothing needs a click to open.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A member's profile MUST show, when viewed by another member, a "How you're connected"
  section showing the viewer's line of inviters and the profile member's line of inviters up to the
  nearest person both lines share (the common ancestor).
- **FR-002**: The section MUST be drawn as a tree with the common ancestor at the top and a branch down
  to each of the two members, every person in between shown in order. When one member is in the
  other's line, it MUST be drawn as a single line.
- **FR-003**: The common ancestor and the viewer ("You") MUST each be marked in words, and MUST NOT be
  told apart by colour, icon, position or shape alone. The profile's member is the person named at
  the top of the page; their box in the drawing has a heavier border as extra emphasis. The common ancestor's
  label MUST be "You both trace back to {name}" and MUST NOT say or suggest that they invited either
  member, since there may be several people in between. When one member is the top of a single line,
  that label is left out.
- **FR-004**: Every person in the tree who is still a member MUST link to their profile. People who
  left wunan MUST show their display name with "(no longer a member)" and no link.
- **FR-005**: The section MUST start with one plain sentence that says how the two are connected
  ("You both trace back to Fay."; for a single line, the line itself: "Fay invited Ben, who invited
  you."). The drawing shows everyone in between and MUST be usable by screen readers and keyboards:
  each branch a list with a name ("From Fay down to you"), each person reached once.
- **FR-006**: When the two lines share no one (different founding members), the section MUST show
  both lines up to their founding members in the drawing and say so in one calm sentence.
- **FR-007**: On the member's own profile, the section MUST show their own line up to a founding
  member, under the heading "Your invite line" instead of "How you're connected"; on a founding
  member's own profile, it MUST say they started the community.
- **FR-008**: The section MUST appear on the profile as it loads, with no extra click, and MUST work
  without JavaScript.
- **FR-009**: The separate "full invite chain" page and the profile's link to it MUST be removed.
  Following the chain upward stays possible from any profile through the "Invited by" link and the
  names in the tree (001 FR-004).
- **FR-010**: The section MUST be readable without sideways scrolling at 320 px wide and at 200% zoom,
  meet WCAG 2.2 AA in both themes, and follow the calm-design rules (no animation, nothing shifts
  after the page loads).
- **FR-011**: The section MUST show only what profiles show today (display names, whether someone is a
  founding member or no longer a member). No member sees anything new about anyone.
- **FR-012**: "Invited by" and "People they invited" MUST stay in the profile's main column as they
  are. The "How you're connected" section MUST sit in the side column of the profile's two-column
  layout on wide screens, and after the main content on narrow screens.

### Key Entities

- **Invite line**: A member, the person who invited them, that person's inviter, and so on up to a
  founding member. Already recorded since 001; nothing new is stored.
- **Common ancestor**: The nearest person who appears in both the viewer's and the profile member's
  invite lines. Either member can be the common ancestor, when one is in the other's line.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can see how they're connected to anyone in the community from that person's
  profile with no clicks after opening it.
- **SC-002**: In usability testing, at least 4 of 5 members not confident with technology can say,
  from a profile, who the common ancestor is and who stands between them and the other person.
- **SC-003**: The profile with its connection section loads within 2 seconds, even when each line is
  20 people long.
- **SC-004**: 100% of trees in the browser tests pass the automatic accessibility scan in both themes
  and fit within 320 px without sideways scrolling.
- **SC-005**: No link to a separate invite chain page remains anywhere in wunan.

## Assumptions

- **Only signed-in members see profiles**, as today (wunan is invite-only), so there is always a
  viewer to connect to.
- **The full-chain page is replaced, not kept beside the tree.** The tree covers the useful part of it,
  and each name links upward; keeping both would be two ways to do one thing.
- **The profile uses the two-column layout** that other pages got in the restyle; today's profile is
  one column, so it gains a side column for the tree (FR-012).
- **No new data is collected or stored**; the connection is worked out from the invitations wunan
  already records.
- **Depends on** 001 (invitations, profiles, invite chain, members who left).
