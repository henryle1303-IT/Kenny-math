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
