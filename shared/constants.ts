/**
 * Shared constants + the const-array-derived-union SSOT pattern.
 *
 * The array is the single source; the union type is DERIVED from it. Adding a
 * value is a one-line edit the type system picks up everywhere — no second list
 * to keep in sync. Prefer this over a hand-maintained `type X = 'a' | 'b'`.
 */

export const ITEM_SORT_FIELDS = ['created_at', 'title'] as const;
export type ItemSortField = (typeof ITEM_SORT_FIELDS)[number];

/** Default page size for list endpoints. A magic number used across the
 *  boundary belongs here, not inlined at call sites. */
export const DEFAULT_PAGE_SIZE = 50;
