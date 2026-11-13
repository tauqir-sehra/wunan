# Data model: Fill in missing details in place

No database or schema changes. The arrangement's details, their checks, the messages line for each
change and the notice rules are all as they are today (002, 004).

## Detail keys (web only)

The page names one detail in its URL (`?detail=`) and its form (`detail` hidden field). Allowed
keys depend on the offering type; an unknown or not-applicable key is ignored (the page shows no
open field).

| Key | Row | Offering types | Pressable when |
|-----|-----|----------------|----------------|
| `when` | When | all | always |
| `how` | How | all | always |
| `where` | Where | all | "How" is not `online` and not `at_lister` (at the lister's place the row shows "Picked by {lister}" instead) |
| `length` | For how long | lend | always |
| `amount` | How much | gift, trade | the offering has an amount |
| `return` | In return | trade | always |
| `session` | Each time | service | always |
| `sessions` | How many times | service | always |

"Pressable" also requires: the viewer is the requester, and the arrangement is open (FR-009).
