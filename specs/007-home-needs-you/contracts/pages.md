# Contract: Pages (Home)

## `/` (Home)

- **Signed out**: as today (redirect to `/offerings`).
- **Signed in**: Home.
  - `h1` "Waiting on you", with the help link.
  - Up to four groups, each an `h2` (small, quiet) and one `ul` drawn as a single card with a line
    between rows, shown only when they have lines, in this order. Each row is one link: the
    thing's name (underlined), under it a short quiet line of pieces set apart by " · " (a comma
    for screen readers), "New message" at the end when unread, and a chevron.
    1. **Arrangements** → `/arrangements/{id}`: offering title; "You asked Fay" / "Sam asked you",
       then the Arrangements list's stage words (`stageWords`: "Ready for you to accept", "Needs
       details: when, how", "Due back Sat 14 Nov, 10 am").
    2. **Due back** → `/arrangements/{id}`: offering title; borrower "From Fay · Due back Thursday
       20 November" (late: "Was due back …"); lender "Lent to Sam · Due back Thursday 20 November".
       The lender's late loans are under Arrangements, not here.
    3. **Offers on your requests** → `/home/go?kind=offers&id={requestId}`: request title; "Sam
       offered Camping tent", or "3 new offers · From Sam, Ana and others".
    4. **Asked to change** → `/home/go?kind=askedToChange&subject=offering&id={id}` (or `request`):
       the thing's title; "Someone asked you to change something", or "2 requests to change
       something".
  - Nothing at all: under the heading, "Nothing right now." Nothing else.
  - More than 5 in a group: the first 5, then the link "See all {n}" to
    `?all={group}#{group}` (`data-sveltekit-reset="false"`); the rest then appear below the first 5
    and focus moves to the first of them. Groups' `id`s: `arrangements`, `due-back`, `offers`,
    `asked-to-change`.
  - No filled button; no search box; no live updates.

## `/home/go` (no page)

`GET` with `kind`, `id` (and `subject`): records the press (`POST /me/home/pressed`) and redirects
`303` to `/requests/{id}` for offers, or to `/offerings/{id}` / `/requests/{id}` for asked to change
(where the flags are shown). Signed out: to sign-in with `redirectTo`. Unknown `kind`: `303` to `/`.

## Header (every page)

- Signed in: "Home" first among the main links (Home, Offerings, Requests, Arrangements), with the
  same current-page pill, current only on `/`. In the phone "Menu" too.
- The wunan name links to `/` (as today).
- Counts unchanged.
