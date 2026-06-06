# Quickstart: Validate Requests for Things

How to prove requests work end to end. Setup is as in the
[002 quickstart](../002-listing-proposals/quickstart.md), with a database reset first (nothing is
kept). Endpoints: [contracts/api.md](contracts/api.md); pages:
[contracts/pages.md](contracts/pages.md); fields and states: [data-model.md](data-model.md).

## Setup

```bash
docker compose -f compose.dev.yaml up -d
npm ci
npm run db:reset -w apps/api        # drops all tables and applies the regenerated initial migration
npm run create-founder -w apps/api
npm run dev
```

Have three members: Rana (asker), Sam (helper), Kim (another member). The demo seed
(`npm run seed:demo -w apps/api`) creates them along with a few offerings and requests.

## Automated checks

```bash
npm run check
npm run test          # API: requests, links, closing on accept, suggestions, public threads, flags, export, deletion
npm run test:e2e      # One spec per user story, with axe scans in both themes
```

Expected: all pass; the OpenAPI test finds every endpoint in both the 002 and the 003 `contracts/api.md`.

## Scenarios

1. **Ask (Story 1)**: As Rana, open "Request something", pick Borrow, type only "Drill for shelves",
   post. The request page shows "No fixed date" and nothing else missing in alarm words. Edit it:
   Needed after and Needed by both this Saturday → "Needed on Sat 8 Nov". Set Needed by before Needed
   after → plain error naming both fields. Close it (confirm) → "Closed by you"; reopen it.
2. **Suggestions (Story 2)**: With Sam's "Cordless drill" Lend offering available, start a new Borrow
   request and type "dri" then "drill": within 2 s the box lists Sam's drill; Rana's own offerings and
   Gift offerings never appear. Open the suggestion, go back: the form still has what was typed.
   Type "zzzz": no box. Screen reader: the count is announced once, politely.
3. **Answer (Story 3)**: As Sam, open Rana's request, "I can help with this", "Make a new offering": the Lend form is fixed
   to Lend and prefilled (title, area, handovers, loan length as maximum). Change the title, post. The
   offering says "For Rana's request Drill" in small text; the request lists it under "Offered for this request".
   Rana gets a `request` notice only if she turned it on. As Sam, "I can help with this", then "Offer this" with an
   existing Lend offering → linked; try with a Gift offering → not offered. "Withdraw this offer" → gone,
   offering unchanged. As Rana, open a Lend offering found in All offerings and "Ask to borrow" →
   asked "Is this for one of your requests?"; choose yes and send → it appears under "Offered for
   this request".
4. **Agree and close (Story 4)**: As Rana, open Sam's linked offering from the request, "Ask to
   borrow": the proposal is prefilled with Saturday and the loan length and says the request will
   close. Send. As Kim, propose on the same offering; as Sam, accept Kim's → Rana's request stays open.
   As Sam, accept Rana's (after Kim's loan, no overlap) → the request shows "Closed: settled by an
   agreement"; Sam's offering is still up as a normal Lend offering; other linkers are told.
   Link one offering to two of Rana's open requests and propose → asked "Which request is this for?".
   Propose on an unlinked offering and have it accepted → the request stays open. With a second open
   proposal on another linked offering, once the request closes Rana sees "You still have these
   proposals open:" with a link to it.
5. **Browse (Story 5)**: On Requests, untick everything but Service, set an area → only matching open
   requests from others. "My requests" shows Rana's own, open first, closed after.
6. **Public threads (Story 6)**: As Sam, post "Brick or plaster?" on the request (counter counts
   down; 241 characters refused with the count in the message). Rana answers. On Sam's offering, Kim
   posts; Sam (if subscribed) gets one notice that day for that thread however many arrive. Remove
   own message → "Message removed". With two browsers open on the request, a message posted in one
   appears in the other within a few seconds without reloading; a removal updates in place. Remove
   own message → "Message removed"; others' messages offer only "Raise an issue". Close the request:
   the thread stays readable, posting is refused with a plain line. Works with JavaScript off
   (except the live counter).
7. **Safety and data (Story 7)**: Raise an issue about a request and about a message → the asker /
   author sees it; nothing is hidden. Rana's "My requests" tab and the Requests nav link show a count
   of 1 until she opens the request. Export as Rana → `requests.json` and `public_messages.json`.
   Delete Kim's account → Kim's open requests vanish from Requests, Kim's public messages are gone,
   links from Kim's offerings show "No longer available".
8. **Accessibility and calm**: Keyboard only through each new page; 200% zoom and 320 px width
   without sideways scrolling; axe clean in light and dark; the header shows "Request something" and "Offer something", both outlined.
