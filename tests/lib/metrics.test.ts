import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Metrics', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let incrementCounter: typeof import('@/lib/metrics').incrementCounter;
  let setGauge: typeof import('@/lib/metrics').setGauge;
  let recordHistogram: typeof import('@/lib/metrics').recordHistogram;
  let recordTiming: typeof import('@/lib/metrics').recordTiming;
  let timeAsync: typeof import('@/lib/metrics').timeAsync;
  let Metrics: typeof import('@/lib/metrics').Metrics;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    ({
      incrementCounter,
      setGauge,
      recordHistogram,
      recordTiming,
      timeAsync,
      Metrics,
    } = await import('@/lib/metrics'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('incrementCounter', () => {
    it('should emit a counter metric', () => {
      incrementCounter('test.counter', 1);

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.meta.metric.name).toBe('test.counter');
      expect(parsed.meta.metric.type).toBe('counter');
      expect(parsed.meta.metric.value).toBe(1);
    });

    it('should support tags', () => {
      incrementCounter('test.counter', 1, { tags: { env: 'test' } });

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.meta.metric.tags.env).toBe('test');
    });
  });

  describe('setGauge', () => {
    it('should emit a gauge metric', () => {
      setGauge('test.gauge', 42);

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.meta.metric.name).toBe('test.gauge');
      expect(parsed.meta.metric.type).toBe('gauge');
      expect(parsed.meta.metric.value).toBe(42);
    });
  });

  describe('recordHistogram', () => {
    it('should emit a histogram metric', () => {
      recordHistogram('test.histogram', 100);

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.meta.metric.name).toBe('test.histogram');
      expect(parsed.meta.metric.type).toBe('histogram');
      expect(parsed.meta.metric.value).toBe(100);
    });
  });

  describe('recordTiming', () => {
    it('should emit a timing metric', () => {
      recordTiming('test.timing', 250);

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.meta.metric.name).toBe('test.timing');
      expect(parsed.meta.metric.type).toBe('timing');
      expect(parsed.meta.metric.value).toBe(250);
    });
  });

  describe('timeAsync', () => {
    it('should time async operations', async () => {
      const result = await timeAsync('test.async', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'success';
      });

      expect(result).toBe('success');
      expect(consoleSpy).toHaveBeenCalled();

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.meta.metric.name).toBe('test.async');
      expect(parsed.meta.metric.type).toBe('timing');
      expect(parsed.meta.metric.value).toBeGreaterThanOrEqual(10);
      expect(parsed.meta.metric.tags.status).toBe('success');
    });

    it('should record errors in timing', async () => {
      try {
        await timeAsync('test.error', async () => {
          throw new Error('test error');
        });
      } catch {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.meta.metric.tags.status).toBe('error');
    });
  });

  describe('Metrics constants', () => {
    it('should export pre-defined metric names', () => {
      expect(Metrics.API_REQUEST_DURATION).toBe('api.request.duration');
      expect(Metrics.BOOKING_CREATED).toBe('booking.created');
      expect(Metrics.DB_QUERY_DURATION).toBe('db.query.duration');
    });
  });
});
