import { defineConfig } from 'vitest/config';

// Node-environment tiers (unit + integration + arch). Runs on `cd backend &&
// vitest run`. The frontend tier owns frontend/vitest.config.ts (jsdom).
//
// server.deps.external keeps native/CJS modules (better-sqlite3) OUT of Vite's
// transform pipeline — without it, the integration tier fails to load the native
// binding. Add any other native dep to this list.
//
// test.env pins the config-read variables so the suite is green regardless of
// the developer's shell exports — an ambient LOG_LEVEL=debug or PORT=abc must
// not turn a fresh clone red (config.ts process.exit()s on invalid values at
// import time, which would otherwise kill whole test files).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['../tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['../.worktrees/**', '../e2e/**', '**/node_modules/**', '**/dist/**'],
    env: {
      PORT: '8137',
      HOST: '127.0.0.1',
      DB_PATH: ':memory:',
      LOG_LEVEL: 'info',
    },
    server: {
      deps: {
        external: [/better-sqlite3/],
      },
    },
  },
});
