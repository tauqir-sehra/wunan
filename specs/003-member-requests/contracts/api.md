# Contract: Backend API v1 (additions for requests)

Additions and changes to the [002 API contract](../../002-listing-proposals/contracts/api.md), whose
conventions all hold (auth, errors, pagination, places as `{ display }` for others). Every change is
additive, so it stays in v1. `src/openapi.test.ts` checks the endpoints in both files.

## Requests

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /requests` | member | Open requests by other members, newest first, paginated. `?q=` words, `?kind=borrow,receive,trade,service` (comma list), `?area=` (matches neighbourhood or city). `?mine=true` instead lists the caller's own, open first, then closed (any reason except `account_deleted`). Items: `{ id, kind, title, area (display), neededAfter, neededBy, asker, status, linkCount, createdAt }`. |
| `POST /requests` | member | Create. Body is a discriminated union on `kind`; only `kind` and `title` are required. Shared: `description`, `neededAfter`, `neededBy` (YYYY-MM-DD; `400` if by < after), `area` (place), `handovers`. Borrow: `loanLength`+`loanLengthUnit`. Receive: `amount`+`unit`. Trade: `amount`+`unit`, `giveBack` (≤10 `{ description, amount?, unit? }`). Service: `sessionLength`+`sessionLengthUnit`, `sessions`, `availability` (≤14 `{ weekday, startTime, endTime }`). → `201 { id }`. |
| `GET /requests/suggestions` | member | `?kind=&q=&area=`. Up to 5 available offerings of the matching type that might answer it, not the caller's own; area matches first (research §5). Items as in `GET /offerings`. `q` shorter than 3 characters → `{ items: [] }`. |
| `GET /requests/{id}` | member | Full request: details (area as `{ display }` unless the caller is the asker), `giveBack`, `availability`, `asker`, `status`, `closedReason`, `closedByAgreementId` (asker only), `datePassed` (true when `neededBy` is before today, community time zone), `links: [{ id, offering: { id, title, type, status, owner }, linkedBy, available, canRemove }]`, `canAnswer`, `canEdit`, and for the asker on a request closed as `agreed`, `myOtherOpenProposals: [{ id, offeringTitle }]`. A request closed with `account_deleted` → `404`. Asker also gets `flags`. |
| `PATCH /requests/{id}` | asker, open | Same fields as create (null clears; `kind` can't change). Notifies members who linked an offering (`request` type) with what changed. |
| `POST /requests/{id}/close`, `/reopen` | asker | Close (open only) or reopen (closed `by_asker` or `agreed` only). Notifies linkers. |
| `POST /requests/{id}/links` | member | `{ offeringId }`. The caller must own the offering, or be the asker; the offering's type must answer the request's kind (`400 wrong_type`), be available (`409 not_available`), and the request open (`409 request_closed`). An existing link → `409 already_linked`. A helper can't link to their own request (`403`). → `201 { id }`. Notifies the asker (`request` type) unless they linked it. |
| `DELETE /requests/{id}/links/{linkId}` | the member who linked it, or the offering's owner | Removes the link; the offering is unchanged. |
| `POST /requests/{id}/flags` | non-asker | `{ request }` (1–500 characters); goes to the asker (`flag` type). Request unchanged. |

## Offerings (changed)

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `POST /offerings` | member | Adds optional `forRequest` (request id). After the offering is created, it is linked as with `POST /requests/{id}/links`; if the link can't be made (request closed meanwhile, or wrong type), the offering is still created and the response says why: `201 { id, linked: false, linkProblem: "request_closed" }` (spec Edge Cases). Otherwise `{ id, linked: true }`. |
| `GET /offerings/{id}` | member | Adds `answers: [{ requestId, title, asker }]` for open requests it is linked to, and `myOpenRequestsLinked: [{ id, title }]` (the caller's own open requests this offering is linked to, for the proposal prefill and choice). |
| `GET /offerings` | member | Items add `answersRequest: { asker } | null` (the first open linked request), for the "For <asker>'s request" line (FR-014). |

## Proposals (changed)

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| (proposal endpoints) | | Replaced by arrangements in feature 004, which keep these additions (`requestId` when asking, `request` on the arrangement, closing the tied request on accepting): see [004 contracts/api.md](../../004-arrangements/contracts/api.md). |

## Public threads

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /requests/{id}/messages`, `GET /offerings/{id}/messages` | member who can see it | Newest 20 by default, returned oldest first; `?before=<message id>` for earlier ones; `{ items: [{ id, author, body, removed, createdAt, mine, flags? }], hasEarlier, canPost }`. `flags` only on the caller's own messages. |
| `POST /requests/{id}/messages`, `POST /offerings/{id}/messages` | member | `{ body }`, plain text 1–240 characters after trimming (`400` with `fields.body`, e.g. "Please keep it to 240 characters; this is 251."). Refused with `409 thread_closed` when the request is closed or the offering is closed or removed. Shares the private-message limit (`429 slow_down`, research §7). Notifies the asker or lister and earlier posters (`public_message` type, once per thread per member per day). → `201 { id }`. |
| `GET /requests/{id}/messages/live`, `GET /offerings/{id}/messages/live` | member who can see it | Server-Sent Events: `event: message` with `{ id }` when a message is posted or removed (FR-023g); the client fetches it. Heartbeat and reconnect as 001's conversation stream. |
| `DELETE /public-messages/{id}` | author | Removes it: body emptied, shown as "Message removed". |
| `POST /public-messages/{id}/flags` | non-author | `{ request }`; goes to the author (`flag` type). Message unchanged. |

## Settings and export (changed)

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /me/notification-preferences`, `PUT /me/notification-preferences` | member | Seven types: adds `request` and `public_message`, both off until turned on. |
| `GET /me/summary` | member | Adds `unseenRequestFlags`: issues raised about my requests that I haven't seen yet (for the counts on "My requests" and the Requests nav link). |
| `GET /me/export` | member | Adds `requests.json` and `public_messages.json` ([data-model.md](../data-model.md) "Export"). |
