import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  // Bundle the workspace package (it ships as TS source) into the output so the
  // compiled server has no runtime dependency on @tl/shared resolving to .ts.
  noExternal: ['@tl/shared'],
});
