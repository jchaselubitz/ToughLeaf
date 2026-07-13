import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from './env';
import * as schema from './schema';

/**
 * The shared Postgres pool and Drizzle client for the API. Import `db` for
 * queries (relational API available via the bound `schema`). The connection is
 * created lazily so importing this module never opens a socket by itself.
 */
const queryClient = postgres(getDatabaseUrl());

export const db = drizzle(queryClient, { schema });
export { schema };
