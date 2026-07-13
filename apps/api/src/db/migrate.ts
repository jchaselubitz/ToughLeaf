import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getDatabaseUrl } from './env';

/**
 * Apply all generated drizzle-kit migrations from `apps/api/drizzle`. Run with
 * `yarn db:migrate`. Uses a dedicated single-connection client that is closed
 * when migration finishes.
 */
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(currentDir, '../../drizzle');

async function main() {
  const client = postgres(getDatabaseUrl(), { max: 1 });
  try {
    console.log('[db] running migrations…');
    await migrate(drizzle(client), { migrationsFolder });
    console.log('[db] migrations applied');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db] migration failed:', err);
  process.exit(1);
});
