import type { Item } from '../../shared/types';

// Data layer. The dev server + preview proxy `/api` to the backend (see
// vite.config.ts). This is also the seam where an offline-first project would
// plug a local cache + sync queue — see docs/ARCHITECTURE.md → "Offline-first".

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch('/api/items');
  if (!res.ok) throw new Error(`GET /api/items failed: ${res.status}`);
  return res.json();
}

export async function createItem(title: string): Promise<Item> {
  const res = await fetch('/api/items', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `POST /api/items failed: ${res.status}`);
  }
  return res.json();
}
