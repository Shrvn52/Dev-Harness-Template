import { zValidator } from '@hono/zod-validator';
import { createRouter } from '../lib/hono-app.js';
import { zodErrorHook } from '../lib/zod-hook.js';
import { createItemSchema } from '../schemas/example.js';
import { getDb } from '../db.js';
import { NotFoundError } from '../lib/errors.js';
import { rowToItem, type ItemRow } from '../../../shared/types.js';

const app = createRouter();

app.get('/', (c) => {
  const rows = getDb()
    .prepare('SELECT id, title, created_at FROM items ORDER BY id DESC')
    .all() as ItemRow[];
  return c.json(rows.map(rowToItem));
});

app.get('/:id', (c) => {
  const id = Number(c.req.param('id'));
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

export default app;
