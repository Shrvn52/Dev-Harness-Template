#!/usr/bin/env node
// Zero-dependency dev launcher: runs the backend + frontend dev servers together
// with prefixed, colour-coded output. Replaces `concurrently` so the root dep
// tree stays vulnerability-free (`npm audit` clean on a fresh clone).
//
// Process-group teardown (POSIX): each child is spawned `detached` (its own
// group) and killed with `process.kill(-pid)`. Killing only the direct child
// would orphan the REAL servers — npm wraps them in `sh -c`, and a plain
// child.kill() stops at the wrapper, leaving tsx/vite alive with 8137/5173
// still bound (the next `npm run dev` then dies on EADDRINUSE). Detaching puts
// the whole npm→sh→tsx/vite tree in one killable group.
import { spawn } from 'node:child_process';

const RESET = '\x1b[0m';
const procs = [
  { name: 'be', color: '\x1b[36m', args: ['run', 'dev:backend'] },
  { name: 'fe', color: '\x1b[35m', args: ['run', 'dev:frontend'] },
];

let shuttingDown = false;
let exitCode = 0;
let liveChildren = 0;

const children = procs.map(({ name, color, args }) => {
  const child = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  liveChildren += 1;
  const prefix = (line) => `${color}[${name}]${RESET} ${line}`;
  const pipe = (stream, out) => {
    stream.setEncoding('utf8');
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const l of lines) out.write(prefix(l) + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('error', (err) => {
    // spawn failure (npm missing / not runnable) must be loud, not an unhandled throw
    process.stderr.write(prefix(`failed to spawn npm: ${err.message}`) + '\n');
    liveChildren -= 1;
    shutdown(1);
  });
  child.on('exit', (code) => {
    process.stdout.write(prefix(`exited (${code ?? 'signal'})`) + '\n');
    liveChildren -= 1;
    // A child crash must surface as OUR non-zero exit — a wrapper that exits 0
    // on failure teaches scripts/CI that broken dev servers are fine. The
    // deliberate-teardown path (Ctrl-C below) wins because shutdown is sticky.
    shutdown(code === 0 || code === null ? 0 : 1);
  });
  return child;
});

function killGroups(signal) {
  for (const c of children) {
    if (c.pid === undefined || c.exitCode !== null) continue;
    try {
      process.kill(-c.pid, signal); // whole group: npm + sh + tsx/vite
    } catch {
      // group already gone — that's the goal
    }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) {
    maybeFinish();
    return;
  }
  shuttingDown = true;
  exitCode = code;
  killGroups('SIGTERM');
  // Escalate if a group ignores SIGTERM; unref'd so a clean exit isn't held up.
  setTimeout(() => {
    killGroups('SIGKILL');
    process.exit(exitCode);
  }, 3000).unref();
  maybeFinish();
}

function maybeFinish() {
  // Exit only after every child is really gone — exiting first would re-orphan them.
  if (shuttingDown && liveChildren === 0) process.exit(exitCode);
}

// Detached children are NOT in the terminal's foreground group, so Ctrl-C's
// kernel-delivered SIGINT reaches only us — forwarding is mandatory, not politeness.
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
