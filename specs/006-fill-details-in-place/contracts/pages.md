# Contract: Pages (filling in details in place)

The API doesn't change: saving one detail is `PATCH /api/v1/arrangements/{id}` with only that
detail's keys (research §2).

## Routes

| Route | Change |
|-------|--------|
| `/arrangements/[id]` | Reads `?detail=<key>` (data-model.md) to open that one field. New action `?/detail`. |
| `/arrangements/[id]/edit` | **Removed.** Redirects (308) to `/arrangements/[id]#details`. |

The 004 pages contract rows for `/arrangements/[id]/edit` and the "Change details" button are
replaced by this.

## The details list (`#details`)

For the requester, while the arrangement is open, each pressable row (data-model.md) is:

- `<dt>` the label ("When"), `<dd>` the value or "Not decided yet", then a link
  `id="detail-<key>"` to `?detail=<key>#details` with `data-sveltekit-reset="false"`, reading
  "Add when" (empty) or "Change when" (filled). Outline style, not filled.

Everyone else, and every row once agreed or ended, is plain text as today.

When "How" is at the lister's place, the "Where" row is never pressable. Its `<dd>` shows the place,
then a quiet note in muted text: "Picked by Fay" (to the lister: "Picked by you"). Not shown once
agreed, where the place reads as part of what was agreed.

## One open field

When `detail` names a pressable row, that row's `<dd>` holds instead:

```text
<form method="POST" action="?/detail#details" use:enhance={stayPut()}>
  <input type="hidden" name="detail" value="when">
  …that one detail's fieldset, as on the ask form, filled with the current value…
  [Save] (outline)   Cancel (link to the page without ?detail, back to #detail-when)
</form>
```

- Focus moves to the first input when it opens; after Save or Cancel it returns to `#detail-<key>`.
- A problem shows beside the field (the API's field message, or its plain message); the typed value
  stays, and the field stays open.
- On success the page drops `?detail`, the row shows the new value, "Still to settle" updates, and
  nothing above moves (SC-003).

## Buttons

| Stage, requester | Before | After |
|------------------|--------|-------|
| Being arranged, details missing | **Change details** (filled), Withdraw | Withdraw (outline); rows are the way in |
| Being arranged, nothing missing | Change details, Withdraw | Withdraw (outline) |

The lister's buttons don't change.

## Help

The arrangements help topic says to press a detail to add or change it, instead of "Change details".
