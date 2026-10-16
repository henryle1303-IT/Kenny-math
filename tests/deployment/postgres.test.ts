import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { postgresEnvironment } from '../../scripts/postgres-env';

const pooled = 'postgresql://test:secret@ep-test-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const direct = pooled.replace('-pooler.', '.');
const env = { DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct };

describe('PostgreSQL deployment safeguards', () => {
  it('accepts the Neon URLs and DIRECT_URL alias without changing the input', () => {
    expect(postgresEnvironment(env)).toEqual(env);
    expect(postgresEnvironment({ DATABASE_URL: pooled, DIRECT_URL: direct }).DATABASE_URL_UNPOOLED).toBe(direct);
    expect(env).toEqual({ DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct });
  });
  it.each([
    {}, { DATABASE_URL: 'file:./dev.db' },
    { ...env, DATABASE_URL_UNPOOLED: pooled },
    { ...env, DATABASE_URL_UNPOOLED: direct.replace('neondb', 'other') },
    { ...env, DATABASE_URL_UNPOOLED: direct + '&schema=other' },
    { ...env, DATABASE_URL: pooled.replace('?sslmode=require', '') },
    { ...env, VERCEL: '1', INSECURE_COOKIES: 'true' },
  ])('rejects invalid configuration without exposing passwords: %s', (input) => {
    expect(() => postgresEnvironment(input)).toThrow();
    try { postgresEnvironment(input); } catch (error) {
      expect((error as Error).message).not.toContain('secret');
    }
  });
  it('keeps SQLite and PostgreSQL models identical', () => {
    const models = (file: string) => {
      const schema = fs.readFileSync(file, 'utf8');
      return schema.slice(schema.indexOf('model Student')).trim();
    };
    expect(models('prisma/postgres/schema.prisma')).toBe(models('prisma/schema.prisma'));
  });
});
