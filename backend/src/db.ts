import Database from 'better-sqlite3';
import { DB_PATH } from './config.js';
import { runMigrations } from './schema.js';

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined;
  }
}

/**
 * @internal Test-only seam: inject a pre-migrated Database so route handlers use
 * the caller's in-memory DB instead of the file singleton. No runtime guard —
 * callers restrict use to tests. THIS is the seam the integration tier hangs on
 * (tests/integration/_helpers/test-app.ts). Do not add production callers.
 */
export function setDb(d: Database.Database): void {
  db = d;
}
