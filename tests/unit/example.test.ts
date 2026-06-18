import { describe, it, expect } from 'vitest';
import { rowToItem } from '../../shared/types.js';

// Unit tier — pure functions, no I/O. The fastest, most numerous tier.
describe('rowToItem', () => {
  it('maps a snake_case SQL row to its camelCase DTO', () => {
    expect(rowToItem({ id: 1, title: 'hello', created_at: '2026-01-01T00:00:00.000Z' })).toEqual({
      id: 1,
      title: 'hello',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
