# Contract: Personal Data Export

`GET /api/v1/me/export` (web: `/settings/export`) returns `wunan-export-YYYY-MM-DD.zip` (FR-032) containing:

```text
my-wunan-data.json
README.txt          # plain-language explanation of each section
photos/<listing-id>-<position>.webp
```

`my-wunan-data.json` (UTF-8, pretty-printed, dates in ISO 8601):

```json
{
  "format_version": 1,
  "exported_at": "2026-06-03T09:00:00Z",
  "profile": {
    "display_name": "", "email": "", "bio": "", "joined": "",
    "invited_by": "display name or null", "is_founder": false,
    "share_phone": "", "share_email": ""
  },
  "invitations": [{ "created": "", "status": "used", "used_by": "display name" }],
  "listings": [{
    "id": "", "type": "lend|gift|trade|service", "title": "", "description": "",
    "amount": null, "unit": null, "remaining": null,
    "loan_length": null, "loan_length_unit": null,
    "wanted": null, "wanted_amount": null, "wanted_unit": null, "open_to_offers": false,
    "session_length": null, "session_length_unit": null,
    "sessions_available": null, "sessions_remaining": null,
    "area": "",
    "status": "", "created": "", "photos": ["photos/1-1.webp"]
  }],
  "agreements": [{
    "listing_title": "", "role": "owner|other", "other_member": "", "outcome": "",
    "amount": null, "sessions": null, "return_due": null, "returned_at": null,
    "confirmation": "", "note": "", "recorded": ""
  }],
  "problem_reports": [{
    "agreement": "", "role": "reporter|reported|mediator", "status": "", "description": "",
    "outcome_note": "", "created": ""
  }],
  "conversations": [{
    "with": ["display names"], "listing_title": null, "asking_for_help": false,
    "messages": [{ "from": "me or a display name", "sent": "", "kind": "", "body": "", "proposed_time": "(call messages only)" }]
  }],
  "flags_sent": [{ "listing_title": "", "request": "", "sent": "" }],
  "flags_received": [{ "listing_title": "", "from": "", "request": "", "sent": "" }],
  "notification_preferences": [{ "type": "message", "email": true, "device": false }]
}
```

Photos are numbered from 1 in display order. A member who has left appears as "<name> (no longer a
member)".

Other members appear by display name only, never by email or private contact details (except
details they themselves shared in a conversation with this member).
