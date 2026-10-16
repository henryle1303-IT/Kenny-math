# Kenny Math Challenge – plan and design decisions

This document records the architecture and the decisions behind the implementation. It was written first and updated as the build progressed; where the final code differs from the first draft the final decision is what is described here.

## 1. Architecture

Single Next.js 15 application (App Router, TypeScript, React 19, Tailwind 3) with server components for read pages, route handlers for JSON APIs, and Prisma on SQLite.

```
src/lib/math      exact rational arithmetic (Frac), safe expression evaluator, option/TeX parsing
src/lib/gen       question generator: templates, engine, curriculum plan, 108 templates / 62 skills
src/lib/validate  question-level and bank-level validation (pure, no DB)
src/lib/csv       CSV export (BOM, formula escaping), import (encoding detection, papaparse, zod)
src/lib/learning  mastery, spaced review, adaptive difficulty, Smart Review planner (pure)
src/lib/services  database services (attempts, banks, importer, review, progress, admin-auth)
src/app           student pages, /admin pages, /api routes
tests/            unit (pure logic), integration (services + temp SQLite), e2e (Playwright)
```

Principles: pure logic is separated from database code so it can be unit-tested exhaustively; every state change that must be consistent (submitting a test, activating a bank, recording a review answer) is a single database transaction with an idempotent guard.

## 2. Technology choices

| Need | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router, TypeScript | one deployable app for UI, API and admin |
| DB | SQLite + Prisma 6 | zero-ops for a single student; the schema uses only portable features (JSON stored as text, no SQLite-specific types) so moving to PostgreSQL means changing the provider and re-running migrations |
| Maths display | KaTeX (server-rendered) | fractions render correctly on phones, no layout shift |
| Charts | Recharts | simple, accessible enough with text alternatives |
| CSV | PapaParse | robust quoting/multiline/delimiter detection; no manual splitting |
| Validation | Zod (row schema) + own validators | |
| Passwords | bcryptjs (cost 12) | pure JS, no native build step |
| Tests | Vitest, Playwright | as specified |

No paid AI API is used anywhere. All maths content is produced and checked by deterministic code.

## 3. Database design

Tables: `Student`, `QuestionBank`, `Test`, `Question`, `TestAttempt`, `StudentAnswer`, `ReviewSession`, `ReviewQuestion`, `SkillEvent`, `SkillProgress`, `AdminUser`, `AdminSession`, `AdminAuditLog`, `ImportJob`, `Setting`.

Key decisions:
* `Question.questionId` is the stable human id (e.g. `T07-Q12`), unique **per bank**; the primary key is a separate cuid so the same id can exist in several banks. Matching for “update selected questions” uses `questionId`.
* A `TestAttempt` stores `bankId`, the **ordered list of question primary keys**, `startedAt` and `expiresAt`. Because published banks are immutable and attempts reference exact question rows, history can never change.
* `TestAttempt.inProgressKey` (`studentId:testNumber`, unique, nulled on submit) guarantees at most one open attempt per test, even with double clicks or two tabs.
* `StudentAnswer` is unique per (attempt, question); unanswered questions get a row at grading time.
* `SkillEvent` is an append-only log (one row per question answered, from tests and reviews). `SkillProgress` is a cache recomputed from the log, so rules can change without data loss.
* Only one `QuestionBank` has `isActive = true`; activation flips both flags inside one transaction.

## 4. Pages and navigation

Student: Home `/`, Math Tests `/tests`, test runner `/attempt/[id]`, results `/results/[id]`, answer review `/results/[id]/review`, Smart Review `/review` and `/review/[sid]`, My Progress `/progress`. The student UI has no admin links.

Admin (`/admin`, session cookie required): Dashboard, Question Manager, Question Generator, Import / Export, Bank Versions, Student Progress, Settings (spaced-review intervals, student name, password, activity log).

## 5. Question-generation strategy

* **Templates** (`src/lib/gen/templates/*`): 108 parameterised generators in 14 topics. Each takes a seeded RNG and a tier 1–5 and returns the question text, the correct option, hand-designed distractors that reflect typical mistakes, an independent verification expression, explanation steps, the common mistake and a learning tip.
* **Engine** (`engine.ts`) turns that into a finished question: exact-evaluates the verification expression (own evaluator, no `eval`), compares it with the marked option, runs an optional independent check (e.g. brute-force search for puzzle uniqueness), re-computes pure arithmetic from the displayed question text, rejects negative answers, builds three distinct distractors (padding numerically if needed, rejecting equal values such as `0.5` vs `1/2`), shuffles options and writes the structured explanation (“What it asks / Concept / Step n / Answer”).
* **Curriculum plan** (`curriculum.ts`, `bank.ts`): difficulty rating = f(test number, position band). Questions 1–10 / 11–20 / 21–25 / 26–30 form four bands; ratings rise across bands and across tests (Beginner ≈ 1–3, Intermediate ≈ 2–4, Advanced ≈ 3–5), so the first questions of Test 25 are harder than the first questions of Test 5. Each test contains a fixed topic mix (30 slots over 14 topics); topics are placed at positions where a suitable template exists, with a feasibility rule so harder topics never land on tier-1 positions. Templates are chosen by least-use balancing and avoiding repeated skills inside one test.
* **Uniqueness**: a fingerprint of (question text, correct option) must be new within the bank; generation retries with a different sub-seed otherwise.
* **Batches**: the admin UI generates three tests per request and shows progress; the plan is deterministic so batches are independent.
* **Smart Review** reuses the same templates, but through a separate path (`services/review.ts`), and never touches the official bank.

## 6. CSV import / export design

Columns: the 16 required stable columns, plus optional `bank_id`, `bank_version`, `verify_expr`, `validation_status`. `verify_expr` keeps the machine-checkable answer expression through a round trip so re-imported generated questions are verified again instead of being flagged for manual review. Export is UTF-8 with BOM, CRLF, quotes only when needed; cells beginning with `= + @ tab CR` (or `-` not followed by a digit) are prefixed with `'` and the importer reverses this.

Import pipeline: size/extension checks → encoding detection (BOM, UTF-16, UTF-8, Windows-1252 fallback) → PapaParse (delimiter auto-detected, `#` comment lines ignored) → required-column check → Zod row coercion → per-question validation → bank-level validation (900 questions, 30×30, unique ids/positions/texts, level mapping, rising difficulty) → report (rows valid/invalid/duplicate/missing/test-count/warnings/review) with preview and downloadable error CSV. The parsed rows are stored in an `ImportJob`; nothing touches question tables until the admin commits, and a failing full-bank file can never be committed. Modes: **A** new draft bank, **B** replace active (validated copy; publishing/activation additionally requires typing `REPLACE`), **C** update selected questions (matched by `question_id`, must keep test/position, saved as a new draft copy of the chosen bank).

## 7. Smart Review algorithm

* Every answered question (test or review) adds a `SkillEvent`.
* Per skill: recent accuracy over the latest 10 events; status thresholds <50 / 50–69 / 70–84 / ≥85 %; “Not Enough Data” below 3 attempts; “Mastered” also needs ≥5 attempts spread over ≥2 sessions.
* Spaced review: a session counts as correct if all its answers for the skill were correct; streak of correct sessions → next review after 0 / 1 / 3 / 7 days (configurable in Settings). Due skills appear under “Ready for Review”.
* Planner: priority = (1 − accuracy)·3 + 0.5·recent mistakes + 1 if due; picks up to 3 questions per skill, 10 in total, sorted from easier to harder tier; new students get a varied warm-up.
* Adaptive tier: accuracy bands map to tiers 1/2/3/4 and the tier may move by at most one step from the last tier used for that skill (first practice capped at 3).
* Sessions are untimed; answers are revealed one question at a time with an explanation for mistakes.

## 8. Admin authentication

* Admin users in the database with bcrypt hashes; the seed script takes `ADMIN_EMAIL` / `ADMIN_PASSWORD` or generates a random password and prints it once. Nothing is hard-coded in frontend code.
* Login creates a random 256-bit session token; only its SHA-256 is stored; cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production (override only for plain-HTTP deployments); sessions last 12 h.
* Every `/api/admin/*` handler calls `requireAdmin` (server side, database lookup) and rejects cross-site writes by comparing `Origin` with `Host`. Admin pages redirect to the login page when there is no valid session.
* Brute-force protection (5 failures per IP+email in 15 minutes), constant-time-ish login, upload limit 5 MB and extension check, audit log of every admin operation.

## 9. Testing strategy

* **Unit**: exact arithmetic, evaluator, option parsing, every template at every supported tier (valid, verified, consistent), bank plan (900 slots, topic mix, determinism, 900 distinct questions), difficulty rules, validators, CSV parsing/serialisation/round trip, grading, timer helpers, mastery, spaced review, adaptive difficulty, planner.
* **Integration** (real SQLite, services called directly): start/resume/save/submit, idempotency and concurrency, expiry auto-submit, attempt history, skill events, Smart Review sessions, similar questions, CSV round trip into a new bank, rejection of broken files, all three import modes, publishing rules, immutability of published banks, in-progress attempts surviving a bank switch, rollback, deletion safeguards, admin login/rate limit/CSRF/audit.
* **E2E** (Playwright, production build): the full student flow, mobile overflow check, admin protection, and the full admin flow (login → generate 900 → validate → export → import → publish → restore).
* **Content QA**: `npm run qa:report` validates all 900 reference questions and reports coverage, difficulty progression and flags.

## 10. Milestones (all completed – see QA_REPORT.md for evidence)

1. Math core + validators + template engine
2. Curriculum plan and 900-question generation
3. Database schema, services, seed
4. Student UI: dashboard, tests, runner with persisted timer, results, review
5. Smart Review: events, mastery, spaced review, planner, sessions, similar questions
6. Admin: auth, generator, question manager, CSV, import modes, versions, audit
7. Tests, QA report, documentation, Dockerfile

## Known limitations / future work

* Template-based questions are verified for **numerical correctness and internal consistency**, not for pedagogical taste; a teacher should skim the questions (the Question Manager previews them).
* Some questions share a template and wording with different numbers (a normal feature of generated workbooks); see the “re-used patterns” list in QA_REPORT.md.
* Single-student design (`Student` id `kenny`); the schema is multi-student ready but there is no student login.
* Vietnamese is provided for the main navigation and key student labels; question content is English.
* SQLite is a single-writer database; fine for one student and one admin.
