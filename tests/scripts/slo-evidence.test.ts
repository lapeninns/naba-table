import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  evaluateSloEvidence,
  parseEvidencePolicy,
  parseMetricsExport,
  parseProbeExport,
  parseServiceLevels,
  parseSloArgs,
  weightedP95,
} from '@/scripts/observability/slo-evidence';

import type {
  MetricsBucket,
  MetricsExport,
  ProbeExport,
  SloEvidenceInput,
} from '@/scripts/observability/slo-evidence';

const serviceLevels = parseServiceLevels(
  readFileSync('config/observability/service-levels.yaml', 'utf8'),
);
const policy = parseEvidencePolicy(readFileSync('config/observability/monitoring.yaml', 'utf8'));

const WINDOW_START = new Date('2026-08-01T00:00:00.000Z');
const WINDOW_END = new Date('2026-08-31T00:00:00.000Z');
const WARM_UP_OK = new Date('2026-07-01T00:00:00.000Z');
const MINUTE = 60_000;

function buckets(
  count: number,
  bucketMinutes: number,
  shape: (index: number) => Partial<MetricsBucket>,
  start: Date = WINDOW_START,
): MetricsBucket[] {
  return Array.from({ length: count }, (_, index) => ({
    start: new Date(start.getTime() + index * bucketMinutes * MINUTE).toISOString(),
    requests: 100,
    errors5xx: 0,
    p95LatencyMs: 400,
    ...shape(index),
  }));
}

function webMetrics(
  shape: (index: number) => Partial<MetricsBucket> = () => ({}),
  count = 30 * 288,
  extra: Partial<MetricsExport> = {},
): MetricsExport {
  return {
    provider: 'vercel',
    service: 'nabatable-web',
    bucketMinutes: 5,
    buckets: buckets(count, 5, shape),
    ...extra,
  };
}

function webProbes(count = 30 * 288, status: 'ok' | 'down' = 'ok'): ProbeExport {
  return {
    service: 'nabatable-web',
    intervalMinutes: 5,
    probes: Array.from({ length: count }, (_, index) => ({
      at: new Date(WINDOW_START.getTime() + index * 5 * MINUTE).toISOString(),
      status,
      latencyMs: 120,
    })),
  };
}

function evaluate(overrides: Partial<SloEvidenceInput> = {}) {
  return evaluateSloEvidence({
    serviceLevels,
    policy,
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    warmUpStartedAt: WARM_UP_OK,
    metrics: [webMetrics()],
    probes: [],
    ...overrides,
  });
}

function web(report: ReturnType<typeof evaluate>) {
  const result = report.services.find((service) => service.service === 'nabatable-web');
  if (!result) throw new Error('nabatable-web missing from report');
  return result;
}

describe('slo-evidence configuration parsing', () => {
  it('reads service levels and the evidence policy from the checked-in contracts', () => {
    expect(serviceLevels.windowDays).toBe(30);
    expect(serviceLevels.services).toEqual([
      { service: 'nabatable-web', availabilityTarget: 99.9, latencyP95Ms: 1500 },
      { service: 'booking-short-links', availabilityTarget: 99.95, latencyP95Ms: 300 },
      { service: 'email-queue-gateway', availabilityTarget: 99.9, latencyP95Ms: 500 },
      { service: 'sms-summary-gateway', availabilityTarget: 99.9, latencyP95Ms: 750 },
    ]);
    expect(policy).toEqual({ coverageMinimumPercent: 99, warmUpDays: 14, windowDays: 30 });
  });

  it('validates metrics exports strictly', () => {
    const valid = parseMetricsExport({
      provider: 'cloudflare',
      service: 'booking-short-links',
      bucketMinutes: 5,
      buckets: [{ start: '2026-08-01T00:00:00Z', requests: 10, errors5xx: 1 }],
    });
    expect(valid.buckets[0]?.p95LatencyMs).toBeNull();
    expect(() => parseMetricsExport({ ...valid, provider: 'posthog' })).toThrow(/provider/u);
    expect(() =>
      parseMetricsExport({
        ...valid,
        buckets: [{ start: '2026-08-01T00:00:00Z', requests: 1, errors5xx: 2 }],
      }),
    ).toThrow(/exceeds requests/u);
    expect(() => parseMetricsExport({ ...valid, sampled: 'yes' })).toThrow(/sampled/u);
    expect(() => parseMetricsExport({ ...valid, bucketMinutes: 0 })).toThrow(/bucketMinutes/u);
    expect(() =>
      parseMetricsExport({ ...valid, buckets: [{ start: 'nope', requests: 1, errors5xx: 0 }] }),
    ).toThrow(/ISO timestamp/u);
  });

  it('validates probe exports strictly', () => {
    expect(
      parseProbeExport({
        service: 'nabatable-web',
        intervalMinutes: 5,
        probes: [{ at: '2026-08-01T00:00:00Z', status: 'ok', latencyMs: 10 }],
      }).probes,
    ).toHaveLength(1);
    expect(() =>
      parseProbeExport({
        service: 'nabatable-web',
        intervalMinutes: 5,
        probes: [{ at: '2026-08-01T00:00:00Z', status: 'healthy', latencyMs: 10 }],
      }),
    ).toThrow(/status/u);
    expect(() => parseProbeExport({ service: '', intervalMinutes: 5, probes: [] })).toThrow(
      /service/u,
    );
  });
});

describe('slo-evidence evaluation', () => {
  it('reports met from complete request metrics with correct availability math', () => {
    const report = evaluate({
      metrics: [webMetrics((index) => (index % 1000 === 0 ? { errors5xx: 1 } : {}))],
    });
    const result = web(report);

    expect(report.windowDays).toBe(30);
    expect(result.status).toBe('met');
    expect(result.requestCount).toBe(864_000);
    expect(result.errorCount).toBe(9);
    expect(result.availabilityPercent).toBe(99.999);
    expect(result.latencyP95Ms).toBe(400);
    expect(result.coverage).toEqual({
      metricsPercent: 100,
      probesPercent: null,
      effectivePercent: 100,
    });
    expect(result.reasons).toEqual([]);
    for (const other of report.services.filter((service) => service.service !== 'nabatable-web')) {
      expect(other.status).toBe('unknown');
      expect(other.reasons).toContain('no_request_metrics');
    }
  });

  it('reports missed when availability or latency targets are not attained', () => {
    const lowAvailability = web(evaluate({ metrics: [webMetrics(() => ({ errors5xx: 1 }))] }));
    expect(lowAvailability.status).toBe('missed');
    expect(lowAvailability.availabilityPercent).toBe(99);

    const slow = web(evaluate({ metrics: [webMetrics(() => ({ p95LatencyMs: 1600 }))] }));
    expect(slow.status).toBe('missed');
    expect(slow.latencyP95Ms).toBe(1600);
  });

  it('returns unknown when metrics coverage is below 99%', () => {
    const result = web(
      evaluate({ metrics: [webMetrics(() => ({}), Math.floor(30 * 288 * 0.98))] }),
    );
    expect(result.status).toBe('unknown');
    expect(result.coverage.metricsPercent).toBeLessThan(99);
    expect(result.reasons).toEqual(['coverage_below_minimum']);
    expect(result.availabilityPercent).toBe(100);
  });

  it('lets sparse external probes lower effective coverage to unknown while metrics are complete', () => {
    const sparse = web(evaluate({ probes: [webProbes(Math.floor(30 * 288 * 0.5))] }));
    expect(sparse.status).toBe('unknown');
    expect(sparse.coverage.probesPercent).toBe(50);
    expect(sparse.coverage.effectivePercent).toBe(50);
    expect(sparse.reasons).toEqual(['coverage_below_minimum']);

    const complete = web(evaluate({ probes: [webProbes()] }));
    expect(complete.status).toBe('met');
    expect(complete.coverage.probesPercent).toBe(100);
    expect(complete.probeSuccessPercent).toBe(100);
  });

  it('never claims attainment from probe results alone or from sampled error events', () => {
    const probesOnly = web(evaluate({ metrics: [], probes: [webProbes()] }));
    expect(probesOnly.status).toBe('unknown');
    expect(probesOnly.reasons).toContain('no_request_metrics');
    expect(probesOnly.availabilityPercent).toBeNull();

    const sampled = web(
      evaluate({ metrics: [webMetrics(() => ({}), 30 * 288, { sampled: true })] }),
    );
    expect(sampled.status).toBe('unknown');
    expect(sampled.reasons).toEqual(['sampled_error_events_not_admissible']);
    expect(sampled.availabilityPercent).toBe(100);
  });

  it('returns unknown when the window is shorter than 30 days', () => {
    const result = web(
      evaluate({
        windowEnd: new Date('2026-08-30T00:00:00.000Z'),
        metrics: [webMetrics(() => ({}), 29 * 288)],
      }),
    );
    expect(result.status).toBe('unknown');
    expect(result.reasons).toContain('window_too_short');
    expect(result.coverage.metricsPercent).toBe(100);
  });

  it('returns unknown while the 14-day warm-up is incomplete or unknown', () => {
    const incomplete = web(evaluate({ warmUpStartedAt: new Date('2026-07-19T00:00:00.000Z') }));
    expect(incomplete.status).toBe('unknown');
    expect(incomplete.reasons).toEqual(['warm_up_incomplete']);

    const boundary = web(evaluate({ warmUpStartedAt: new Date('2026-07-18T00:00:00.000Z') }));
    expect(boundary.status).toBe('met');

    const unknown = web(evaluate({ warmUpStartedAt: null }));
    expect(unknown.status).toBe('unknown');
    expect(unknown.reasons).toEqual(['warm_up_unknown']);
  });

  it('merges overlapping provider exports per bucket and flags inconsistent bucket sizes', () => {
    const first = webMetrics(() => ({ requests: 60, errors5xx: 0, p95LatencyMs: 300 }));
    const second = webMetrics(() => ({ requests: 40, errors5xx: 0, p95LatencyMs: 500 }));
    const merged = web(evaluate({ metrics: [first, second] }));
    expect(merged.requestCount).toBe(864_000);
    expect(merged.latencyP95Ms).toBe(500);
    expect(merged.status).toBe('met');

    const inconsistent = web(evaluate({ metrics: [first, { ...second, bucketMinutes: 10 }] }));
    expect(inconsistent.status).toBe('unknown');
    expect(inconsistent.reasons).toContain('inconsistent_bucket_size');
  });

  it('ignores buckets outside the window and reports empty windows as unknown', () => {
    const outside = webMetrics(() => ({}), 10, {});
    outside.buckets.forEach((bucket, index) => {
      outside.buckets[index] = { ...bucket, start: new Date('2026-06-01T00:00:00Z').toISOString() };
    });
    const result = web(evaluate({ metrics: [outside] }));
    expect(result.status).toBe('unknown');
    expect(result.requestCount).toBe(0);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'coverage_below_minimum',
        'no_requests_in_window',
        'no_latency_samples',
      ]),
    );
  });

  it('rejects an inverted window', () => {
    expect(() => evaluate({ windowStart: WINDOW_END, windowEnd: WINDOW_START })).toThrow(
      /window end must be after window start/u,
    );
  });

  it('computes a request-weighted p95 that rounds up to the heavier tail', () => {
    expect(
      weightedP95([
        { start: 'a', requests: 90, errors5xx: 0, p95LatencyMs: 100 },
        { start: 'b', requests: 10, errors5xx: 0, p95LatencyMs: 1000 },
      ]),
    ).toBe(1000);
    expect(
      weightedP95([
        { start: 'a', requests: 95, errors5xx: 0, p95LatencyMs: 100 },
        { start: 'b', requests: 5, errors5xx: 0, p95LatencyMs: 1000 },
      ]),
    ).toBe(100);
    expect(weightedP95([{ start: 'a', requests: 0, errors5xx: 0, p95LatencyMs: 100 }])).toBeNull();
    expect(weightedP95([{ start: 'a', requests: 5, errors5xx: 0, p95LatencyMs: null }])).toBeNull();
  });

  it('parses CLI arguments with a default 30-day window ending now', () => {
    const now = new Date('2026-09-05T12:00:00.000Z');
    const options = parseSloArgs(
      [
        '--metrics',
        'a.json',
        '--metrics',
        'b.json',
        '--probes',
        'p.json',
        '--warm-up-started-at',
        '2026-07-01T00:00:00Z',
        '--json',
      ],
      () => now,
    );
    expect(options.metricsPaths).toEqual(['a.json', 'b.json']);
    expect(options.probePaths).toEqual(['p.json']);
    expect(options.windowEnd.toISOString()).toBe(now.toISOString());
    expect(options.windowStart.toISOString()).toBe('2026-08-06T12:00:00.000Z');
    expect(options.warmUpStartedAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(() => parseSloArgs(['--window-start', 'yesterday'])).toThrow(/ISO timestamp/u);
    expect(() => parseSloArgs(['--metrics'])).toThrow(/requires a value/u);
    expect(() => parseSloArgs(['--nope'])).toThrow(/Unknown argument/u);
  });
});
