# Quickstart: Validate Arrangements

How to prove arrangements work end to end. Endpoints: [contracts/api.md](contracts/api.md); pages:
[contracts/pages.md](contracts/pages.md); notices:
[contracts/notifications.md](contracts/notifications.md); fields and states:
[data-model.md](data-model.md).

## Setup

Nothing is kept from before (spec Clarifications), so start from a reset database.

```bash
docker compose -f compose.dev.yaml up -d
npm ci
npm run db:reset -w apps/api        # drops all tables and applies the regenerated initial migration
npm run create-founder -w apps/api
npm run dev
```

Have three members: Fay (lister), Sam (requester, invited by Fay), and a founder. The demo
seed (`npm run seed:demo -w apps/api -- --members 200 --offerings 600 --requests 300`) creates
members with arrangements at every stage.

## Automated checks

```bash
npm run check
npm test              # API: arrangements (ask, change, accept, decline, withdraw, ask again, returned,
                      # done / not done, list groups, needs-me count, helpers, export), contract test
npm run test:e2e      # One spec per user story, with axe scans in both themes; stay-put checks
```

Expected: all pass. The OpenAPI test finds every endpoint in the 002, 003 and 004
`contracts/api.md`, and none of the removed proposal or agreement endpoints remain in any of them.

## Scenarios

1. **One list (Story 1)**: As Sam, ask to borrow Fay's drill with nothing filled in; ask for Fay's
   rice with everything filled in. Open "Arrangements": the drill is under **Needs you** ("Needs
   details: when, how"), the rice under **In progress** ("Waiting for Fay"). The header shows
   "Arrangements" with the count 1 and no "Proposals" or "Agreements". As Fay: the rice is under
   Needs you ("Ready for you to accept"), the drill under In progress. Choose "I asked" as Fay: the
   list is empty and says so calmly; "All" brings both back. Nothing changes weight or size when
   choosing.
2. **One page, same address (Story 2)**: As Fay, open the rice arrangement and note the address.
   Accept. The page stays where it was scrolled, the address is the same, the stage reads "Agreed",
   the timeline gains "Agreed" with today's date, the details are headed "What was agreed" with no
   "Change details", and the messages are still there. As Sam, the same page shows the same.
3. **Loan to returned**: As Sam fill in the drill's details; as Fay accept. Stage "Agreed for …";
   timeline shows "Due back …" and "Returned · not yet". Move the loan's dates in the database
   (`update arrangement set loan_starts_at = …, loan_ends_at = …`) so it has started: "On loan". Past the end: for Fay it is under Needs you with "It was
   due back …" and no alarm words; for Sam it is under In progress. Fay presses "Mark returned":
   stays put, "Returned", moves to Finished for both.
4. **Mark as done**: On the agreed rice, either member presses "Mark as done": stays put, "Done on
   …" with who marked it, moves to Finished for both, and the other member gets **no**
   notification (check Mailpit). "Not done yet" puts it back to "Agreed" and In progress. Leave
   another agreed gift unmarked and set its `agreed_at` a month back in the database: it stays quietly In progress, never under
   Needs you, with no reminder.
5. **Ask again**: As Fay decline Sam's new ask for seeds, with a note. As Sam the arrangement is in
   Finished ("Declined"), read-only, with the note and "Ask again". Press it, send new details:
   the same address, the earlier messages still there, timeline "Asked · Declined · Asked",
   stage "Being arranged", back out of Finished; Fay is told. In the database there is one row for
   Sam and that offering. After an agreed gift, asking for the same offering again makes a second
   arrangement.
6. **Everything leads here (Story 3)**: Follow the link in each email in Mailpit (asked, message,
   details changed, accepted, declined, return reminder): each opens the arrangement. On the
   offering, "See your arrangement" opens it. On a request closed by an agreement, the link opens
   it. Open `/proposals`, `/agreements`, and an old proposal address: "We couldn't find that page".
7. **Helper**: On the agreed drill, Sam asks for help. As the helper wunan names (the reported
   member's nearest inviter, or a founder), open the arrangement from the request for help: a note
   says you're seeing it to help; stage, timeline and what was agreed are shown; no buttons; no messages. Sam shares the
   messages: now the helper can read them, not write. The arrangement is not in the helper's list
   or count.
   Someone unrelated opening the address sees "couldn't find that page".
8. **Finished grows**: With the demo seed, a member with more than 20 finished arrangements sees 20
   and "Show more", which adds the next 20 below without moving the page. The list loads within
   2 seconds for a member with 200 arrangements (SC-007).
9. **Words and help (Story 4)**: Search the running app for "Proposals" and "Agreements" as page
   names: none in the header, page titles, help, settings, or notices. `/help/arrangements`
   explains the stages in the same words the pages use.
10. **Export and leaving**: Download your data: `my-wunan-data.json` has an `arrangements` section
    with details, agreed record, returned and done dates, and messages. Delete an account with an
    open arrangement: it closes with "one of you left wunan" for the other member.

## Hand checks (constitution)

- **Keyboard and screen reader**: Tab through the list and the page; the timeline reads in order
  as "step, date" lines; the filter announces the current choice; every action has a visible focus
  ring.
- **Stay put**: every action in scenarios 2 to 5 keeps the page where it was, with its result
  beside the button; with JavaScript off each still works and returns to the same part of the page.
- **One filled button** on every stage of the arrangement page, for each role (pages contract
  table).
- **320 px wide and 200% zoom**: list and page in one column, messages last, nothing cut off.
- **Dark theme**: stage badges and timeline dots meet contrast; nothing is said by colour alone.
