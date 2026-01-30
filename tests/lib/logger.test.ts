import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let createLogger: typeof import('@/lib/logger').createLogger;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    ({ createLogger } = await import('@/lib/logger'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('should create a logger with default context', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should create a logger with custom context', () => {
      const logger = createLogger({ module: 'test' });
      logger.info('test message');

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.module).toBe('test');
      expect(parsed.message).toBe('test message');
    });

    it('should create child loggers with merged context', () => {
      const logger = createLogger({ module: 'parent' });
      const childLogger = logger.child({ submodule: 'child' });

      childLogger.info('child message');

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.module).toBe('parent');
      expect(parsed.submodule).toBe('child');
    });
  });

  describe('log redaction', () => {
    it('should redact sensitive fields', () => {
      const logger = createLogger();
      logger.info('login attempt', { password: 'secret123', userEmail: 'test@example.com' });

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.meta.password).not.toBe('secret123');
      expect(parsed.meta.password).toContain('***');
    });

    it('should redact nested sensitive fields', () => {
      const logger = createLogger();
      logger.info('request', {
        user: {
          authToken: 'abc123xyz',
          name: 'Test User',
        },
      });

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.meta.user.authToken).toContain('***');
      expect(parsed.meta.user.name).toBe('Test User');
    });
  });

  describe('log levels', () => {
    it('should include timestamp and level', () => {
      const logger = createLogger();
      logger.info('test');

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.ts).toBeDefined();
      expect(parsed.level).toBe('info');
    });

    it('should output structured JSON', () => {
      const logger = createLogger();
      logger.info('structured log', { dataKey: 'dataValue' });

      const logOutput = consoleSpy.mock.calls[0][0];

      // Should be valid JSON
      expect(() => JSON.parse(logOutput)).not.toThrow();
    });
  });
});
