# Contract: Notifications (changes for arrangements)

Changes to the [002](../../002-listing-proposals/contracts/notifications.md) and
[003](../../003-member-requests/contracts/notifications.md) notification contracts. Types, channels,
switches, limits, and when each is sent are unchanged (spec FR-024). Two things change: where each
opens, and a few words.

| Type | When (unchanged) | Email subject / device title | Opens |
|------|------------------|------------------------------|-------|
| `message` | An arrangement is made | "Robin asked to borrow your drill" | The arrangement |
| `message` | It is asked again after ending (new) | "Robin asked again to borrow your drill" | The arrangement |
| `message` | A message arrives | "New message from Sam about Drill" | The arrangement |
| `message` | The requester changes details | "Robin changed what they asked for Drill" | The arrangement |
| `message` | Declined or withdrawn | "Sam declined what you asked for Drill" | The arrangement |
| `message` | Closed because nothing is left; now over what remains; dates now taken | As 002 | The arrangement |
| `message` | Closed after 30 quiet days | "Your arrangement for Drill was closed after a quiet month" | The arrangement |
| `agreement` | The lister accepts | "Sam accepted: you've agreed on Drill" | The arrangement |
| `reminder` | Once, the day after a loan was due back | "A reminder about the drill" | The arrangement |
| `report` | Requests for help (001, 002) | Unchanged | The request for help |
| `request` | A request closes by an agreement (003) | Unchanged | The request |

Not sent, by design: nothing when an arrangement is marked as done or "Not done yet" (FR-009a),
and nothing when a loan is marked returned beyond what 002 already sends.

"Asking again" follows the same once-per-thread-per-hour rule as other `message` notices.

The settings page keeps its switches and their labels ("New messages", "Agreements", "Return
reminders", …). Any description under them that names the Proposals or Agreements pages is
reworded to say "arrangements".
