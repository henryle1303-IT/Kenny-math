# 🧮 Kenny Math Challenge

An interactive Grade 5 maths platform:

* **30 official tests × 30 questions (900 questions)**, 30 minutes each, easy → advanced, automatic grading and step-by-step explanations.
* **Smart Review** – personalised 10-question practice built from Kenny's mistakes, adaptive difficulty, skill mastery and spaced review. No paid AI needed.
* **XP and rewards** – XP for correct answers, levels, a daily streak with shields, two small daily quests plus a weekly challenge, badges, stars by topic, and an optional reward shop that parents control. Progress is compared only with the student's own earlier weeks; there is no leaderboard.
* **My Progress** – scores, topic accuracy, mastery, retake history.
* **Admin panel** (`/admin`) – generate, edit, validate, import/export (CSV), version, publish and roll back question banks.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind · Prisma + Neon PostgreSQL (Vercel) / SQLite (local) · KaTeX · Recharts · PapaParse · Zod · Vitest · Playwright.

## Deploy to Vercel with Neon PostgreSQL

`vercel.json` deploys the full Next.js application, including authenticated admin, shared question banks, server-side grading and persistent progress.

1. In the Vercel project **kenny-math**, connect Neon from **Storage / Marketplace**. Choose a nearby region and the free plan if suitable for this demo. Use a separate Neon branch for preview deployments; do not point preview and production at the same writable database.
2. Add the variables below to the intended Vercel environment. The Neon integration can populate the database URLs automatically. Keep real passwords and URLs out of Git and chat.
3. Verify repository root directory, production branch `main`, framework **Next.js**, install command `npm ci --ignore-scripts`, build command `npm run build:vercel`, output directory `.next`. Remove any dashboard overrides left over from the static demo (`demo-dist` / `build:demo`).
4. Deploy. The build validates configuration, generates the PostgreSQL Prisma client, applies committed migrations, seeds an empty database, then builds Next.js. Seeding creates Kenny, the initial admin and a published bank of 900 questions. It preserves existing accounts, passwords, banks and progress on later builds.
5. Check `/`, `/tests`, `/admin/login`, admin sign-in, saving an answer after refresh, grading, and CSV export/import on the deployed URL. A successful local SQLite test alone does not verify the Neon deployment.

| Vercel variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled PostgreSQL URL (`-pooler` hostname), with `sslmode=require`; recommended query parameters: `connect_timeout=15&connection_limit=3&pool_timeout=15` |
| `DATABASE_URL_UNPOOLED` | Direct URL for the **same database and role**, without `-pooler`, with `sslmode=require`; `DIRECT_URL` is accepted as an alias by the setup script |
| `ADMIN_EMAIL` | Initial admin email |
| `ADMIN_PASSWORD` | Initial password, at least 12 characters; required for the first production seed |
| `INSECURE_COOKIES` | `false` (or omit) |

PostgreSQL has its own schema and migration history under `prisma/postgres/`. The original SQLite schema, migrations and local `prisma/dev.db` are preserved. Deploying starts with a fresh Neon database; it does **not** copy local attempts or custom banks. Export custom banks as CSV and import them through Admin if needed. Existing admin passwords are changed in Admin Settings, not by changing seed variables.

For an explicit local PostgreSQL session, copy `.env.postgres.example` to ignored `.env.local`, fill the URLs and admin credentials, then run:

```bash
npm run db:setup:postgres     # explicit remote migration + initial seed
npm run dev:postgres         # generates PostgreSQL client and starts Next.js; no migrations
npm run build:vercel         # migration + seed + production build
```

Stop any running local server before switching Prisma providers on Windows. To return to SQLite, remove `.env.local`, run `npx prisma generate`, then `npm run dev`. The default `npm test` suite uses a disposable SQLite database and needs the SQLite client. `npm run test:deploy` also checks the deployment configuration and schema parity; it does not contact Neon.

To run the full browser suite against Neon, use a disposable **preview branch**. Set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to that branch, seed with `ADMIN_EMAIL=e2e-admin@example.com` / `ADMIN_PASSWORD=e2e-password-123`, and run `npm run build:vercel`. Then set `POSTGRES_TEST_DATABASE_URL` to that preview pooled URL and run `npm run test:e2e:postgres`. This suite edits banks and clears student progress in the supplied test database; it does not create or reset a database automatically. It starts the production server on port 3210. Use the same `NEXT_DIST_DIR` for build and test if overriding the build directory.

## XP and rewards

* Rules live in `src/lib/xp/rules.ts` (pure, unit-tested) and the award logic in `src/lib/services/xp.ts`. XP is added on the server right after a test is graded or a Smart Review answer is saved, with unique ledger keys so nothing is paid twice. A problem while awarding XP never loses a submitted test.
* Defaults: 10 XP per correct answer (+5 the first time a question is seen, half for repeats), +20 for finishing a test (+50 for 30/30), +15 for finishing a Smart Review, +15 for fixing an old mistake. Reaching 5 correct answers in a day keeps the streak; every 7 streak days earn a shield (max 2) that covers a missed day. Days are counted in Vietnam time (Asia/Ho_Chi_Minh). Admin > XP & Rewards changes the numbers, switches features on or off, and manages parent-set rewards and requests; Admin > User Profiles can give, take, rebuild or reset one user's XP.
* All XP text follows the existing EN/VI language button (dictionary `xt()` in `src/lib/i18n.ts`).
* The XP tables are added by the PostgreSQL migration `prisma/postgres/migrations/20261018000100_xp_rewards`. There is intentionally no SQLite migration: the disposable SQLite databases used by the tests (`tests/global-setup.ts`, `scripts/e2e-prepare.ts`) get the tables with `prisma db push`.
* Existing history is worth XP: the first time a student's XP is needed after deployment (any student page loads the nav chip), their finished tests and Smart Review sessions are converted to XP (10 per correct answer, 20 per finished test, 50 per 30/30, 15 per finished Smart Review) and the streak is rebuilt from the days with 5+ correct answers. The conversion is idempotent. Preview it with `npm run xp:backfill` (dry run) or create the profiles ahead of time with `npm run xp:backfill -- --apply`.
* Clearing a student's progress also removes their XP; restoring a progress backup rebuilds XP from the restored history (shop spending is not part of backups).

## Optional browser demo (no database)

The optional static browser demo requires no `DATABASE_URL`, admin password, Prisma migration or database service. It includes the 900-question bank, timed tests, grading/explanations, practice, browser progress, CSV import/export, draft activation and clear progress. The **Admin demo** is open without sign-in and only changes data in the current browser. Practice selects questions from the local bank; it does not run the full server-side adaptive engine. Clearing browser storage resets this demo.

```bash
npm ci --ignore-scripts
npm run build:demo
npm run preview:demo         # http://127.0.0.1:3211
npm run test:demo            # install Playwright Chromium or set PW_CHROMIUM first
```

Set `DEMO_BASE_URL` to the public demo URL to run the same browser tests against a deployment instead of starting a local server.

`npm run preview:demo` serves local deep links. The checked-in Vercel configuration now targets the full PostgreSQL application described above.

## Quick start (local)

Requirements: Node.js 20+ (tested on 22) and npm.

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # edit ADMIN_EMAIL / ADMIN_PASSWORD
npm run db:setup            # applies migrations, creates Kenny + admin, generates & publishes the first 900-question bank
npm run dev                 # http://localhost:3000
```

* Student site: <http://localhost:3000>
* Admin: <http://localhost:3000/admin> (sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`; if `ADMIN_PASSWORD` was empty a random one was printed by `db:setup`).

Production build: `npm run build && npm run start`.

For browser tests, run `npx playwright install chromium` once, then `npm run build` and `npm run test:e2e`. Set `PW_CHROMIUM` to an existing Chrome/Chromium executable to use that browser instead. Stop the development server before building on Windows so Prisma's native library is not locked.

To test while the development server is running, set `NEXT_DIST_DIR=.next-e2e`, run `npx next build` (the Prisma client must already be generated), then `npm run test:e2e` in the same shell. This keeps the test build separate from the development files. Clear `NEXT_DIST_DIR` afterwards to return to the default build directory.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file, e.g. `file:./dev.db` (relative to `prisma/`) or `file:/data/kenny.db` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | used **only** by the seed script when no admin exists yet |
| `INSECURE_COOKIES` | set `true` only if you serve the admin over plain HTTP outside localhost (otherwise the cookie is `Secure` in production) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | development, production build, production server |
| `npm run typecheck`, `npm run lint` | TypeScript and ESLint |
| `npm test` | all Vitest tests (unit + integration, temporary SQLite DB) |
| `npm run test:unit` / `test:integration` | one layer only |
| `npm run test:e2e` | Playwright end-to-end tests (builds nothing – run `npm run build` first) |
| `npm run db:migrate` / `db:seed` / `db:setup` | migrations / seed / both |
| `npm run bank:export` | writes the reference bank to `exports/kenny-math-bank-v1.csv` |
| `npm run demo:seed` | creates (or refreshes) the demo user `demo` / password `123` and the private bank "Demo - all question types" (see below) |
| `npm run qa:report` | validates the reference bank and writes `qa/content-report.md` |

The ready-made 900-question file is in [`exports/kenny-math-bank-v1.csv`](exports/kenny-math-bank-v1.csv); it can be imported again through **Admin → Import / Export**.

## Student accounts and User Profiles

Students sign in at `/login` using a username and password. The first migration/seed initializes `kenny`, `henry`, `xoai`, and `moon`, each with initial password `123` and the existing active shared question bank. Kenny keeps the same student ID and history; the other new users begin with empty progress. Later seeds never reset passwords, profile settings, bank assignments or progress.

The student interface, navigation, review feedback and page title use the signed-in student's display name (including Vietnamese labels). Admin changes to the display name appear on the next page load; changing a display name does not change the login username. Students can change their own password in the account page. Password changes and admin resets invalidate all existing student sessions.

**Admin → User Profiles** lists accounts, status, assigned banks and last study activity. Select a user to edit their profile/language, learning intervals, password, question bank and progress. Learning settings are independent snapshots: changing defaults in Settings affects new users; changing a user's intervals applies to their next skill update. Admin passwords remain separate.

Import inside a user profile creates a **private bank for that user**, using the existing CSV validation and draft workflow. Publish it in Bank Versions to assign it to that user only. Import from the general Import / Export page creates a shared bank. Shared-bank activation changes the default for unassigned users; existing explicit assignments stay unchanged. Select a different published shared/owned bank in a user profile to change that user's new tests. In-flight tests keep their original questions and expiry. Private banks cannot be assigned to other users, and private copies retain their owner.

Progress backup, export, restore and clear operate on the selected user. Restore rejects files from another student and checks original bank/question references. Existing version-1 Kenny backup files remain supported for Kenny. Student APIs derive identity from the server session and check ownership of tests, answers, results and review sessions.

For an existing installation, back up the database before applying migrations. Both SQLite and PostgreSQL migration histories include the upgrade. Run the normal migration + seed flow (`npm run db:setup` locally or `npm run build:vercel` for the configured PostgreSQL deployment). Seeding requires an active published shared bank when banks already exist; it reports the missing bank rather than replacing existing content. Production deployment and remote database migration are separate from local validation.

## Using the app

**Student:** Sign in → Home → *Math Tests* → Start. Answers are saved on every click; refreshing or closing the tab never resets the timer (the expiry time is stored on the server) and the test is submitted automatically when time is up. After submitting: score, topic chart, comparison with earlier attempts, and a full review with explanations and *Try a Similar Question*. *Smart Review → Practice My Mistakes* gives ten new questions on weak skills (untimed).

**Administrator:**

1. **Question Generator** → *Generate 900 Questions* (progress bar; creates a *draft* bank and validates it).
2. **Question Manager** → search/filter, preview, edit, duplicate, regenerate, delete (drafts only), *Mark reviewed* for flagged questions.
3. **Bank Versions** → *Validate*, *Publish / Activate* (explicit confirmation; flagged questions must be acknowledged). Published banks are read-only – use *Create draft copy* to change them. *Restore / Activate* rolls back to an older published bank. Tests students already started keep their original questions.
4. **Import / Export** → export a whole bank, one test or a range; import a CSV as a new draft bank (A), replace the active bank after typing `REPLACE` (B), or update selected questions by `question_id` (C). The validation report can be downloaded as an error CSV. *Download CSV Template* gives headers, field descriptions and three example rows (ignored unless “include example rows” is ticked).

   New-bank imports (A/B) require 900 questions arranged as 30 tests × 30 questions. For a smaller CSV, use update-selected mode (C) with IDs from an existing bank. Changing the file, import mode, base bank or example-row option requires uploading and validating again before saving.
5. **Settings** → default spaced-review intervals for new users, admin password, activity log. Use **User Profiles** for individual names, settings, passwords and progress.
6. **User Profiles → select user → Clear progress** → type `CLEAR` to delete test attempts (including unfinished ones), saved answers, practice sessions, skill mastery and review schedules. Question banks, student settings and admin accounts are kept. The action is recorded in the activity log.

7. **User Profiles → select user → Save, export & import progress**: answers continue to save automatically. **Save progress** stores one backup in the database (replacing the previous saved backup); **Export progress** downloads a versioned JSON file with all attempts, answers, Smart Review questions, skill events, mastery and review schedules. **Download saved backup** downloads the last database snapshot. To restore, select an exported JSON file (up to 4 MB), review its counts, type `RESTORE`, then choose **Import & replace progress**. Restore replaces the current student's history atomically and first saves the previous history as the database backup. Download that backup and import it to undo a restore. Original timers are preserved, so expired attempts remain expired. The exact original question banks and question IDs must exist unchanged in the destination database; progress files do not transfer question banks or student/admin settings. All backup operations require administrator access and are audited.

### CSV format

Required columns (in this order when exporting): `question_id, test_id, question_number, test_level, difficulty, topic, skill, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, common_mistake, learning_tip`. Optional: `bank_id, bank_version, verify_expr, validation_status, question_type, answer_data`. Maths is written between `\(` and `\)` (KaTeX), e.g. `\(\frac{3}{4}\)`. Files are read as UTF-8 (with or without BOM), UTF-16, or Windows-1252; comma and semicolon delimiters are detected. `verify_expr` (e.g. `3/4+1/8`) lets the validator confirm the answer automatically; rows without it are checked structurally and flagged for manual review if the answer cannot be verified.

## Deployment

Use Neon PostgreSQL for Vercel as described above. The following alternatives use SQLite and need a writable persistent disk.

**Docker (recommended)**

```bash
docker build -t kenny-math .
docker run -d --name kenny-math -p 3000:3000 \
  -v kenny-data:/data \
  -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='a-long-password' \
  kenny-math
```

Put it behind HTTPS (Caddy, nginx, Cloudflare Tunnel, or your platform's TLS). The container applies migrations and seeds on first start; later starts only run pending migrations. Back up the volume (`/data/kenny.db`).

**Render / Fly.io / Railway / a VPS:** use the Dockerfile or run `npm ci && npm run build && npm run db:setup && npm run start` with a persistent disk mounted where `DATABASE_URL` points. Do not delete the SQLite migrations when deploying PostgreSQL; use `npm run build:vercel` with the separate PostgreSQL history instead.

## Security notes

Password hashes (bcrypt), server-side sessions with hashed tokens, HttpOnly/SameSite cookies, server-side authorisation on every admin API route, origin check on writes, login rate limiting, 4 MB upload limit, CSV formula neutralisation on export, audit log. No stack traces are shown to students; API errors are friendly messages. Change the seeded admin password in *Settings* after first sign-in.

### Question types

Besides 4-option multiple choice (`MCQ`, the default), a question can be `NUMERIC_INPUT`, `TRUE_FALSE`, `MULTI_SELECT`, `FILL_BLANK`, `ORDERING` or `SHORT_TEXT`. Set `question_type`, leave `option_a`-`option_d` and `correct_answer` empty, and put the setup in `answer_data` (JSON). Old files without these two columns are read as multiple choice.

| `question_type` | `answer_data` | Student sees | Right when |
|---|---|---|---|
| `NUMERIC_INPUT` | `{"accepted":["3/4","0.75"],"unit":"cm","tolerance":0,"requireSimplified":false}` | a text box | the number has the same value (3/4, 0.75, .75, 0,75 and 6/8 all match; `requireSimplified` rejects 6/8) |
| `TRUE_FALSE` | `{"statements":[{"text":"...","truth":true}]}` | True/False per statement | every statement is right |
| `MULTI_SELECT` | `{"options":["2","3","4"],"correct":[0,2]}` (0-based) | check boxes | exactly the right set is ticked |
| `FILL_BLANK` | `{"blanks":[{"accepted":["1/4"]},{"accepted":["10"]}]}` and `{1}`, `{2}` in `question_text` | one box per blank | every blank is right (numbers by value, text ignoring capital letters) |
| `ORDERING` | `{"items":["0.2","0.25","0.3"]}` listed in the **correct** order | items shown shuffled, moved with arrows | the order is exactly right |
| `SHORT_TEXT` | `{"accepted":["square"],"caseSensitive":false,"ignoreDiacritics":false}` | a text box | the text matches an accepted answer |

Typed text ignores capital letters and extra spaces, and Unicode forms of accents are normalised. Vietnamese accents must match unless the question sets `ignoreDiacritics` (or lists the unaccented spelling). Each question is still worth one point and is right or wrong as a whole, so XP, stars and skills work unchanged. The server never sends the accepted answers to the browser while a test is open. The logic for every type lives in `src/lib/question-types`.

Limits of this first version: the generator still produces multiple choice only; Smart Review and "Try a Similar Question" stay multiple choice; the static browser demo is multiple choice only; typed questions are added by CSV import (or by editing the answer setup of an existing typed question in Admin > Questions).

### Demo user and demo bank

`npm run demo:seed` creates the student **demo** (password **123**, Vietnamese by default) with a private published bank of 18 hand-written questions in tests 1, 11 and 21, covering all seven types. It can be run again at any time: it keeps a changed password unless you run `npm run demo:seed -- --reset-password` (use this if `demo` / `123` is rejected), and it does not touch other users or the shared bank. The password is deliberately weak, so the script is **not** run by `db:setup` or by the Vercel build. Remove the demo user in Admin > User Profiles before real use. The bank is intentionally not a complete 30 x 30 bank, so running "Validate" on it in Admin reports the missing tests; it is already published and does not need that step.

## Project documents

* [PLAN.md](PLAN.md) – architecture and design decisions
* [QA_REPORT.md](QA_REPORT.md) – what was actually tested, results, known issues
