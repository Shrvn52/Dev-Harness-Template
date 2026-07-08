#!/usr/bin/env node
// Zero-dependency built-artifact smoke test. Boots the REAL compiled backend
// (node dist/backend/src/index.js) under Node's NodeNext ESM resolver — the one
// thing tsc/vitest/CI never exercised — then hits the live HTTP surface. Mirrors
// tools/dev.mjs's node:child_process pattern so the root tree stays audit-clean
// (no concurrently/curl/shell). Run after `npm run build`.
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8138; // avoid the 8137 default so a running dev server doesn't collide
const BASE = `http://127.0.0.1:${PORT}`;
// The artifact lives at backend/dist/backend/src/index.js — there is no top-level
// dist/. Resolve from this file so cwd doesn't matter, and run with cwd: backend.
const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'backend');
const entry = resolve(backendDir, 'dist/backend/src/index.js');

let ready = false;
let shuttingDown = false;
let settled = false;

const child = spawn('node', [entry], {
  cwd: backendDir,
  env: { ...process.env, PORT: String(PORT), DB_PATH: ':memory:' },
  stdio: ['ignore', 'inherit', 'inherit'], // surface the child's stderr on a boot crash
});

const done = new Promise((resolveOnce) => {
  const settle = (ok, reason) => {
    if (settled) return;
    settled = true;
    if (reason) process.stderr.write(`[smoke] ${reason}\n`);
    resolveOnce(ok);
  };

  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      settle(false, 'could not spawn node / find the artifact — run `npm run build` first');
    } else {
      settle(false, `child process error: ${err.message}`);
    }
  });

  // An exit BEFORE readiness is a boot crash. The deliberate teardown SIGTERM fires
  // exit AFTER success — `ready` is already true then, so we ignore it.
  child.on('exit', (code, signal) => {
    if (!ready)
      settle(false, `backend exited before becoming ready (code=${code}, signal=${signal})`);
  });

  run(settle);
});

async function run(settle) {
  try {
    await pollHealth();
    ready = true;
    await createItem();
    settle(true, null);
  } catch (err) {
    settle(false, err.message);
  }
}

async function pollHealth() {
  const deadline = Date.now() + 5000; // boot is async — poll, don't sleep
  let lastErr = 'no response';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.status === 200) {
        const body = await res.json();
        // Hard-fail immediately on a wrong body — don't re-poll a bound-but-wrong
        // server into a timeout (that would blur "wrong" into "never bound").
        if (body?.ok !== true || body?.status !== 'healthy') {
          throw new Error(
            `/api/health returned 200 but an unexpected body: ${JSON.stringify(body)}`,
          );
        }
        return;
      }
      lastErr = `status ${res.status}`;
    } catch (err) {
      if (err.message.startsWith('/api/health returned 200')) throw err;
      lastErr = err.message;
    }
    await delay(150);
  }
  throw new Error(`backend never became healthy within 5s (last: ${lastErr})`);
}

async function createItem() {
  const res = await fetch(`${BASE}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'smoke' }),
  });
  if (res.status !== 201) {
    throw new Error(`POST /api/items expected 201, got ${res.status}`);
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function teardown() {
  if (shuttingDown) return; // mirror dev.mjs's re-entry guard
  shuttingDown = true;
  if (child.pid && !child.killed) child.kill('SIGTERM');
}

const ok = await done;
teardown();
if (ok)
  process.stdout.write('[smoke] built artifact booted and served /api/health + /api/items ✓\n');
process.exit(ok ? 0 : 1);
