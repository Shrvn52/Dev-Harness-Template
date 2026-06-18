import { zValidator } from '@hono/zod-validator';
import { createRouter } from '../lib/hono-app.js';
import { zodErrorHook } from '../lib/zod-hook.js';
import { createItemSchema, updateItemSchema, idSchema } from '../schemas/example.js';
import { getDb } from '../db.js';
import { NotFoundError, BadRequestError } from '../lib/errors.js';
import { rowToItem, type ItemRow } from '../../../shared/types.js';

const app = createRouter();

app.get('/', (c) => {
  const rows = getDb()
    .prepare('SELECT id, title, created_at FROM items ORDER BY id DESC')
    .all() as ItemRow[];
  return c.json(rows.map(rowToItem));
});

app.get('/:id', zValidator('param', idSchema, zodErrorHook), (c) => {
  const { id } = c.req.valid('param');
  const row = getDb()
    .prepare('SELECT id, title, created_at FROM items WHERE id = ?')
    .get(id) as ItemRow | undefined;
  if (!row) throw new NotFoundError(`item ${id} not found`);
  return c.json(rowToItem(row));
});

app.post('/', zValidator('json', createItemSchema, zodErrorHook), (c) => {
  const { title } = c.req.valid('json');
  const created_at = new Date().toISOString();
  const info = getDb()
    .prepare('INSERT INTO items (title, created_at) VALUES (?, ?)')
    .run(title, created_at);
  return c.json(rowToItem({ id: Number(info.lastInsertRowid), title, created_at }), 201);
});

app.put(
  '/:id',
  zValidator('param', idSchema, zodErrorHook),
  zValidator('json', updateItemSchema, zodErrorHook),
  (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    // `updateItemSchema` is `.partial()`, so `{}` is schema-valid and `body.title`
    // is undefined. Guard BEFORE any DB call: binding undefined to the TEXT NOT NULL
    // `title` column coerces to NULL → SQLITE_CONSTRAINT_NOTNULL → an unmapped 500.
    // The guard turns that into a deliberate 400. A multi-column app replaces this
    // single-column guard with a dynamic SET builder; that's overkill for one column.
    if (body.title === undefined) throw new BadRequestError('no fields to update');
    const info = getDb()
      .prepare('UPDATE items SET title = ? WHERE id = ?')
      .run(body.title, id);
    if (info.changes === 0) throw new NotFoundError(`item ${id} not found`);
    const row = getDb()
      .prepare('SELECT id, title, created_at FROM items WHERE id = ?')
      .get(id) as ItemRow;
    return c.json(rowToItem(row));
  },
);

export default app;
