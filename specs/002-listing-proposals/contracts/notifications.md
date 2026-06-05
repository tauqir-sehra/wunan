# Contract: Notifications (changes for proposals)

Changes to [001 notifications](../../001-community-resource-sharing/contracts/notifications.md).
Types, channels, switches, and calm rules are unchanged (FR-026: no new types). At most one
notification per thread per hour still applies, so a burst of detail changes sends one.

| Type | Sent to | When | Email subject / device title (example) | Opens |
|------|---------|------|-----------------------------------------|-------|
| `message` | Lister | A proposal is made | "Robin asked to borrow your drill" | The proposal |
| `message` | Other participant not viewing the proposal | A message arrives | "New message from Sam about Drill" | The proposal |
| `message` | Lister | The requester changes details | "Robin changed their proposal for Drill" | The proposal |
| `message` | Other member | Declined or withdrawn | "Sam declined your proposal for Drill" | The proposal |
| `message` | Requester | Closed because nothing is left | "The rice has all been given away" | The proposal |
| `message` | Requester | Now over what remains, or dates now taken | "Less rice is left than you asked for" / "Someone is borrowing the drill on those dates" | The proposal |
| `message` | Both | Closed after 30 quiet days | "Your proposal for Drill was closed after a quiet month" | The proposal |
| `agreement` | Requester | Lister accepts | "Sam accepted your proposal for Drill" | The agreement |
| `reminder` | Owner and borrower | Once, the day after `loanEndsAt` (community time zone) if not returned | "A reminder about the drill" | The agreement |

Removed: the `agreement` rows for "recorded", "cancelled", and "disputed". `report` and `flag` rows
are unchanged.
