# 🧮 Kenny Math Challenge

An interactive Grade 5 maths platform:

* **30 official tests × 30 questions (900 questions)**, 30 minutes each, easy → advanced, automatic grading and step-by-step explanations.
* **Smart Review** – personalised 10-question practice built from Kenny's mistakes, adaptive difficulty, skill mastery and spaced review. No paid AI needed.
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
| `npm run qa:report` | validates the reference bank and writes `qa/content-report.md` |

The ready-made 900-question file is in [`exports/kenny-math-bank-v1.csv`](exports/kenny-math-bank-v1.csv); it can be imported again through **Admin → Import / Export**.

## Using the app

**Kenny:** Home → *Math Tests* → Start. Answers are saved on every click; refreshing or closing the tab never resets the timer (the expiry time is stored on the server) and the test is submitted automatically when time is up. After submitting: score, topic chart, comparison with earlier attempts, and a full review with explanations and *Try a Similar Question*. *Smart Review → Practice My Mistakes* gives ten new questions on weak skills (untimed).

**Administrator:**

1. **Question Generator** → *Generate 900 Questions* (progress bar; creates a *draft* bank and validates it).
2. **Question Manager** → search/filter, preview, edit, duplicate, regenerate, delete (drafts only), *Mark reviewed* for flagged questions.
3. **Bank Versions** → *Validate*, *Publish / Activate* (explicit confirmation; flagged questions must be acknowledged). Published banks are read-only – use *Create draft copy* to change them. *Restore / Activate* rolls back to an older published bank. Tests Kenny already started keep their original questions.
4. **Import / Export** → export a whole bank, one test or a range; import a CSV as a new draft bank (A), replace the active bank after typing `REPLACE` (B), or update selected questions by `question_id` (C). The validation report can be downloaded as an error CSV. *Download CSV Template* gives headers, field descriptions and three example rows (ignored unless “include example rows” is ticked).

   New-bank imports (A/B) require 900 questions arranged as 30 tests × 30 questions. For a smaller CSV, use update-selected mode (C) with IDs from an existing bank. Changing the file, import mode, base bank or example-row option requires uploading and validating again before saving.
5. **Settings** → spaced-review intervals, student name, admin password, activity log.
6. **Student Progress → Clear progress** → type `CLEAR` to delete test attempts (including unfinished ones), saved answers, practice sessions, skill mastery and review schedules. Question banks, student settings and admin accounts are kept. The action is recorded in the activity log.

### CSV format

Required columns (in this order when exporting): `question_id, test_id, question_number, test_level, difficulty, topic, skill, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, common_mistake, learning_tip`. Optional: `bank_id, bank_version, verify_expr, validation_status`. Maths is written between `\(` and `\)` (KaTeX), e.g. `\(\frac{3}{4}\)`. Files are read as UTF-8 (with or without BOM), UTF-16, or Windows-1252; comma and semicolon delimiters are detected. `verify_expr` (e.g. `3/4+1/8`) lets the validator confirm the answer automatically; rows without it are checked structurally and flagged for manual review if the answer cannot be verified.

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

Password hashes (bcrypt), server-side sessions with hashed tokens, HttpOnly/SameSite cookies, server-side authorisation on every admin API route, origin check on writes, login rate limiting, 5 MB upload limit, CSV formula neutralisation on export, audit log. No stack traces are shown to students; API errors are friendly messages. Change the seeded admin password in *Settings* after first sign-in.

## Project documents

* [PLAN.md](PLAN.md) – architecture and design decisions
* [QA_REPORT.md](QA_REPORT.md) – what was actually tested, results, known issues
