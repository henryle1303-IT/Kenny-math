# Multi-user implementation and verification

Date: 17 October 2026 (Asia/Saigon).

Update: production deployment and subsequent admin fixes are complete. See [admin-functional-report.md](admin-functional-report.md) for current release status (116 tests, 19 E2E passed). The results below describe the earlier implementation verification.

## Implemented

- Student username/password sign-in, sign-out, personal password change, hashed session tokens and server-side ownership checks on tests, answers, results and practice.
- Independent profile, language, learning intervals, password, active status and assigned question bank per student.
- Admin User Profiles: account creation, profile editing, password reset, bank assignment, individual progress, backup/export/restore/clear and scoped audit records.
- Private CSV imports bound to the selected student from analysis through commit. Publishing/activating a private bank assigns only its owner; cloning retains ownership. Shared default changes preserve explicit user assignments.
- Names in student home/navigation, review, results, account labels and document titles use the authenticated display name. Vietnamese home/navigation/title also use that name. Sign-in/sign-out use full navigation to discard the previous account's client page state.
- SQLite and PostgreSQL schema/migrations, legacy learning-setting snapshots, and repeatable initialization for Kenny, Henry, Xoai and Moon. Existing student IDs, history, changed usernames/passwords, settings and assignments are retained.

## Validation results

| Check | Result |
|---|---|
| Full Vitest suite | 13 files, 109 tests passed |
| Focused multi-user suite after final seed adjustment | 5 tests passed |
| TypeScript | `tsc --noEmit` passed |
| ESLint | No warnings/errors; production build lint also passed |
| Production build | Passed with `NEXT_DIST_DIR=.next-multiuser` |
| Playwright, desktop Chrome | All 10 tests passed |
| Legacy SQLite migration replay | Existing Kenny identity, name, language, bank, attempt/timer and configuration preserved; foreign-key checks passed |
| PostgreSQL | Prisma schema validation and SQLite/PostgreSQL model parity passed; migration SQL generated |
| Local initial bank | All 900 question texts match `exports/kenny-math-bank-v1.csv` |

E2E covers the existing complete test/review/progress workflow, CSV import/export/publish/rollback, admin progress reset, four student logins, cross-user API rejection, display-name and Vietnamese title changes, password reset/session revocation, personal password change, private import/publish/assignment and mobile overflow checks.

Integration coverage also checks invalid/expired/disabled sessions, rate limiting, cross-site writes, independent settings, idempotent account initialization (including a renamed username), cross-user backup rejection and restore, historical timers surviving bank changes, ownership retained on private clones and rejection of another user's private source bank.

Student mobile and admin profile screenshots were inspected. New runs save these generated images under Playwright `test-results/` via `testInfo.outputPath`; images are not committed. Earlier screenshots remain available in Git history.

## Local accounts and deployment boundary

Initialized the separate local SQLite database at `prisma/dev.db` with `kenny`, `henry`, `xoai`, `moon`, initial passwords `123`, four distinct password hashes and one shared 900-question bank. The new local database starts with empty progress. No existing local `dev.db` was present before initialization. Local setup output is in ignored `data/local-setup.log`.

The migration preserves legacy history when applied to an existing database; this was verified on a legacy SQLite fixture. Local initialization is not a copy of production history. Remote databases, production users and deployments were not changed. PostgreSQL migrations have not been executed against a remote database in this task. Before deployment, take the normal database backup, then use the existing PostgreSQL migration/seed/build flow against the intended environment.

The optional static browser demo remains a separate single-browser demo; authenticated multi-user behavior is implemented in the full Next.js application.
