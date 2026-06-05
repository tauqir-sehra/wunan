# Quickstart: Validate Proposals for Listings

How to prove the proposal workflow works end to end. Setup is the same as
[001 quickstart](../001-community-resource-sharing/quickstart.md), with a database reset first.
Endpoints: [contracts/api.md](contracts/api.md); pages: [contracts/pages.md](contracts/pages.md);
fields and states: [data-model.md](data-model.md).

## Setup

```bash
docker compose -f compose.dev.yaml up -d
npm ci
npm run db:reset -w apps/api          # drops all tables and applies the single new migration
npm run create-founder -w apps/api
npm run dev
```

Place suggestions use `PLACES_URL` from `.env` (default: komoot's public Photon server). Set
`PLACES_BIAS=<lat>,<lon>` near your test area. To check the fallback, set `PLACES_URL=` and
restart: place fields must still work as plain text.

## Automated checks

```bash
npm run check
npm run test          # API: proposals, issues, accept conflicts, loan overlap, quiet close, places
npm run test:e2e      # One spec per user story below, with axe scans in both themes
```

Expected: all pass; the OpenAPI test reads this feature's `contracts/api.md` and finds every
endpoint documented.

## Manual scenarios

Use two browser windows (Sam = lister, Robin = requester; invite Robin first).

1. **Handover options (US2)**: Sam lists a drill (Lend, up to 3 days), ticks "Picked up from me"
   and "Meet somewhere else", leaves the meeting place empty → told a place is needed. Enters an area
   by picking a full street address suggestion and a meeting place. Robin's view shows only
   "neighbourhood, city" for both.
2. **Propose and accept (US1)**: Robin → "Ask to borrow" → sends with nothing filled in and a
   message. Sam's proposal page shows "Not decided yet" for each detail and no Accept button, with
   the missing details listed. Robin changes details: Saturday 10:00, "Picked up from me", 3 days.
   Sam's open page updates without reloading, showing the change note. Sam accepts → agreement;
   Robin now sees Sam's full address on the agreement.
3. **Change before accept**: Robin changes the time while Sam's page is open but before it
   refreshes; Sam presses Accept → told the details changed and shown the new ones.
4. **Overlapping loans**: Ana proposes to borrow the drill overlapping Robin's loan → the proposal
   shows "Already lent: …" and can't be accepted. Ana moves her dates after Robin's → Sam accepts.
   The listing shows "Lent out" only once Robin's loan period starts.
5. **Nothing left (US1, edge case)**: Sam gives away 5 kg rice; Robin asks for 3 kg, Ana for 5 kg,
   Kim for 2 kg. Sam accepts Robin → Ana is told only 2 kg is left (can't be accepted until amended);
   Sam accepts Kim → Ana's proposal closes and Ana is notified.
6. **Trade accepts (US3)**: Kim lists sourdough starter accepting "Eggs, 6 item" and "Honey"; adds
   and removes rows; with JavaScript off the form says it needs JavaScript. A second trade with no rows shows "Open to offers". Proposals
   on each offer accepted things vs. a described offer.
7. **Service limits (US4)**: Jo offers bike repair, 1 hour, 4 times, Mon–Fri 18:00–21:00, area
   Riverside. Leo tries 5 times, Saturday, 2 hours, and a place in another neighbourhood → four plain
   messages; fixes each → Jo accepts; 2 sessions remain.
8. **One page (US5)**: `/proposals` shows "Asked by me" and "On my listings" with states in words;
   contact sharing and call times work on a proposal page; a declined proposal is read-only.
9. **Units (US6)**: gift "2 lb coffee", gift "8 oz tea", service lasting "2 days".
10. **Places (US7)**: type "Riv" in each place field → suggestions; keyboard only: arrows, Enter,
    Escape; screen reader announces the count. Keep typed text → accepted.
11. **Mediation sharing**: Robin reports a problem on the agreement; the inviter can't see the
    proposal messages until Robin shares them; then sees them read-only.
12. **Quiet close**: in a test, set a proposal's `last_activity_at` 31 days back and run the hourly
    job → closed, both notified.
13. **Export**: Robin's export contains `proposals.json` with the proposal and its messages.
