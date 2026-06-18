import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Node-environment tiers (unit + integration + arch). Runs on `cd backend &&
// vitest run`. The frontend tier owns frontend/vitest.config.ts (jsdom).
//
// server.deps.external keeps native/CJS modules (better-sqlite3) OUT of Vite's
// transform pipeline — without it, the integration tier fails to load the native
// binding. Add any other native dep to this list.
export default defineConfig({
  resolve: {
    alias: { '@shared': resolve(__dirname, '../shared') },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['../tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['../.worktrees/**', '../e2e/**', '**/node_modules/**', '**/dist/**'],
    server: {
      deps: {
        external: [/better-sqlite3/],
      },
    },
  },
});
