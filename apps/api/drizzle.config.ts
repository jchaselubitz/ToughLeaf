import { defineConfig } from 'drizzle-kit';
import { getDatabaseUrl } from './src/db/env';

/**
 * drizzle-kit config: generates SQL migrations from `src/db/schema.ts` into
 * `drizzle/`, and powers `drizzle-kit studio`. DATABASE_URL is loaded from the
 * repo-root `.env` by `src/db/env.ts`.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: getDatabaseUrl() },
  casing: 'snake_case',
});
