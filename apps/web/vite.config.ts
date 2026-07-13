import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // Workspace packages ship as TS source; let Vite transform them instead of
  // trying to pre-bundle them with esbuild.
  optimizeDeps: {
    exclude: ['@tl/shared', '@tl/api'],
  },
  server: {
    port: 5173,
    proxy: {
      // In dev the SPA is served by Vite; API calls are proxied to the Hono server.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
