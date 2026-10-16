// Prepares a fresh database for the Playwright run (migrations + seed).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const db = path.resolve(__dirname, '../prisma/e2e.db');
for (const f of [db, `${db}-journal`]) if (fs.existsSync(f)) fs.rmSync(f);
// SQLite accepts an empty file; pre-create it for Prisma on Windows.
fs.closeSync(fs.openSync(db, 'wx'));
const env = { ...process.env, DATABASE_URL: `file:${db}`, ADMIN_EMAIL: 'e2e-admin@example.com', ADMIN_PASSWORD: 'e2e-password-123' };
execSync('npx prisma migrate deploy', { env, stdio: 'inherit' });
execSync('npx tsx prisma/seed.ts', { env, stdio: 'inherit' });
