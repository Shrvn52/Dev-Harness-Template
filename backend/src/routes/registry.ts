import type { Hono } from 'hono';
import health from './health.js';
import items from './items.js';

/** One mounted API route per entry. The registry-coverage arch test asserts
 *  every entry exposes a real router and a unique, `/api/`-prefixed path. */
export interface RouteEntry {
  path: string;
  app: Hono;
}

export const ROUTES: RouteEntry[] = [
  { path: '/api/health', app: health },
  { path: '/api/items', app: items },
];
