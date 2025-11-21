import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '../../lib/logger';

const fixedDate = new Date('2024-01-01T00:00:00.000Z');

describe('structured logger', () => {
  const originalEnv = process.env;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    process.env = originalEnv;
  });

  it('redacts sensitive metadata keys', () => {
    const logger = createLogger({ module: 'test' }, { level: 'debug', now: () => fixedDate });

    logger.info('processing', {
      token: 'abc123456',
      email: 'user@example.com',
      safe: 'ok',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(payload.meta.token).toBe('ab***56');
    expect(payload.meta.email).toBe('us***om');
    expect(payload.meta.safe).toBe('ok');
  });

  it('honors log level thresholds', () => {
    const logger = createLogger({}, { level: 'warn', now: () => fixedDate });

    logger.info('ignored info');
    expect(logSpy).not.toHaveBeenCalled();

    logger.warn('warned', { reason: 'test' });
    expect(warnSpy).toHaveBeenCalledTimes(1);

    logger.error('boom');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('merges child context', () => {
    const parent = createLogger({ module: 'capacity', correlationId: 'alpha' }, { level: 'debug', now: () => fixedDate });
    const child = parent.child({ scope: 'selector' });

    child.debug('starting', { partySize: 4 });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(payload.module).toBe('capacity');
    expect(payload.scope).toBe('selector');
    expect(payload.meta.partySize).toBe(4);
  });
});
