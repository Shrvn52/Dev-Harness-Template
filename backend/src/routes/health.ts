import { createRouter } from '../lib/hono-app.js';

const app = createRouter();

app.get('/', (c) => c.json({ ok: true, status: 'healthy' }));

export default app;
