# Quickstart: Fill in missing details in place

## Setup

```bash
docker compose -f compose.dev.yaml up -d
npm run dev            # API on :3000, web on :5173
```

Use the demo database (`wunan_demo`), password `demo password 123`.

## Check by hand

1. **Fill in one detail**: as a requester, open an arrangement being arranged with "When" empty.
   The row reads "Not decided yet" with "Add when". Press it: only the day (and time) field opens in
   the row. Pick a day, Save. The row shows it, "Still to settle" loses "When", the messages get
   "… changed when to …", and the page didn't move.
2. **Change one**: press "Change when", clear it, Save. The row reads "Not decided yet" again.
3. **Cancel**: open "For how long", type something, Cancel. Nothing saved; focus is on "Add for how
   long".
4. **Depends on each other**: on a service, set "How" to Online. "Where" goes away. Set it back;
   "Where" returns as "Not decided yet".
5. **A problem**: on a loan, pick days already lent. The field stays open with your days and a plain
   message beside it.
6. **One field at a time**: open "When", then press "Add how": only "How" is open.
7. **Lister and helper**: the same rows are plain text, nothing to press.
8. **Old link**: open `/arrangements/<id>/edit`; you land on the arrangement's details.
9. **Notices**: as the lister with email on and the page closed, have the requester save four
   details within a few minutes: one notice arrives.
10. **Without JavaScript, keyboard, screen reader, 320 px, 200% zoom, dark theme.**

## Automated

```bash
npm run check
npm test                                   # API: single-key PATCH, notice limit
cd apps/web && npm run test:e2e -- arrangements-details-in-place stay-put
```
