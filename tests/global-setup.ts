import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default function setup() {
  const db = path.resolve(import.meta.dirname, '../prisma/test.db');
  for (const f of [db, `${db}-journal`]) if (fs.existsSync(f)) fs.rmSync(f);
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: `file:${db}` }, stdio: 'pipe' });
}
