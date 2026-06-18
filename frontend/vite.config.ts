import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// The @shared alias must be declared in THREE places that resolve modules:
//   1. here (vite — dev server + bundler)
//   2. frontend/vitest.config.ts (the test runner)
//   3. frontend/tsconfig.json paths (the type-checker)
// Miss one and imports resolve in some contexts but silently break in others.
// (CLAUDE.md → "Shared contracts" gotcha.)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8137' },
  },
  preview: {
    port: 4173,
    proxy: { '/api': 'http://127.0.0.1:8137' },
  },
});
