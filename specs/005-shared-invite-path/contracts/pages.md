# Contract: Pages (changes for how you're connected)

## Routes

| Route | Change |
|-------|--------|
| `/members/[id]` | Two columns (`page-columns`). Main: name, joined, founding badge, bio, "Invited by", "People they invited" (unchanged, FR-012). Side: "How you're connected". |
| `/members/[id]/chain` | **Removed**, with its link "See the full invite chain" (FR-009). No redirect. |

The 001 pages contract row for `/members/[id]/chain` is removed.

## "How you're connected" section

`<section aria-labelledby="connection-heading">` with an `h2` "How you're connected" (on your own
profile: "Your invite line").

**Sentence** (visible, one per kind, plain text; the links are in the drawing):

| `kind` | Words |
|--------|-------|
| `shared` | "You both trace back to Fay." |
| `theyAreAbove` | "Ben invited you." / "Fay invited Ben, who invited you." |
| `youAreAbove` | "You invited Sam." / "You invited Sam, who invited Rosa." |
| `self` | "Fay invited Ben, who invited you." For a founding member: "You started this community." |
| `separate` | "You and Omar trace back to different founding members." |

For `shared` and `separate`, who stands in between is shown only in the drawing. In the single-line
kinds, when the line has one person, the sentence is "Fay invited you." / "You invited Rosa."

**Drawing** (read by screen readers and reached by keyboard; each person's name is a link):

- The top person, labelled underneath in words: "You both trace back to Fay" (`shared` only; the
  label is `aria-hidden` since the sentence already says it).
- Each branch is an `<ol>` named "From {top} down to {last}" ("From Fay down to you"); for
  `separate`, from each founding member.
- Below, one column per non-empty branch, side by side, each a stack of names joined by a thin
  vertical line, top to bottom.
- The viewer's box reads "You". The profile's member is named at the top of the page; their box,
  like the viewer's, has a heavier border as extra emphasis.
- Founding members carry the existing "Founding member" badge text; people who left show
  "(no longer a member)" and are not links.
- `separate`: two columns, each topped by its founding member, with no shared top.
- Names wrap; nothing scrolls sideways at 320 px or 200% zoom. Every person is shown.

No buttons; there is no primary action in this section.
