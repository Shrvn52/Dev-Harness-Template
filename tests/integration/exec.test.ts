import { describe, it, expect, afterEach, vi } from 'vitest';
import { installMockExec } from './_helpers/mock-exec.js';

/**
 * Demonstrates the subprocess seam end-to-end: installMockExec stubs
 * node:child_process; the lib/exec.ts wrapper inherits the stub; the call is
 * recorded and the canned stdout flows back through the promisify.custom path.
 */
describe('subprocess seam (mock-exec)', () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it('a subprocess-touching helper is testable without the real binary', async () => {
    const m = installMockExec({ git: { code: 0, stdout: 'abc123\n' } });
    restore = m.restore;
    vi.resetModules(); // force exec.ts to re-evaluate against the mock
    const { execFileAsync } = await import('../../backend/src/lib/exec.js');

    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD']);
    expect(stdout).toBe('abc123\n');
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0]).toMatchObject({ cmd: 'git', args: ['rev-parse', 'HEAD'] });
  });
});
