# Quickstart: How You're Connected

## Setup

```bash
docker compose -f compose.dev.yaml up -d
# Schema changed: reset the dev database (nothing is kept).
DATABASE_URL=$D npm run db:reset -w apps/api
npm run seed:demo -w apps/api -- --members 200 --offerings 600 --requests 300
npm run dev
```

## Automated checks

```bash
npm run check
npm test                                  # connectionOf() unit tests; GET /members/{id} connection; checks reject a wrong line
cd apps/web && npm run test:e2e -- members-connection accessibility us1-join
```

## Scenarios (by hand)

1. **Shared ancestor**: as a member whose line is Fay → Ben → you, open the profile of Rosa (Fay →
   Chloe → Faraz → Rosa). The side column shows Fay at the top with "You both trace back to Fay",
   Ben then "You" on one side, Chloe, Faraz, Rosa on the other; the sentence reads "You both trace
   back to Fay."
2. **Your inviter**: open Ben's profile. One line, "Ben invited you.", no "trace back" label.
3. **Someone you invited**: open their profile. "You invited Sam."
4. **Your own profile**: "Your invite line" from your founding member down to you.
5. **Different founders**: with two founders, open a member from the other founder's line. Two
   columns and "You and … trace back to different founding members."
6. **Someone left**: have Ben delete his account; Rosa's and your trees still show "Ben (no longer a
   member)" without a link.
7. **Old link gone**: `/members/{id}/chain` shows the usual "couldn't find that page".
8. **By hand**: keyboard only (each name in the sentence is reached once); screen reader reads the
   sentence once; 320 px and 200% zoom with a 20-deep line; dark theme.

## Speed (SC-003)

The demo seed picks inviters at random, so its lines are only about 5 deep. The API test builds two
lines 20 deep that meet at the founder and checks `GET /api/v1/members/{id}` answers well within
2 seconds (in practice a few milliseconds) with all 40 people in the connection.
