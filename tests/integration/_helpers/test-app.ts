import Database from 'better-sqlite3';
import type { Database as BSQLite } from 'better-sqlite3';
import { serve } from '@hono/node-server';
import type { Hono } from 'hono';
import { buildApp } from '../../../backend/src/index.js';
import { setDb } from '../../../backend/src/db.js';
import { runMigrations } from '../../../backend/src/schema.js';

/**
 * The integration harness. Builds the REAL app via buildApp(), injects an
 * in-memory DB via setDb() (never touches the file DB), binds a random port.
 * Tests hit it over real HTTP with fetch(). Catches route/schema/wiring bugs the
 * unit tier can't; misses real subprocess + real DB-file migrations (see TESTING.md).
 */
export interface TestAppHarness {
  app: Hono;
  db: BSQLite;
  baseUrl: string;
  cleanup: () => Promise<void>;
}

export async function createTestApp(): Promise<TestAppHarness> {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  setDb(db);

  const app = buildApp();
  const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });

  await new Promise<void>((resolve, reject) => {
    if (server.listening) {
      resolve();
      return;
    }
    server.once('listening', () => resolve());
    server.once('error', reject);
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('test-app: unexpected socket address shape');
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    app,
    db,
    baseUrl,
    cleanup: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }).then(() => {
        db.close();
      }),
  };
}
