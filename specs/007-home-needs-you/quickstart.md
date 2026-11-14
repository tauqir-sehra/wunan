# Quickstart: A home page of what needs you

## Set up

```bash
docker compose -f compose.dev.yaml up -d
npm run db:reset -w @wunan/api     # the migration was regenerated
npm run dev
```

Use the demo data (password `demo password 123`) or make members in the browser.

## Check by hand

1. **Landing**: sign in → `/` shows "Waiting on you". The header has "Home" first, marked current.
   Signed out, `/` goes to Offerings as before.
2. **Nothing**: as a member with nothing waiting → only "Nothing right now." under the heading.
3. **Arrangements**: ask to borrow something as one member; as the lister, Home lists it under
   Arrangements in the same words as Arrangements → "Waiting on you". Accept it; back on Home it's gone.
4. **Due back**: agree a loan ending the day after tomorrow → both borrower and lender see it under
   "Due back" with weekday and date. A loan ending in 4 days isn't listed. Mark it returned → gone.
   A late loan: the lender sees it under Arrangements only; the borrower under Due back.
5. **Offers**: as an asker, have another member answer the request → Home lists it. Open the request
   from Requests → still listed. Press the line on Home → you land on the request; back on Home it's
   gone. Another answer → back.
6. **Asked to change**: have another member ask to change something about your offering → listed.
   Seeing it on the offering leaves it; pressing the Home line removes it.
7. **See all**: with 7 lines in a group → 5 and "See all 7"; press it → the other 2 appear below,
   nothing above moves, focus on the 6th.
8. **Without JavaScript, 320 px, 200% zoom, dark theme, keyboard, screen reader**: all of the above.

## Automated

```bash
npm run check
npm test
cd apps/web && npm run test:e2e -- home stay-put
```
