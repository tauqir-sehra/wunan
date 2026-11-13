# Feature Specification: Fill in missing details in place

**Feature Branch**: `006-fill-details-in-place`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Fill in missing details in place: on a proposal, make each "Not decided yet" row a button that opens just that field, instead of the separate "Change details" page."

## Clarifications

### Session 2026-11-12

- Q: What happens to the "Change details" page, given details already filled in still need a way to
  change? → A: Removed; every row the requester can change opens in place, filled or empty.
- Q: When the requester fills in several details one after another, should the lister get a
  separate notice for each save? → A: No. Each save still adds its own line to the messages, but saves
  close together give the lister one notice.
- Q: While details are still missing, should anything on the requester's page be the filled
  (primary) button? → A: No. The pressable rows and the "Still to settle" list are enough; rows and
  "Save" are outline.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fill in one missing detail without leaving the arrangement (Priority: P1)

Rosa asked to borrow Fay's ladder and left "When" and "For how long" empty. Her arrangement page
lists them as "Not decided yet", and under them "Still to settle before it can be accepted". Today
she has to press "Change details", go to a separate page with the whole form, find the right field,
save, and come back. Instead, she presses the "When" row itself. Just the "When" field opens there,
in the row. She picks a day, saves, and the row now shows the day. The page doesn't jump; the list
of what's still to settle loses "When".

**Why this priority**: This is the whole feature. Missing details are what stop a lister from
accepting, and filling them in should be the easiest thing on the page.

**Independent Test**: As the requester on an arrangement with an empty "When", press the "When" row,
fill in a day, save; the row shows the day, the page stays where it was, and the history notes the
change.

**Acceptance Scenarios**:

1. **Given** the requester views an open arrangement with an empty detail, **When** they look at the
   details, **Then** each empty row reads "Not decided yet" and can be pressed, and says in words what
   pressing it does (for example "Add when").
2. **Given** the requester presses an empty row, **When** it opens, **Then** only that detail's field
   shows, in place of the row, with "Save" and "Cancel"; nothing else on the page moves except the
   room the field needs below the row.
3. **Given** the field is open, **When** the requester saves a valid value, **Then** the row shows
   the new value, the "Still to settle" list updates, the change appears in the history as changes
   do today, and the page stays where it was.
4. **Given** the field is open, **When** the requester presses "Cancel", **Then** the row goes back
   to "Not decided yet" and nothing is saved.
5. **Given** the requester saves a value that doesn't fit (for example a day the item is already
   lent), **When** the save is checked, **Then** the field stays open with the value kept and a plain
   message beside it saying what to change.
6. **Given** the last missing detail is filled in, **When** it saves, **Then** the lister can accept.
   There is no "Change details" button or page any more.

---

### User Story 2 - Change a detail already decided, in place (Priority: P1)

Rosa set "When" to Saturday but now needs Sunday. The "When" row shows "Saturday" and can be
pressed, saying "Change when". It opens the same field, filled with Saturday. She picks Sunday and
saves.

**Why this priority**: With the "Change details" page gone, this is the only way to change a
detail, so it must ship with User Story 1.

**Independent Test**: As the requester, press a filled row, change the value, save; the row shows
the new value and the history notes the change.

**Acceptance Scenarios**:

1. **Given** a filled row, **When** the requester presses it, **Then** that field opens filled with
   the current value.
2. **Given** they clear the value and save, **Then** the row reads "Not decided yet" again (every
   detail stays optional, 002 FR-015).

---

### User Story 3 - Details that depend on each other (Priority: P2)

Some details change which others apply. Choosing "Online" for "How" means "Where" isn't needed;
choosing "Pick up" means it is. Filling in "How" in place must update the rows that follow from it.

**Why this priority**: Without it, the list could show a "Where" row that no longer applies, or miss
one that now does.

**Independent Test**: On a service arrangement with "How" and "Where" empty, fill in "How" as
Online; the "Where" row goes away. Change it back to in person; "Where" returns as "Not decided
yet".

**Acceptance Scenarios**:

1. **Given** "How" is filled in as Online, **When** it saves, **Then** the "Where" row is no longer
   shown and is no longer listed as still to settle.
2. **Given** a trade with "In return" empty, **When** the requester opens that row, **Then** the
   same choices as today show (items from their own offerings, or something else in their own
   words), and nothing else.

---

### User Story 4 - Without JavaScript (Priority: P2)

Every form in wunan works without JavaScript. Pressing an empty row without JavaScript loads the
same arrangement page with just that field open in its row, and saving returns to the same place on
the page.

**Why this priority**: A constitution rule; members on old phones or with scripts off must be able to
finish an arrangement.

**Independent Test**: With JavaScript off, press an empty row, fill it in, save; the page comes back
at the details with the value shown.

**Acceptance Scenarios**:

1. **Given** JavaScript is off, **When** the requester presses an empty row, **Then** the page loads
   with that field open in place and the view at the details.
2. **Given** JavaScript is off, **When** they save, **Then** the page comes back at the details with
   the new value, or with the field still open and the message if it didn't fit.

---

### Edge Cases

- **The lister views the page**: empty rows read "Not decided yet" as plain text and can't be
  pressed; only the requester fills in details (002 FR-016). The lister can still ask in a message.
- **A helper from a request for help** sees the rows as plain text.
- **Someone else changed the arrangement meanwhile** (the lister declined, or it closed): saving
  says so in plain words, keeps what was typed visible, and shows the arrangement as it now is.
- **Two empty rows**: opening one closes any other that's open without saving it; only one field is
  open at a time.
- **Without the "Change details" page**: an old link to it goes to the arrangement page's details.
- **Pick up at the lister's place**: "Where" shows the lister's place and "Picked by Fay"; it can't
  be pressed. Changing "How" is how the requester changes it.
- **Once agreed or ended**: the details are fixed; no row can be pressed.
- **Keyboard and screen reader**: the row is reached with Tab, opens with Enter or Space, focus moves
  into the field, and returns to the row after Save or Cancel.
- **320 px wide or 200% zoom**: the open field fits within the row's width, without sideways
  scrolling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On an open arrangement, for the requester, every detail row, filled or "Not decided
  yet", MUST be a control that opens that one detail's field in place, in the row, filled with the
  current value if there is one.
- **FR-002**: The control MUST say what it does in words ("Add when" on an empty row, "Change when"
  on a filled one), not by an icon or colour alone, and keep the current value or "Not decided yet"
  visible.
- **FR-003**: The open field MUST offer the same choices and checks as that detail has today (002
  FR-013 to FR-015), with "Save" and "Cancel". Save MUST be an outline button: the page's one filled
  button stays the stage's primary action.
- **FR-004**: Saving MUST change only that detail; other details stay as they are. Each save MUST
  add its own line to the arrangement's messages with the new value, as changes do today (002
  FR-016).
- **FR-004a**: The lister MUST get at most one notice about changed details for an arrangement in
  any 10 minutes: a save sends no notice if one about changed details of that arrangement was sent
  to the lister in the 10 minutes before. The lines in the messages are not affected.
- **FR-005**: Saving and cancelling MUST keep the page where it was, and show any problem beside the
  field (constitution "things on screen stay put").
- **FR-006**: When saving a detail changes which other details apply (for example "How" set to
  Online), the rows and the "Still to settle" list MUST update to match.
- **FR-007**: Only one field MUST be open at a time.
- **FR-008**: Without JavaScript, pressing a row MUST load the same page with that field open and the
  view at the details; saving MUST return to the details.
- **FR-009**: Rows MUST be pressable only by the requester, only while the arrangement is open.
  Everyone else sees them as today.
- **FR-009a**: When "How" is at the lister's place, the "Where" row MUST show that place with a
  quiet note "Picked by {lister}" ("Picked by you" for the lister), and MUST NOT be pressable: the
  place is the lister's, not the requester's to set.
- **FR-010**: The separate "Change details" page and the button to it MUST be removed; details are
  only filled in and changed in place. The requester has no filled button while details are
  missing: the rows and "Save" are outline, and the "Still to settle" list and the pressable rows
  show what to do.
- **FR-011**: The feature MUST meet WCAG 2.2 AA: reachable and usable by keyboard, focus moved into
  the field and back, a visible label on the field, readable at 320 px and 200% zoom.

### Key Entities

- **Arrangement details**: the existing details of an arrangement (when, how, where, for how long,
  how much, in return, each time, how many times). Nothing new is stored; this changes how they are
  filled in.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A requester fills in one missing detail with one press to open, the value, and one
  press to save, without leaving the arrangement page.
- **SC-002**: In usability testing, at least 4 of 5 members not confident with technology fill in a
  missing detail on their first try without help.
- **SC-003**: Opening, saving and cancelling a field move nothing above it on the page, checked in
  the browser tests.
- **SC-004**: Every state (closed row, open field, field with a problem) passes the automatic
  accessibility scan in both themes and fits 320 px without sideways scrolling.
- **SC-005**: Filling in four details within 10 minutes sends the lister one notice, not four.

## Assumptions

- Only the requester fills in details, as today (002 FR-016); this feature doesn't let the lister
  fill them in.
- The fields themselves (choices, units, the day picker, place suggestions, the trade offer) are the
  ones the "Change details" form uses today, one at a time.
- "When" includes whether a time is set, as one field.
- Saving one detail uses the same rules as a full change today, including the check that a loan's
  days are free.
- "Proposal" here means an arrangement still being arranged; since 004 each has one page.
