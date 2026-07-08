import { vi } from 'vitest';
import { promisify } from 'node:util';

/**
 * Record-and-replay stub for `child_process.execFile`, so subprocess-touching
 * code is testable without real binaries. Records every call for assertion.
 *
 * Usage:
 *   const m = installMockExec({ git: { code: 0, stdout: 'abc\n' } });
 *   vi.resetModules();
 *   const { thing } = await import('../../backend/src/lib/uses-exec.js');
 *   // ... exercise ...
 *   expect(m.calls).toHaveLength(1);
 *   m.restore();
 */

export interface MockExecCall {
  cmd: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface MockExecResponse {
  code?: number;
  stdout?: string;
  stderr?: string;
}

export interface MockExecHarness {
  calls: MockExecCall[];
  restore: () => void;
}

export function installMockExec(
  responseMap: Record<string, MockExecResponse> = {},
): MockExecHarness {
  const calls: MockExecCall[] = [];

  vi.doMock('node:child_process', async () => {
    const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');

    const execFileMock = ((cmd: string, args: any, opts: any, cb?: any) => {
      // Normalise overloads: (cmd, cb) / (cmd, args, cb) / (cmd, args, opts, cb).
      let argv: string[] = [];
      let options: any = {};
      let callback: any;
      if (typeof args === 'function') {
        callback = args;
      } else if (Array.isArray(args)) {
        argv = args;
        if (typeof opts === 'function') callback = opts;
        else {
          options = opts ?? {};
          callback = cb;
        }
      } else {
        options = args ?? {};
        if (typeof opts === 'function') callback = opts;
        else callback = cb;
      }

      calls.push({ cmd, args: argv, cwd: options?.cwd, env: options?.env });
      const match = responseMap[cmd] ?? { code: 0, stdout: '', stderr: '' };

      const emitter = new actual.ChildProcess();
      setImmediate(() => {
        if (match.code && match.code !== 0) {
          const err = new Error(match.stderr || 'mocked failure') as NodeJS.ErrnoException;
          err.code = String(match.code);
          callback?.(err, match.stdout ?? '', match.stderr ?? '');
        } else {
          callback?.(null, match.stdout ?? '', match.stderr ?? '');
        }
      });
      return emitter;
    }) as any;

    // util.promisify(execFile) uses the [util.promisify.custom] symbol so the
    // resolved value is {stdout, stderr}, not just stdout. Re-declare it on the
    // mock or `const {stdout} = await execFileAsync(...)` breaks.
    (execFileMock as any)[promisify.custom] = (cmd: string, args?: string[], options?: any) =>
      new Promise((resolve, reject) => {
        execFileMock(cmd, args ?? [], options ?? {}, (err: any, stdout: string, stderr: string) => {
          if (err) {
            err.stdout = String(stdout ?? '');
            err.stderr = String(stderr ?? '');
            reject(err);
          } else {
            resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
          }
        });
      });

    return { ...actual, execFile: execFileMock };
  });

  return {
    calls,
    restore: () => {
      vi.doUnmock('node:child_process');
    },
  };
}
