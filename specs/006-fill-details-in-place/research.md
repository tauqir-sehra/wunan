# Research: Fill in missing details in place

## 1. Saving one detail

**Decision**: Use the existing `PATCH /api/v1/arrangements/{id}`, sending only the keys for the one
detail. No API change.

**Rationale**: `updateArrangement` already treats a missing key as "leave as it is" (`toValues`
uses `input[key] !== undefined`; `saveOffers` returns early when `offers` is missing). It already
checks the requester, that the arrangement is open, the loan's free days, and the place's area, and
writes one "Rosa changed when to …" line with only what changed (FR-004).

**Alternatives considered**: one endpoint per detail (more code, same rules); sending the whole form
with the other values filled from the page (a stale page could overwrite a newer change).

## 2. The keys for each detail

| Row | `detail` | Keys sent |
|-----|----------|-----------|
| When | `when` | `date`, `time` |
| How | `how` | `handover` (and `place: null` when it becomes `at_lister` or `online`, as today) |
| Where | `where` | `place` |
| For how long | `length` | `loanLength`, `loanLengthUnit` |
| How much | `amount` | `amount` |
| In return | `return` | `offers`, `ownOffer`, `ownOfferAmount`, `ownOfferUnit` |
| Each time | `session` | `sessionLength`, `sessionLengthUnit` |
| How many times | `sessions` | `sessions` |

An emptied field sends `null` for its keys (clears that detail; 002 FR-015). "Where" can't be
pressed when "How" is at the lister's place: that place is the offering's area, not the requester's
to set (as today, `detailValues` leaves it out). The row says so quietly: "Picked by Fay" (FR-009a).

## 3. Opening one field, with and without JavaScript

**Decision**: Each row the requester can change is a link to `?detail=<key>#details`
(`data-sveltekit-reset="false"` so it doesn't scroll), named "Add when" / "Change when". The page
reads `detail` from the URL and renders that row as a small form holding just that field, with
"Save" and "Cancel". Save posts to the page's `?/detail` action (`use:enhance={stayPut()}`, no-JS
fallback `#details`); Cancel is a link back to the page without `detail`.

**Rationale**: Works the same without JavaScript (FR-008), only one field can be open because the
URL holds one key (FR-007), and the page and back button behave predictably. A link is the right
element: it changes what the page shows and has a URL.

**Alternatives considered**: a `<button>` toggling local state (doesn't work without JavaScript);
`<details>` per row (several could be open at once, and a native disclosure can't hold the
"Add when" naming well).

**Focus**: when the field opens, focus moves to its first input (an `autofocus`-style action that runs
once on mount; it doesn't scroll). After Save or Cancel the URL drops `detail` and focus returns to
the row's link (`#detail-<key>`).

## 4. Rendering just one field

**Decision**: `ArrangementFields.svelte` gets an `only` prop naming one detail; it renders only that
detail's fieldset. The same component keeps rendering the whole form for asking (the offering page
and "ask again"), so the choices and checks stay identical (FR-003).

**Alternatives considered**: eight new small components (duplicates the field markup and its
errors).

## 5. One notice for saves close together (FR-004a)

**Decision**: No change. The detail-change line is posted with `postEvent(..., notice)`, which calls
`notify` with the arrangement's `conversationId`; `notify` already sends at most one notice per
conversation per hour, and none while the lister has the conversation open. That is within "at most
one in any 10 minutes". An API test pins it.

**Alternatives considered**: a separate 10-minute throttle (looser than what exists; nothing to gain).

## 6. The old "Change details" page

**Decision**: Delete `/arrangements/[id]/edit`; its route becomes a `+page.server.ts` that redirects
(308) to `/arrangements/[id]#details` so old links and emails land on the details. The "Change
details" button and the `'edit'` primary action go; the requester has no filled button while details
are missing (FR-010).

## 7. When the arrangement changed meanwhile

**Decision**: A save on an arrangement that has ended gets the API's existing 409 "This proposal has
ended …"; the action returns it as the form's error beside the field, with the typed values kept,
and the page data refreshes so the rows show the arrangement as it is now.

## 8. Found while building: forms that update in place don't navigate

SvelteKit 3's enhanced forms navigate to the action's address after a result, which drops the
page's own `?detail=` and scrolls to the top. `stayPut()` now calls `update({ navigate: false })`,
so every in-place form applies its result to the page as it is. Every `stayPut` form posts to its
own page (`?/action`), so nothing else changes. After a save, the field closes by dropping
`?detail` with `goto(…, { reset: false })`, unless the member has already opened another field.
