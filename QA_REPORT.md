# QA report

Results below come from commands actually run on 2026-10-16 in this repository (Node 22, Chromium via Playwright). Nothing here is aspirational; the last section lists what is **not** covered or not resolved.

## Automated checks

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | pass, no errors |
| Lint | `npm run lint` | pass, no warnings or errors |
| Unit + integration tests | `npm test` | **9 files, 89 tests, all passed** |
| End-to-end tests | `npm run test:e2e` (Chromium, production build) | **4 tests, all passed** |
| Production build | `npm run build` | success |
| Database migration | `prisma migrate deploy` on an empty database (used by the integration and e2e runs) | success |
| CSV round trip | integration test “exports 900 rows and re-imports them…” | 900/900 rows identical in content, all re-verified |

### What the tests cover

* **Unit (62 tests):** exact fractions, expression evaluator (including rejection of unsafe input), option/TeX parsing, all 108 templates at every tier they support (25 seeds each: no error-level validation issue, four distinct options, explanation contains the key), deterministic 900-question plan with the 30-slot topic mix per test, 900 distinct fingerprints, difficulty rules, question and bank validators, CSV export/import (BOM, CRLF, commas/quotes/newlines/Unicode, formula neutralisation, semicolon and Windows-1252 files, binary rejection, template), grading, timer helpers, mastery thresholds and evidence rules, spaced-review intervals, adaptive tier changes, Smart Review planner.
* **Integration (27 tests, real SQLite):** 900 questions in 30 tests × 30, start/resume (one open attempt only), answer saving and changing, no answer key leaked while in progress, grading (17/30 example), two simultaneous submits give one result and 30 skill events, expiry auto-submit with `TIMED_OUT`, retakes keep every attempt and report improvement/personal best, 10-question Smart Review with hidden answers, double answers ignored, no repeats between sessions, official bank untouched, similar question on the same skill, Ready-for-Review; export/import of 900, a test and a range; broken/oversized/non-CSV files rejected with no bank created; row-numbered detection of wrong key, duplicate options, missing field and duplicate id; update-selected mode; published banks read-only; draft copy editing; invalid edit blocks publishing; regeneration; manual review flag; in-progress attempt keeps its bank when another bank is activated; rollback; deletion safeguards; replace-active requires `REPLACE`; admin login, hashed passwords, rate limit, cross-site rejection, audit log.
* **E2E:** student flow (select test → answer with Next/Previous → refresh keeps answers and timer → change answer → submit with confirmation → results → review → similar question → Smart Review of 10 questions → progress), 375 px wide layouts without horizontal scrolling, admin routes protected (401/redirect, no admin text on student pages), admin flow (bad then good login → generate 900 → validation message → export with BOM → import → preview → commit; truncated file rejected → publish → rollback → read-only published bank → sign out).

## Content verification (reference bank, seed `kenny-grade5-v1`)

Generated 2026-10-16 by `npm run qa:report`.

| Check | Result |
|---|---|
| Questions | 900 |
| Tests with exactly 30 questions | 30/30 (structure errors: 0) |
| Questions with no error-level problems | 900/900 |
| Duplicate IDs / positions / questions | 0 |
| Verified automatically (independent evaluator) | 900/900 |
| Methods | both: 125, expression: 775, arithmetic-text: 0, none: 0 |
| Flagged for manual review (warnings + review) | 0 |
| Bank-level errors | 0 |
| Bank-level warnings | 0 |
| Distinct question texts | 885 |
| Distinct question “skeletons” (numbers/maths removed) | 420 |
| Templates used / available | 108/108 |
| Skills (Smart Review) | 62 |

### Difficulty progression (average rating 1–5)

| Level | Tests | Q 1–10 (Easier) | Q 11–20 (Moderate) | Q 21–25 (Challenging) | Q 26–30 (Most challenging) | Overall |
|---|---|---|---|---|---|---|
| Beginner | 1–10 | 1.40 | 1.90 | 2.30 | 2.80 | 1.95 |
| Intermediate | 11–20 | 2.30 | 2.80 | 3.20 | 3.70 | 2.85 |
| Advanced | 21–30 | 3.20 | 3.70 | 4.10 | 4.60 | 3.75 |

Rating distribution: 1: 70, 2: 265, 3: 330, 4: 200, 5: 35

### Topic coverage

| Topic | Questions | Per test | Skills |
|---|---|---|---|
| Whole Numbers | 60 | 2 | 6 |
| Order of Operations | 60 | 2 | 1 |
| Fractions | 90 | 3 | 5 |
| Decimals | 90 | 3 | 6 |
| Percentages | 60 | 2 | 4 |
| Ratios | 60 | 2 | 3 |
| Measurement | 60 | 2 | 2 |
| Geometry | 90 | 3 | 5 |
| Time & Speed | 60 | 2 | 4 |
| Word Problems | 90 | 3 | 6 |
| Patterns | 60 | 2 | 5 |
| Logical Reasoning | 30 | 1 | 6 |
| Multi-step Problems | 60 | 2 | 4 |
| Reasoning Challenges | 30 | 1 | 5 |

### Most re-used question patterns

- 8× `in the number #, what is the value of the digit #?`
- 8× `a jug holds # l of juice. how many glasses of # ml can be filled completely from the jug?`
- 7× `which of these decimals is the greatest?`
- 7× `a rectangular garden is # m long and # m wide. a fence goes all the way around it, except for a # m gap for the gate. th`
- 7× `a rule changes each input number to an output number. input # gives #, input # gives #, and input # gives #. what output`
- 7× `look at this pattern: #, #, #, #, #, … the numbers go up by a bigger amount each time. what is the next number?`
- 7× `a recipe for # people uses # g of flour. flour is sold in # kg bags. how many bags must be bought to make the recipe for`
- 7× `round # to the nearest hundredth.`

Pure calculation questions (“Calculate ⟨expression⟩”) necessarily share a skeleton; their numbers and operations differ.

### Questions flagged for manual review

None. Every question was confirmed by the independent expression evaluator.

### Reading levels / content notes

- All answer keys are computed by code from the generated numbers; each key is then re-evaluated by an independent exact-arithmetic evaluator (`verify_expr`) and, for plain arithmetic questions, by parsing the displayed question text.
- Verification confirms that the marked option is mathematically correct and that no other option has the same value. It does **not** replace a teacher reading the wording, which is why the admin panel lets a reviewer open any question.

## Interpretation of the content results

* “Verified automatically” means: the marked option equals the value of an independently evaluated expression (exact rational arithmetic, not floating point), and no other option equals that value; for plain arithmetic questions the displayed question text was also parsed and evaluated separately (127 questions have both checks). Puzzle templates with a unique-answer claim (digit puzzle, heads and legs, giving problems) additionally brute-force the solution space.
* This establishes **numerical correctness and internal consistency** (one correct option, explanation states the key, units/format consistent, valid KaTeX). It does not establish that every sentence is the best possible wording for a 10-year-old; that needs a teacher's read-through (the Question Manager previews every question and supports *Mark reviewed*).
* No question in the reference bank is currently flagged for manual review, because every template supplies a verification expression. Imported questions without `verify_expr` that are not plain arithmetic **are** flagged.

## Unresolved issues and limitations (honest list)

1. **Repetition of patterns.** 900 questions come from 108 templates. Numbers, names and, for several templates, contexts vary, and no two questions are identical (885 distinct texts; 900 distinct text+answer pairs), but some structures recur up to ~8 times across the 30 tests (see the list above). More templates and context variants would reduce this further.
2. **Pedagogical review pending.** Difficulty ratings come from the position/test formula and template tiers, not from classroom data. The first questions of each band can feel easier or harder than their rating suggests.
3. **Skill evidence is thin at first.** There are 62 skills; a skill needs 3 attempts before a status other than “Not Enough Data” is shown and “Mastered” needs 5 attempts in 2 sessions. After the first test most skills have 0–2 data points, so Smart Review initially reacts to single mistakes.
4. **Timer expiry is tested at service level** (persisted expiry, auto-finalisation on next access, late-answer rejection) and the countdown/refresh behaviour is covered end to end, but there is no e2e test that waits the full 30 minutes or fast-forwards the browser clock.
5. **Browser coverage:** e2e ran on desktop Chromium only; the phone check is a 375 px viewport overflow test, not a real device. Screen-reader behaviour was not tested manually.
6. **Admin UI coverage:** the question edit modal, duplicate/regenerate buttons, import modes B/C and settings forms are covered by service/API-level tests, not by browser tests.
7. **Rate limiting is in memory** (per server process) and resets on restart; fine for one instance.
8. **Vietnamese** covers navigation and key student labels, not question content or the admin area (admin is English by specification).
9. **SQLite** is single-writer; suitable for one student plus one admin. See README for the PostgreSQL migration steps (not exercised in this build).
10. **Mixed units in a few distractor sets** are intentional (e.g. powers-of-ten mistakes) and are accepted by the validator because each option still carries the same unit.
