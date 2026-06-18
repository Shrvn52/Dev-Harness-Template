#!/usr/bin/env node
// Zero-dependency dev launcher: runs the backend + frontend dev servers together
// with prefixed, colour-coded output. Replaces `concurrently` so the root dep
// tree stays vulnerability-free (`npm audit` clean on a fresh clone). Ctrl-C
// tears both children down.
import { spawn } from 'node:child_process';

const RESET = '\x1b[0m';
const procs = [
  { name: 'be', color: '\x1b[36m', args: ['run', 'dev:backend'] },
  { name: 'fe', color: '\x1b[35m', args: ['run', 'dev:frontend'] },
];

const children = procs.map(({ name, color, args }) => {
  const child = spawn('npm', args, { stdio: ['inherit', 'pipe', 'pipe'] });
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
  child.on('exit', (code) => {
    process.stdout.write(prefix(`exited (${code ?? 'signal'})`) + '\n');
    shutdown();
  });
  return child;
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) c.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
