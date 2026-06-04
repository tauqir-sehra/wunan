# Design tokens and contrast

wunan uses a neutral stone base with one muted green accent. Tokens live in
`apps/web/src/app.css`. Every pair below was checked with the WCAG 2.2 relative-luminance formula.
Text needs at least 4.5:1; input borders and the focus ring need at least 3:1.

| Pair | Light | Dark |
|------|-------|------|
| Text on background | 16.74 | 16.68 |
| Text on card | 17.49 | 15.06 |
| Muted text on background | 7.30 | 8.68 |
| Muted text on muted surface | 6.59 | 7.07 |
| Primary button text on primary | 7.32 | 8.29 |
| Primary (links) on background | 7.01 | 9.92 |
| Accent text on accent | 10.12 | 10.38 |
| Error text on background | 6.29 | 7.30 |
| Input border on background (3:1) | 4.59 | 4.87 |
| Input border on card (3:1) | 4.80 | 4.40 |
| Focus ring on background (3:1) | 7.01 | 9.92 |

`--border` is only for decorative lines (card edges, separators), which WCAG does not require to
meet 3:1. Anything a person must see to use a control uses `--input` or `--ring`.

When changing a colour, re-check every pair it appears in and update this table.
