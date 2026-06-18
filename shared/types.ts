/**
 * Shared cross-boundary types — the single source of truth consumed by BOTH
 * backend (relative import: `../../shared/types.js`) and frontend (`@shared/types`).
 *
 * The `no-duplicate-shared-exports` arch test forbids re-declaring any name
 * exported here inside `backend/src/` or `frontend/src/` — import it, don't copy it.
 *
 * Casing convention (see CLAUDE.md → "Type casing convention"):
 *   - SQL-row types mirror column names → snake_case (`ItemRow.created_at`)
 *   - DTO / API types assembled in TS    → camelCase (`Item.createdAt`)
 * This split is intentional. Do not "fix" the snake_case rows to camelCase.
 */

/** SQL-row shape — snake_case, mirrors the `items` table columns. */
export interface ItemRow {
  id: number;
  title: string;
  created_at: string; // ISO-8601
}

/** API DTO — camelCase, the JSON wire shape. */
export interface Item {
  id: number;
  title: string;
  createdAt: string;
}

/** Map a SQL row to its API DTO. Pure — unit-tested in tests/unit/. */
export function rowToItem(row: ItemRow): Item {
  return { id: row.id, title: row.title, createdAt: row.created_at };
}
