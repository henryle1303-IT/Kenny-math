import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { postgresEnvironment } from './postgres-env';

const mode = process.argv[2];
if (!['build', 'setup', 'dev'].includes(mode)) {
  console.error('Usage: tsx scripts/postgres.ts build|setup|dev');
  process.exit(1);
}
try {
  loadEnvConfig(process.cwd(), mode === 'dev');
  const env: NodeJS.ProcessEnv = {
    ...postgresEnvironment(process.env),
    NODE_ENV: mode === 'dev' ? 'development' : 'production',
  };
  const schema = 'prisma/postgres/schema.prisma';
  function run(entry: string, args: string[]) {
    const result = spawnSync(process.execPath, [path.resolve('node_modules', entry), ...args], { env, stdio: 'inherit' });
    if (result.error) throw new Error(`Unable to run ${entry}.`);
    if (result.status !== 0) process.exit(result.status || 1);
  }
  run('prisma/build/index.js', ['generate', '--schema', schema]);
  // Setup is explicit. `dev:postgres` cannot migrate or seed a remote database.
  if (mode !== 'dev') {
    run('prisma/build/index.js', ['migrate', 'deploy', '--schema', schema]);
    run('tsx/dist/cli.mjs', ['prisma/seed.ts']);
  }
  if (mode === 'build') run('next/dist/bin/next', ['build']);
  if (mode === 'dev') run('next/dist/bin/next', ['dev']);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'PostgreSQL setup failed.');
  process.exit(1);
}
