# Data model: A home page of what needs you

## Stored (changes)

| Table | Column | Type | Meaning |
|-------|--------|------|---------|
| `request_link` | `home_pressed_at` | `timestamptz null` | When the asker pressed the Home line covering this offering. Null: still listed (if the request is open and the link isn't the asker's own). |
| `flag` | `home_pressed_at` | `timestamptz null` | When the owner or asker pressed the Home line covering this flag. Null: still listed. Independent of `seen_at`. |

Nothing else is stored. Everything below is worked out each time Home opens.

## Home (API response, `packages/shared/src/schemas/home.ts`)

```text
Home {
  arrangements: ArrangementSummary[]      // needsMe, oldest lastActivityAt first
  dueBack: DueBack[]                      // loanEndsAt ascending
  offers: OffersOnRequest[]               // oldest link first
  askedToChange: AskedToChange[]          // oldest flag first
}

DueBack {
  arrangementId: string
  myRole: 'requester' | 'lister'          // requester = borrower
  otherMember: memberRef
  offering: { id, title }
  loanEndsAt: string (ISO)
  overdue: boolean
}

OffersOnRequest {
  request: { id, title }
  count: number                           // ≥ 1
  helpers: memberRef[]                    // distinct, oldest first
  firstOffering: { id, title }            // for "Sam offered Camping tent" when count is 1
  since: string (ISO)                     // oldest unpressed link
}

AskedToChange {
  subject: 'offering' | 'request'
  id: string
  title: string
  count: number
  since: string (ISO)
}
```

## Rules

- **Arrangements**: exactly the caller's arrangements where `needsMe` (004) is true.
- **Due back**: `status = agreed`, `loanEndsAt` not null, `returnedAt` null, caller is requester or
  lister, `loanEndsAt < startOfLocalDay(today + 3)`; not in `arrangements`.
- **Offers**: `request.askerId = caller`, `request.status = open`, `request_link.home_pressed_at`
  null, `linkedById` null or not the caller; the offering is `available` (not paused, closed or
  deleted). Grouped by request.
- **Asked to change**: flags on the caller's offerings and requests, `home_pressed_at` null; grouped
  by thing.
- **Pressing** (`POST /me/home/pressed`):
  - `{ kind: 'offers', requestId }`: sets `home_pressed_at = now()` on that request's unpressed links,
    if the request is the caller's.
  - `{ kind: 'askedToChange', subject, id }`: the same on that thing's unpressed flags, if the thing
    is the caller's.
  - A new link or flag arriving later is unpressed, so the line comes back.
