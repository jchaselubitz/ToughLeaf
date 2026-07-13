import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

/**
 * Load the repo-root `.env` for local tooling (drizzle-kit, migrate, seed) and
 * dev. In production (Railway) the file is absent and real env vars are used —
 * dotenv silently no-ops when the path does not exist, so this is safe there.
 */
const currentDir = path.dirname(fileURLToPath(import.meta.url));
// src/db/env.ts (run via tsx) sits three levels below the repo root.
config({ path: path.resolve(currentDir, '../../../../.env') });

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
