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

  it('GET a non-numeric id returns a 400 from the param validator', async () => {
    const res = await fetch(`${h.baseUrl}/api/items/abc`);
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });

  it('PUT updates an item title (200) and returns the updated DTO', async () => {
    const post = await fetch(`${h.baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'before' }),
    });
    const { id } = await post.json();

    const put = await fetch(`${h.baseUrl}/api/items/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'after' }),
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ id, title: 'after' });
  });

  it('PUT with an empty body {} returns a 400 from the empty-body guard', async () => {
    const post = await fetch(`${h.baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'x' }),
    });
    const { id } = await post.json();

    const put = await fetch(`${h.baseUrl}/api/items/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(put.status).toBe(400);
    expect(await put.json()).toHaveProperty('error');
  });

  it('PUT a missing id with a valid body returns a 404 (changes === 0)', async () => {
    const res = await fetch(`${h.baseUrl}/api/items/999`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'nope' }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'item 999 not found' });
  });

  it('PUT a non-numeric id with a body returns a 400 from the param validator', async () => {
    const res = await fetch(`${h.baseUrl}/api/items/abc`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'x' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });
});
