#!/usr/bin/env node
// Zero-dependency built-artifact smoke test. Boots the REAL compiled backend
// (node dist/backend/src/index.js) under Node's NodeNext ESM resolver — the one
// thing tsc/vitest/CI never exercised — then probes the surfaces that only break
// at real-ESM runtime. Run after `npm run build`.
//
// DOMAIN-NEUTRAL by design: it touches /api/health and dist/shared only — never
// an example route. Deleting the items domain (the template's intended first
// move) must not break a harness-owned lane.
//
// The dist/shared import is the canary for the template's one documented emit
// trap: without shared/package.json's {"type":"module"}, tsc emits shared/ as
// CommonJS and the ESM backend crashes importing it — a break every compile-time
// gate passes. Importing every emitted shared module here catches it even when
// no runtime route happens to import shared.
import { spawn } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const PORT = 8138; // avoid the 8137 default so a running dev server doesn't collide
const BASE = `http://127.0.0.1:${PORT}`;
// The artifact lives at backend/dist/backend/src/index.js — there is no top-level
// dist/. Resolve from this file so cwd doesn't matter, and run with cwd: backend.
const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'backend');
const entry = resolve(backendDir, 'dist/backend/src/index.js');
const sharedDist = resolve(backendDir, 'dist/shared');

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
    await importSharedDist();
    await checkStaticServing();
    settle(true, null);
  } catch (err) {
    settle(false, err.message);
  }
}

// The ship path: when a frontend build exists, the booted backend must serve it
// (index.ts mounts frontend/dist behind the API routes). API-only mode — no
// frontend build — is legitimate, so this probe is conditional, not skipped-silent:
// it reports which mode it verified.
let staticMode = 'API-only (no frontend/dist build)';
async function checkStaticServing() {
  if (!existsSync(resolve(backendDir, '..', 'frontend', 'dist', 'index.html'))) return;
  const res = await fetch(`${BASE}/`);
  const type = res.headers.get('content-type') ?? '';
  if (res.status !== 200 || !type.includes('text/html')) {
    throw new Error(
      `frontend/dist exists but GET / returned ${res.status} (${type}) — static serving is broken`,
    );
  }
  staticMode = 'and serves the built frontend at /';
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

async function importSharedDist() {
  let files;
  try {
    files = readdirSync(sharedDist).filter((f) => f.endsWith('.js'));
  } catch {
    throw new Error(`no dist/shared emitted at ${sharedDist} — run \`npm run build\` first`);
  }
  if (files.length === 0) {
    throw new Error('dist/shared contains no .js modules — the shared emit is broken');
  }
  for (const f of files) {
    // A CJS-emitted module (the type:module trap) throws right here under real ESM.
    const mod = await import(pathToFileURL(join(sharedDist, f)).href);
    if (Object.keys(mod).length === 0) {
      throw new Error(`dist/shared/${f} imported but exposes no exports — emit is broken`);
    }
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
  process.stdout.write(
    `[smoke] built artifact booted, served /api/health, dist/shared imports as real ESM, ${staticMode} ✓\n`,
  );
process.exit(ok ? 0 : 1);
