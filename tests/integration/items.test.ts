import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestAppHarness } from './_helpers/test-app.js';

describe('items API (integration)', () => {
  let h: TestAppHarness;
  beforeEach(async () => {
    h = await createTestApp();
  });
  afterEach(async () => {
    await h.cleanup();
  });

  it('POST creates an item (201) and GET lists it', async () => {
    const post = await fetch(`${h.baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'hello' }),
    });
    expect(post.status).toBe(201);
    const created = await post.json();
    expect(created).toMatchObject({ title: 'hello' });
    expect(typeof created.createdAt).toBe('string');

    const list = await fetch(`${h.baseUrl}/api/items`);
    expect(list.status).toBe(200);
    expect(await list.json()).toHaveLength(1);
  });

  it('POST rejects an empty title with 400 (zod) in the { error } shape', async () => {
    const res = await fetch(`${h.baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });

  it('GET missing id returns a typed 404 in the { error } shape', async () => {
    const res = await fetch(`${h.baseUrl}/api/items/999`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'item 999 not found' });
  });
});
