import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { app } from './app';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
// src/index.ts (dev via tsx) and dist/index.js (built) both sit two levels
// above apps/web/dist.
const webDist = path.resolve(currentDir, '../../web/dist');

if (existsSync(webDist)) {
  // `@hono/node-server` serve-static resolves `root` relative to cwd, so derive
  // a cwd-relative path to the SPA build regardless of where the process starts.
  const root = path.relative(process.cwd(), webDist) || '.';
  // Serve built assets (JS/CSS/etc.) for any file that exists on disk...
  app.use('/*', serveStatic({ root }));
  // ...and fall back to index.html for client-side routes (e.g. /portal/:token).
  app.get('*', serveStatic({ path: path.join(root, 'index.html') }));
  console.log(`[api] serving SPA from ${webDist}`);
} else {
  console.log('[api] web build not found — API only (use the Vite dev server for the SPA)');
}

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
});
