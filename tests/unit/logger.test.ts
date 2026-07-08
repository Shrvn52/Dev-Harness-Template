import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from '../../backend/src/lib/logger.js';

// LOG_LEVEL is unset in the test env → config default 'info' applies, so
// debug is below threshold and info/warn/error emit.
describe('logger (unit)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('info emits one JSON line to stdout with level/time/msg + fields', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.info('item created', { id: 7 });
    expect(out).toHaveBeenCalledTimes(1);
    const line = out.mock.calls[0][0] as string;
    expect(line.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ level: 'info', msg: 'item created', id: 7 });
    expect(typeof parsed.time).toBe('string');
  });

  it('warn and error go to stderr, not stdout', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.warn('careful');
    logger.error('boom');
    expect(out).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledTimes(2);
    expect(JSON.parse(err.mock.calls[1][0] as string).level).toBe('error');
  });

  it('debug is suppressed below the default info threshold', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.debug('noisy internals');
    expect(out).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });
});
