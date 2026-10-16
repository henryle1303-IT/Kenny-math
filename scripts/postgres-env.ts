/** Validate before any migration. Never include connection strings in errors. */
export function postgresEnvironment(env: Partial<NodeJS.ProcessEnv>) {
  const result = { ...env };
  // Neon Marketplace uses DATABASE_URL_UNPOOLED; also accept existing Prisma setups.
  result.DATABASE_URL_UNPOOLED ||= result.DIRECT_URL;
  const urls = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'].map((key) => {
    let url: URL;
    try {
      url = new URL(result[key] || '');
    } catch {
      throw new Error(`Set ${key} to the Neon PostgreSQL connection string before deploying.`);
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || url.pathname.length < 2) {
      throw new Error(`${key} must be a PostgreSQL URL with a user and database name.`);
    }
    if (url.hostname.endsWith('.neon.tech') && !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode') || '')) {
      throw new Error(`${key} must enable TLS with sslmode=require (or stronger).`);
    }
    return url;
  });
  if (urls[1].hostname.includes('-pooler.')) {
    throw new Error('DATABASE_URL_UNPOOLED must use the direct endpoint, without -pooler.');
  }
  if (urls[0].hostname.replace('-pooler.', '.') !== urls[1].hostname ||
      urls[0].pathname !== urls[1].pathname || urls[0].username !== urls[1].username ||
      (urls[0].searchParams.get('schema') || 'public') !== (urls[1].searchParams.get('schema') || 'public')) {
    throw new Error('DATABASE_URL and DATABASE_URL_UNPOOLED must point to the same database, schema and role.');
  }
  if (result.INSECURE_COOKIES === 'true' && result.VERCEL) {
    throw new Error('Remove INSECURE_COOKIES=true: Vercel requires secure admin cookies.');
  }
  return result;
}
