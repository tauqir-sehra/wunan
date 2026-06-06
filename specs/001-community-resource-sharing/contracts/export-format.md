# Contract: Personal Data Export

`GET /api/v1/me/export` (web: `/settings/export`) returns `wunan-export-YYYY-MM-DD.zip` (FR-032) containing:

```text
my-wunan-data.json
README.txt          # plain-language explanation of each section
photos/<offering-id>-<position>.webp
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
  "offerings": [{
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
    "offering_title": "", "role": "owner|other", "other_member": "", "outcome": "",
    "amount": null, "sessions": null, "return_due": null, "returned_at": null,
    "confirmation": "", "note": "", "recorded": ""
  }],
  "problem_reports": [{
    "agreement": "", "role": "reporter|reported|mediator", "status": "", "description": "",
    "outcome_note": "", "created": ""
  }],
  "conversations": [{
    "with": ["display names"], "offering_title": null, "asking_for_help": false,
    "messages": [{ "from": "me or a display name", "sent": "", "kind": "", "body": "", "proposed_time": "(call messages only)" }]
  }],
  "requests": [{
    "kind": "borrow | receive | trade | service", "title": "", "description": null,
    "needed_after": null, "needed_by": null, "area": "", "handovers": [],
    "loan_length": null, "loan_length_unit": null, "amount": null, "unit": null,
    "could_give_back": [{ "description": "", "amount": null, "unit": null }],
    "session_length": null, "session_length_unit": null, "sessions": null,
    "times_that_suit": [{ "weekday": 1, "from": "10:00", "to": "12:00" }],
    "status": "open | closed", "closed_reason": null,
    "linked_offerings": [{ "offering_id": "", "title": "" }], "created": ""
  }],
  "public_messages": [{ "id": "", "on": { "request or offering": "id", "title": "" }, "body": "", "removed": false, "createdAt": "" }],
  "flags_sent": [{ "offering_title | request_title | public_message": "", "request": "", "sent": "" }],
  "flags_received": [{ "offering_title | request_title | public_message": "", "from": "", "request": "", "sent": "" }],
  "notification_preferences": [{ "type": "message", "email": true, "device": false }]
}
```

`requests` and `public_messages` were added in 003; flags can now be about an offering, a request,
or a public message. Photos are numbered from 1 in display order. A member who has left appears as "<name> (no longer a
member)".

Other members appear by display name only, never by email or private contact details (except
details they themselves shared in a conversation with this member).
