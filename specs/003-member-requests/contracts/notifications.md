# Contract: Notifications (additions for requests)

Additions to the [002 notifications contract](../../002-listing-proposals/contracts/notifications.md).
Channels, switches, and calm rules are unchanged. Two new types (spec FR-024), each with an email
and a device switch, **off until the member turns them on**. Settings shows them as:

- **Someone offers something for your request** (`request`)
- **Public messages on your requests and listings** (`public_message`)

| Type | Sent to | When | Email subject / device title (example) | Opens |
|------|---------|------|-----------------------------------------|-------|
| `request` | Asker | A listing is linked to their request (not by the asker) | "Sam can help with “Drill for shelves”" | The request |
| `request` | Members who linked a listing | The asker edits the request | "Rana changed their request “Drill for shelves”" | The request |
| `request` | Members who linked a listing | The request closes (by the asker or by an agreement) or reopens | "Rana's request “Drill for shelves” is settled" / "…is open again" | The request |
| `public_message` | Asker or lister, and earlier posters in the thread (not the author) | A public message is posted | "New public message on “Drill for shelves”" | The request or listing, at the thread |
| `flag` | Asker | A member raises an issue about their request | "Alex sent a request about your request" | The request |
| `flag` | Message author | A member raises an issue about their public message | "Alex sent a request about your message" | The message |

Rules:

- `public_message`: at most one notice per thread per member per day (`notification_log.subject_id`).
- `request`: at most one notice per request per member per hour (the 002 per-thread rule, keyed by
  request), so a burst of edits sends one.
- The body is a calm preview (001 `calm()`), never the full public message if it would be cut
  mid-word.
- A member closing their own request or a helper removing their own link sends nothing.
