# Browser tests

These tests open the reader in a headless Chromium browser (as a phone and as
a desktop) and check what a reader would see and do: tap-to-select verses,
highlights and notes, inline Greek, witness tabs, scripture-reference links,
the Old Testament reader, Contents, settings, and more.

They run automatically on every pull request (`.github/workflows/tests.yml`).

## Running them yourself

```sh
npm install --no-save playwright@1.56.1
npx playwright install chromium
npm test                       # everything (about 2 minutes)
npm test -- notes ui-shell     # only files whose names contain these words
```

No other setup is needed: the tests start their own small web server for the
app.

## Files

| File | Covers |
|---|---|
| `ui-shell.test.cjs` | search, display settings, view switch, scroll-hide bars, phone menu, dark mode |
| `verse-selection.test.cjs` | tap-to-select rules, highlights, Matthew/Luke same-verse cases, footnote taps |
| `desktop.test.cjs` | mouse selection, clicking highlights, witness-view highlight scoping |
| `features.test.cjs` | witness tabs, swipe/arrow keys, inline Greek and lexicon, Copy, Contents and Holy Week |
| `scripture-refs.test.cjs` | the reference parser and the preview sheet / Open in reader flow |
| `old-testament.test.cjs` | Old Testament reader, Hebrew study, text size and line spacing |
| `notes.test.cjs` | highlight colours, Notes grouping, search, filters, export, print |
| `greek-placement.test.cjs` | inline Greek lands once per verse, never inside footnotes |

`helpers.cjs` holds the shared pieces (web server, phone/desktop browsers,
tapping a verse); `run.cjs` runs the files and prints a summary.
