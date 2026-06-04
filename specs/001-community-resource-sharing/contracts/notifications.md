# Contract: Notifications

All notifications are sent by the API (`apps/api/src/notify/`). They go out by email and, for members who turn them on, as device notifications (FR-031,
FR-031a). Each type has separate email and device switches in `/settings/notifications`. Email is on
by default; device notifications are off until the member turns them on, and wunan never asks for
permission on its own.

Calm rules for both channels (constitution V and I):

- Plain language; no urgency words, no exclamation marks.
- At most one notification per conversation per hour.
- No tracking pixels, tracked links, or third-party push services.
- Never include contact details or photos; message previews at most 100 characters.
- Every email ends with a link to `/settings/notifications`.

| Type | Sent to | When | Email subject / device title (example) | Opens |
|------|---------|------|-----------------------------------------|-------|
| `message` | Other participants not currently viewing the conversation | A message arrives | "New message from Sam about Drill" | The conversation |
| `agreement` | Other member | Owner records an agreement | "Sam recorded an agreement with you" | The agreement |
| `agreement` | Owner | Other member disputes it | "Alex said an agreement needs a correction" | The agreement |
| `reminder` | Owner and borrower | Once, the day after `return_due` if not returned | "A reminder about the drill" | The agreement |
| `report` | Reported member and current mediators | Report created or escalated | "Someone asked for help with an agreement" | The report |
| `flag` | Listing owner | A member flags their listing | "Alex sent a request about your listing" | The listing |

Account emails (password reset) are always sent and cannot be turned off.

Device notification payload (encrypted per Web Push):

```json
{ "title": "New message from Sam about Drill", "body": "Is Saturday okay?", "url": "/messages/…" }
```

The service worker shows it silently (`silent: true`, no vibration) and opens `url` when tapped.
