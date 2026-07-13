import { hc } from 'hono/client';
import type { AppType } from '@tl/api';

/**
 * Typed Hono RPC client. Uses a relative base URL so the same code works in dev
 * (Vite proxies `/api` to the Hono server) and in prod (Hono serves both the SPA
 * and the API from one origin). Call routes as `client.api.health.$get()`.
 */
export const client = hc<AppType>('/');
