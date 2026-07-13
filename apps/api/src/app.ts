import { Hono } from 'hono';

/**
 * The Hono application. Routes are declared under `/api/*` and chained so the
 * inferred type powers the typed RPC client in the web app (`hc<AppType>`).
 *
 * Server concerns (node-server, static SPA serving) live in `index.ts` and are
 * intentionally kept out of this module so the web app can `import type` from
 * here without pulling Node-only code into its build.
 */
const app = new Hono().get('/api/health', (c) =>
  c.json({
    status: 'ok' as const,
    service: 'tl-api',
    time: new Date().toISOString(),
  }),
);

export type AppType = typeof app;
export { app };
