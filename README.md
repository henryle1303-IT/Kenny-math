# 🧮 Kenny Math Challenge

An interactive Grade 5 maths platform:

* **30 official tests × 30 questions (900 questions)**, 30 minutes each, easy → advanced, automatic grading and step-by-step explanations.
* **Smart Review** – personalised 10-question practice built from Kenny's mistakes, adaptive difficulty, skill mastery and spaced review. No paid AI needed.
* **My Progress** – scores, topic accuracy, mastery, retake history.
* **Admin panel** (`/admin`) – generate, edit, validate, import/export (CSV), version, publish and roll back question banks.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind · Prisma + SQLite · KaTeX · Recharts · PapaParse · Zod · Vitest · Playwright.

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
5. **Settings** → spaced-review intervals, student name, admin password, activity log.

### CSV format

Required columns (in this order when exporting): `question_id, test_id, question_number, test_level, difficulty, topic, skill, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, common_mistake, learning_tip`. Optional: `bank_id, bank_version, verify_expr, validation_status`. Maths is written between `\(` and `\)` (KaTeX), e.g. `\(\frac{3}{4}\)`. Files are read as UTF-8 (with or without BOM), UTF-16, or Windows-1252; comma and semicolon delimiters are detected. `verify_expr` (e.g. `3/4+1/8`) lets the validator confirm the answer automatically; rows without it are checked structurally and flagged for manual review if the answer cannot be verified.

## Deployment

The app needs a Node.js server and a writable disk for the SQLite file.

**Docker (recommended)**

```bash
docker build -t kenny-math .
docker run -d --name kenny-math -p 3000:3000 \
  -v kenny-data:/data \
  -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='a-long-password' \
  kenny-math
```

Put it behind HTTPS (Caddy, nginx, Cloudflare Tunnel, or your platform's TLS). The container applies migrations and seeds on first start; later starts only run pending migrations. Back up the volume (`/data/kenny.db`).

**Render / Fly.io / Railway / a VPS:** use the Dockerfile or run `npm ci && npm run build && npm run db:setup && npm run start` with a persistent disk mounted where `DATABASE_URL` points. Serverless platforms with ephemeral file systems (Vercel, Netlify) are **not** suitable for SQLite – switch to PostgreSQL first (below).

**Moving to PostgreSQL later:** in `prisma/schema.prisma` change `provider` to `postgresql`, set `DATABASE_URL` to your Postgres URL, delete `prisma/migrations`, run `npx prisma migrate dev --name init` once against an empty database, then `npm run db:seed`. The schema uses no SQLite-only features.

## Security notes

Password hashes (bcrypt), server-side sessions with hashed tokens, HttpOnly/SameSite cookies, server-side authorisation on every admin API route, origin check on writes, login rate limiting, 5 MB upload limit, CSV formula neutralisation on export, audit log. No stack traces are shown to students; API errors are friendly messages. Change the seeded admin password in *Settings* after first sign-in.

## Project documents

* [PLAN.md](PLAN.md) – architecture and design decisions
* [QA_REPORT.md](QA_REPORT.md) – what was actually tested, results, known issues
