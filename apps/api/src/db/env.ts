import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

/**
 * Load the repo-root `.env` for local tooling (drizzle-kit, migrate, seed) and
 * dev. In production (Railway) the file is absent and real env vars are used —
 * dotenv silently no-ops when the path does not exist, so this is safe there.
 */
const currentDir = path.dirname(fileURLToPath(import.meta.url));
// Source tooling runs from src/db (four parents from root); the production
// bundle runs from dist (three parents). This keeps `yarn start` usable with
// the same local .env while Railway continues to provide real environment vars.
const envPath = [
  path.resolve(currentDir, '../../../../.env'),
  path.resolve(currentDir, '../../../.env'),
].find(existsSync);
if (envPath) config({ path: envPath });

/** Resolve DATABASE_URL, throwing a clear error when it is missing. */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env (or start the local ' +
        'Postgres via `yarn db:up`) before running database commands.',
    );
  }
  return url;
}
