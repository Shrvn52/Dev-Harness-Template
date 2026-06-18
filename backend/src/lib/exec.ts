import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * Promisified execFile — resolves `{ stdout, stderr }`, rejects on non-zero exit.
 *
 * This is the subprocess seam: integration tests stub `node:child_process` (see
 * tests/integration/_helpers/mock-exec.ts) and this wrapper inherits the stub
 * transparently, so subprocess-touching code is testable without real binaries.
 */
export const execFileAsync = promisify(execFile);
