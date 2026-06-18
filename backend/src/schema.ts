import type Database from 'better-sqlite3';

/**
 * Minimal idempotent migration. A real app grows this into a registry-driven,
 * one-file-per-migration system (see docs/ARCHITECTURE.md → "Schema"); the
 * template ships the smallest thing the seams attach to.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}
