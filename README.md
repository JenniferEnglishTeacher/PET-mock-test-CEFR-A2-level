# A2 Key / PET Reading & Writing Practice

Digital mock tests (CEFR A2 – pre-B1) for students to practise on phones, tablets and computers.

**Website:** https://jenniferenglishteacher.github.io/PET-mock-test-CEFR-A2-level/

## How it is built

| File | What it does |
|---|---|
| `index.html` | Hub page: every module and week, with a search box |
| `test.html?u=<id>` | Opens one test (e.g. `test.html?u=m1w3`) |
| `units/catalog.js` | The list of tests shown on the hub |
| `units/<id>.js` | The questions for one test |
| `assets/engine.js` | The test player (timer, navigation, scoring, sending results) |
| `assets/app.css` | Shared design |
| `assets/config.js` | `sheetUrl` = Apps Script web-app URL for results |
| `apps-script/Code.gs` | Script that writes results into the Google Sheet |

## Add a new weekly test

1. Upload the new data file to `units/` (for example `units/m1w4.js`).
2. Add one entry for it in `units/catalog.js`.

## Results

When a student finishes, one row is added to the **test result** sheet:
`TimeDates | studentName | unitName | correctPercentageforReading | mistakeQuestionNumber`.
