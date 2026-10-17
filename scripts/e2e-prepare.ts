// Prepares a fresh database for the Playwright run (migrations + seed).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const db = path.resolve(__dirname, '../prisma/e2e.db');
for (const f of [db, `${db}-journal`]) if (fs.existsSync(f)) fs.rmSync(f);
// SQLite accepts an empty file; pre-create it for Prisma on Windows.
fs.closeSync(fs.openSync(db, 'wx'));
const env = { ...process.env, DATABASE_URL: `file:${db}`, ADMIN_EMAIL: 'e2e-admin@example.com', ADMIN_PASSWORD: 'e2e-password-123' };
execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env, stdio: 'inherit' });
execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'], { env, stdio: 'inherit' });
execFileSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), 'prisma/seed.ts'], { env, stdio: 'inherit' });
