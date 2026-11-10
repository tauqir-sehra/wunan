# Design tokens and contrast

wunan uses a warm paper-coloured base with one muted green accent. Tokens live in
`apps/web/src/app.css`. Every pair below was checked with the WCAG 2.2 relative-luminance formula.
Text needs at least 4.5:1; input borders and the focus ring need at least 3:1.

| Pair | Light | Dark |
|------|-------|------|
| Text on background | 16.10 | 16.71 |
| Text on card | 17.57 | 15.37 |
| Text on muted surface | 14.88 | 13.81 |
| Muted text on background | 7.01 | 8.61 |
| Muted text on card | 7.64 | 7.92 |
| Muted text on muted surface | 6.48 | 7.12 |
| Muted text on accent | 6.39 | 6.12 |
| Primary button text on primary | 7.85 | 9.36 |
| Primary (links) on background | 7.19 | 10.88 |
| Primary on card | 7.85 | 10.01 |
| Primary on accent | 6.56 | 7.73 |
| Text on accent | 14.68 | 11.88 |
| Accent text on accent | 10.34 | 10.56 |
| Error text on background | 6.00 | 7.50 |
| Error text on card | 6.54 | 6.90 |
| Destructive button text | 6.54 | 7.04 |
| Input border on background (3:1) | 4.42 | 5.01 |
| Input border on card (3:1) | 4.82 | 4.60 |
| Focus ring on background (3:1) | 7.19 | 10.88 |
| Focus ring on card (3:1) | 7.85 | 10.01 |

`--border` is only for decorative lines (card edges, separators), which WCAG does not require to
meet 3:1. Anything a person must see to use a control uses `--input` or `--ring`.

When changing a colour, re-check every pair it appears in and update this table.

## Shape and depth

- **Corners**: `--radius` is 0.875rem. Buttons, chips and the search box are fully rounded; cards
  use the `surface` utility (hairline border, large radius, a very soft shadow in the light theme).
- **Shadow**: `--soft-shadow` is the only shadow. It has no colour of its own and disappears in the
  dark theme, where the lighter card colour does the same job.
- **Chosen things** (the current tab, a ticked filter chip, a picked option card) change background
  and outline only, never size or weight, so nothing moves when you choose (constitution V).

