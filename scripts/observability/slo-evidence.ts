import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isYamlMap, parseYamlSubset } from '../monitoring/yaml-subset';

/**
 * `pnpm ops:slo-evidence` — computes request-based availability and p95
 * latency per service from provider metrics exports (Vercel / Cloudflare
 * analytics JSON) plus external probe results, against
 * `config/observability/service-levels.yaml`.
 *
 * Attainment is only ever claimed from *complete request metrics*. Sampled
 * error events (PostHog exceptions, error-insight webhooks) are never
 * admissible: an export flagged `sampled: true` yields `unknown`. Coverage
 * below the configured minimum, a window shorter than the configured length,
 * or an incomplete warm-up also yield `unknown`.
 *
 * Expected metrics export shape (one file per provider/service):
 * {
 *   "provider": "vercel" | "cloudflare",
 *   "service": "nabatable-web",
 *   "bucketMinutes": 5,
 *   "sampled": false,
 *   "buckets": [{ "start": ISO-8601, "requests": 1234, "errors5xx": 3, "p95LatencyMs": 420 }]
 * }
 *
 * Expected probe export shape:
 * {
 *   "service": "nabatable-web",
 *   "intervalMinutes": 5,
 *   "probes": [{ "at": ISO-8601, "status": "ok" | "degraded" | "down", "latencyMs": 123 }]
 * }
 */

export type MetricsBucket = {
  readonly start: string;
  readonly requests: number;
  readonly errors5xx: number;
  readonly p95LatencyMs: number | null;
};

export type MetricsExport = {
  readonly provider: 'vercel' | 'cloudflare';
  readonly service: string;
  readonly bucketMinutes: number;
  readonly sampled?: boolean;
  readonly buckets: ReadonlyArray<MetricsBucket>;
};

export type ProbeSample = {
  readonly at: string;
  readonly status: 'ok' | 'degraded' | 'down';
  readonly latencyMs: number;
};

export type ProbeExport = {
  readonly service: string;
  readonly intervalMinutes: number;
  readonly probes: ReadonlyArray<ProbeSample>;
};

export type ServiceLevel = {
  readonly service: string;
  readonly availabilityTarget: number;
  readonly latencyP95Ms: number;
};

export type ServiceLevels = {
  readonly windowDays: number;
  readonly services: ReadonlyArray<ServiceLevel>;
};

export type EvidencePolicy = {
  readonly coverageMinimumPercent: number;
  readonly warmUpDays: number;
  readonly windowDays: number;
};

export type SloEvidenceInput = {
  readonly serviceLevels: ServiceLevels;
  readonly policy: EvidencePolicy;
  readonly windowStart: Date;
  readonly windowEnd: Date;
  /** When monitoring for this deployment started; null when unknown. */
  readonly warmUpStartedAt: Date | null;
  readonly metrics: ReadonlyArray<MetricsExport>;
  readonly probes: ReadonlyArray<ProbeExport>;
};

export type SloStatus = 'met' | 'missed' | 'unknown';

export type ServiceSloResult = {
  readonly service: string;
  readonly status: SloStatus;
  readonly targets: { readonly availabilityPercent: number; readonly latencyP95Ms: number };
  readonly requestCount: number;
  readonly errorCount: number;
  readonly availabilityPercent: number | null;
  readonly latencyP95Ms: number | null;
  /** Informational only; never used for attainment. */
  readonly probeSuccessPercent: number | null;
  readonly coverage: {
    readonly metricsPercent: number;
    readonly probesPercent: number | null;
    readonly effectivePercent: number;
  };
  readonly reasons: ReadonlyArray<string>;
};

export type SloEvidenceReport = {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly windowDays: number;
  readonly policy: EvidencePolicy;
  readonly services: ReadonlyArray<ServiceSloResult>;
};

class SloEvidenceError extends Error {
  constructor(message: string) {
    super(`slo-evidence: ${message}`);
    this.name = 'SloEvidenceError';
  }
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function parseServiceLevels(source: string): ServiceLevels {
  const root = parseYamlSubset(source);
  if (!isYamlMap(root)) throw new SloEvidenceError('service-levels.yaml must be a map');
  const windowDays = root.windowDays;
  if (typeof windowDays !== 'number' || windowDays <= 0) {
    throw new SloEvidenceError('service-levels.yaml windowDays must be a positive number');
  }
  const servicesMap = root.services;
  if (!isYamlMap(servicesMap))
    throw new SloEvidenceError('service-levels.yaml services must be a map');
  const services = Object.entries(servicesMap).map(([service, raw]) => {
    if (!isYamlMap(raw)) throw new SloEvidenceError(`service ${service} must be a map`);
    const availabilityTarget = raw.availabilityTarget;
    const latencyP95Ms = raw.latencyP95Ms;
    if (
      typeof availabilityTarget !== 'number' ||
      availabilityTarget <= 0 ||
      availabilityTarget > 100
    ) {
      throw new SloEvidenceError(`service ${service} availabilityTarget must be within (0, 100]`);
    }
    if (typeof latencyP95Ms !== 'number' || latencyP95Ms <= 0) {
      throw new SloEvidenceError(`service ${service} latencyP95Ms must be positive`);
    }
    return { service, availabilityTarget, latencyP95Ms };
  });
  return { windowDays, services };
}

export function parseEvidencePolicy(monitoringSource: string): EvidencePolicy {
  const root = parseYamlSubset(monitoringSource);
  if (!isYamlMap(root) || !isYamlMap(root.evidence)) {
    throw new SloEvidenceError('monitoring.yaml evidence section is missing');
  }
  const { coverageMinimumPercent, warmUpDays, windowDays } = root.evidence;
  if (
    typeof coverageMinimumPercent !== 'number' ||
    typeof warmUpDays !== 'number' ||
    typeof windowDays !== 'number'
  ) {
    throw new SloEvidenceError('monitoring.yaml evidence values must be numbers');
  }
  return { coverageMinimumPercent, warmUpDays, windowDays };
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function parseMetricsExport(value: unknown): MetricsExport {
  if (typeof value !== 'object' || value === null)
    throw new SloEvidenceError('metrics export must be an object');
  const record = value as Record<string, unknown>;
  if (record.provider !== 'vercel' && record.provider !== 'cloudflare') {
    throw new SloEvidenceError('metrics export provider must be vercel|cloudflare');
  }
  if (typeof record.service !== 'string' || record.service.length === 0) {
    throw new SloEvidenceError('metrics export service must be a string');
  }
  if (!isFiniteNonNegative(record.bucketMinutes) || record.bucketMinutes <= 0) {
    throw new SloEvidenceError('metrics export bucketMinutes must be positive');
  }
  if (record.sampled !== undefined && typeof record.sampled !== 'boolean') {
    throw new SloEvidenceError('metrics export sampled must be boolean');
  }
  if (!Array.isArray(record.buckets))
    throw new SloEvidenceError('metrics export buckets must be an array');
  const buckets = record.buckets.map((raw, index): MetricsBucket => {
    if (typeof raw !== 'object' || raw === null) {
      throw new SloEvidenceError(`bucket ${index} must be an object`);
    }
    const bucket = raw as Record<string, unknown>;
    if (typeof bucket.start !== 'string' || !Number.isFinite(Date.parse(bucket.start))) {
      throw new SloEvidenceError(`bucket ${index} start must be an ISO timestamp`);
    }
    if (!isFiniteNonNegative(bucket.requests) || !isFiniteNonNegative(bucket.errors5xx)) {
      throw new SloEvidenceError(`bucket ${index} requests/errors5xx must be non-negative numbers`);
    }
    if (bucket.errors5xx > bucket.requests) {
      throw new SloEvidenceError(`bucket ${index} errors5xx exceeds requests`);
    }
    const p95 = bucket.p95LatencyMs;
    if (p95 !== null && p95 !== undefined && !isFiniteNonNegative(p95)) {
      throw new SloEvidenceError(
        `bucket ${index} p95LatencyMs must be a non-negative number or null`,
      );
    }
    return {
      start: bucket.start,
      requests: bucket.requests,
      errors5xx: bucket.errors5xx,
      p95LatencyMs: p95 === undefined ? null : (p95 as number | null),
    };
  });
  return {
    provider: record.provider,
    service: record.service,
    bucketMinutes: record.bucketMinutes,
    ...(record.sampled !== undefined ? { sampled: record.sampled } : {}),
    buckets,
  };
}

export function parseProbeExport(value: unknown): ProbeExport {
  if (typeof value !== 'object' || value === null)
    throw new SloEvidenceError('probe export must be an object');
  const record = value as Record<string, unknown>;
  if (typeof record.service !== 'string' || record.service.length === 0) {
    throw new SloEvidenceError('probe export service must be a string');
  }
  if (!isFiniteNonNegative(record.intervalMinutes) || record.intervalMinutes <= 0) {
    throw new SloEvidenceError('probe export intervalMinutes must be positive');
  }
  if (!Array.isArray(record.probes))
    throw new SloEvidenceError('probe export probes must be an array');
  const probes = record.probes.map((raw, index): ProbeSample => {
    if (typeof raw !== 'object' || raw === null)
      throw new SloEvidenceError(`probe ${index} must be an object`);
    const probe = raw as Record<string, unknown>;
    if (typeof probe.at !== 'string' || !Number.isFinite(Date.parse(probe.at))) {
      throw new SloEvidenceError(`probe ${index} at must be an ISO timestamp`);
    }
    if (probe.status !== 'ok' && probe.status !== 'degraded' && probe.status !== 'down') {
      throw new SloEvidenceError(`probe ${index} status must be ok|degraded|down`);
    }
    if (!isFiniteNonNegative(probe.latencyMs)) {
      throw new SloEvidenceError(`probe ${index} latencyMs must be a non-negative number`);
    }
    return { at: probe.at, status: probe.status, latencyMs: probe.latencyMs };
  });
  return { service: record.service, intervalMinutes: record.intervalMinutes, probes };
}

/**
 * Request-weighted p95 across bucket p95 values. Exact percentiles cannot be
 * recovered from per-bucket percentiles, so this takes the bucket p95 at the
 * 95th percentile of request volume — a conservative approximation that
 * over-reports latency rather than under-reporting it.
 */
export function weightedP95(buckets: ReadonlyArray<MetricsBucket>): number | null {
  const weighted = buckets
    .filter((bucket) => bucket.p95LatencyMs !== null && bucket.requests > 0)
    .map((bucket) => ({ value: bucket.p95LatencyMs as number, weight: bucket.requests }))
    .sort((left, right) => left.value - right.value);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total === 0) return null;
  const threshold = total * 0.95;
  let cumulative = 0;
  for (const entry of weighted) {
    cumulative += entry.weight;
    if (cumulative >= threshold) return entry.value;
  }
  return weighted.at(-1)?.value ?? null;
}

function withinWindow(at: string, windowStart: Date, windowEnd: Date): boolean {
  const ms = Date.parse(at);
  return ms >= windowStart.getTime() && ms < windowEnd.getTime();
}

function evaluateService(
  level: ServiceLevel,
  input: SloEvidenceInput,
  globalReasons: string[],
): ServiceSloResult {
  const reasons = [...globalReasons];
  const windowMs = input.windowEnd.getTime() - input.windowStart.getTime();
  const exports = input.metrics.filter((entry) => entry.service === level.service);
  const targets = {
    availabilityPercent: level.availabilityTarget,
    latencyP95Ms: level.latencyP95Ms,
  };

  if (exports.some((entry) => entry.sampled === true)) {
    reasons.push('sampled_error_events_not_admissible');
  }

  const bucketMinutes = exports[0]?.bucketMinutes ?? null;
  if (exports.some((entry) => entry.bucketMinutes !== bucketMinutes)) {
    reasons.push('inconsistent_bucket_size');
  }

  const buckets = new Map<string, MetricsBucket>();
  for (const entry of exports) {
    for (const bucket of entry.buckets) {
      if (!withinWindow(bucket.start, input.windowStart, input.windowEnd)) continue;
      const key = new Date(bucket.start).toISOString();
      const existing = buckets.get(key);
      buckets.set(
        key,
        existing
          ? {
              start: key,
              requests: existing.requests + bucket.requests,
              errors5xx: existing.errors5xx + bucket.errors5xx,
              p95LatencyMs: Math.max(existing.p95LatencyMs ?? 0, bucket.p95LatencyMs ?? 0) || null,
            }
          : { ...bucket, start: key },
      );
    }
  }

  const expectedBuckets = bucketMinutes
    ? Math.floor(windowMs / (bucketMinutes * MS_PER_MINUTE))
    : 0;
  const metricsPercent =
    expectedBuckets > 0 ? round(Math.min(100, (buckets.size / expectedBuckets) * 100)) : 0;
  if (exports.length === 0) reasons.push('no_request_metrics');

  const probeExports = input.probes.filter((entry) => entry.service === level.service);
  let probesPercent: number | null = null;
  let probeSuccessPercent: number | null = null;
  if (probeExports.length > 0) {
    const intervalMinutes = probeExports[0]?.intervalMinutes ?? 5;
    const expectedProbes = Math.floor(windowMs / (intervalMinutes * MS_PER_MINUTE));
    const samples = probeExports.flatMap((entry) =>
      entry.probes.filter((probe) => withinWindow(probe.at, input.windowStart, input.windowEnd)),
    );
    const distinct = new Set(samples.map((probe) => Date.parse(probe.at)));
    probesPercent =
      expectedProbes > 0 ? round(Math.min(100, (distinct.size / expectedProbes) * 100)) : 0;
    const successes = samples.filter((probe) => probe.status === 'ok').length;
    probeSuccessPercent = samples.length > 0 ? round((successes / samples.length) * 100) : null;
  }

  const effectivePercent =
    probesPercent === null ? metricsPercent : Math.min(metricsPercent, probesPercent);
  if (effectivePercent < input.policy.coverageMinimumPercent)
    reasons.push('coverage_below_minimum');

  const requestCount = Array.from(buckets.values()).reduce(
    (sum, bucket) => sum + bucket.requests,
    0,
  );
  const errorCount = Array.from(buckets.values()).reduce(
    (sum, bucket) => sum + bucket.errors5xx,
    0,
  );
  const availabilityPercent =
    requestCount > 0 ? round((1 - errorCount / requestCount) * 100, 4) : null;
  const latencyP95Ms = weightedP95(Array.from(buckets.values()));
  if (requestCount === 0 && exports.length > 0) reasons.push('no_requests_in_window');
  if (latencyP95Ms === null && exports.length > 0) reasons.push('no_latency_samples');

  let status: SloStatus = 'unknown';
  if (reasons.length === 0 && availabilityPercent !== null && latencyP95Ms !== null) {
    status =
      availabilityPercent >= level.availabilityTarget && latencyP95Ms <= level.latencyP95Ms
        ? 'met'
        : 'missed';
  }

  return {
    service: level.service,
    status,
    targets,
    requestCount,
    errorCount,
    availabilityPercent,
    latencyP95Ms,
    probeSuccessPercent,
    coverage: { metricsPercent, probesPercent, effectivePercent },
    reasons,
  };
}

export function evaluateSloEvidence(input: SloEvidenceInput): SloEvidenceReport {
  const windowMs = input.windowEnd.getTime() - input.windowStart.getTime();
  if (!(windowMs > 0)) throw new SloEvidenceError('window end must be after window start');
  const windowDays = round(windowMs / MS_PER_DAY, 3);
  const requiredWindowDays = Math.max(input.policy.windowDays, input.serviceLevels.windowDays);

  const globalReasons: string[] = [];
  if (windowDays < requiredWindowDays) globalReasons.push('window_too_short');
  if (!input.warmUpStartedAt) {
    globalReasons.push('warm_up_unknown');
  } else if (
    input.warmUpStartedAt.getTime() + input.policy.warmUpDays * MS_PER_DAY >
    input.windowStart.getTime()
  ) {
    globalReasons.push('warm_up_incomplete');
  }

  return {
    windowStart: input.windowStart.toISOString(),
    windowEnd: input.windowEnd.toISOString(),
    windowDays,
    policy: input.policy,
    services: input.serviceLevels.services.map((level) =>
      evaluateService(level, input, globalReasons),
    ),
  };
}

export type SloCliOptions = {
  readonly serviceLevelsPath: string;
  readonly monitoringPath: string;
  readonly metricsPaths: ReadonlyArray<string>;
  readonly probePaths: ReadonlyArray<string>;
  readonly windowStart: Date;
  readonly windowEnd: Date;
  readonly warmUpStartedAt: Date | null;
};

function parseDateArg(value: string, label: string): Date {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new SloEvidenceError(`${label} must be an ISO timestamp`);
  return new Date(ms);
}

export function parseSloArgs(
  argv: ReadonlyArray<string>,
  now: () => Date = () => new Date(),
): SloCliOptions {
  const metricsPaths: string[] = [];
  const probePaths: string[] = [];
  let serviceLevelsPath = path.join('config', 'observability', 'service-levels.yaml');
  let monitoringPath = path.join('config', 'observability', 'monitoring.yaml');
  let windowStart: Date | null = null;
  let windowEnd: Date | null = null;
  let warmUpStartedAt: Date | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    const takeNext = (): string => {
      if (next === undefined) throw new SloEvidenceError(`${arg} requires a value`);
      index += 1;
      return next;
    };
    if (arg === '--metrics') metricsPaths.push(takeNext());
    else if (arg === '--probes') probePaths.push(takeNext());
    else if (arg === '--service-levels') serviceLevelsPath = takeNext();
    else if (arg === '--monitoring') monitoringPath = takeNext();
    else if (arg === '--window-start') windowStart = parseDateArg(takeNext(), '--window-start');
    else if (arg === '--window-end') windowEnd = parseDateArg(takeNext(), '--window-end');
    else if (arg === '--warm-up-started-at') {
      warmUpStartedAt = parseDateArg(takeNext(), '--warm-up-started-at');
    } else if (arg === '--json') {
      // JSON is the only output format.
    } else throw new SloEvidenceError(`Unknown argument: ${arg}`);
  }
  const end = windowEnd ?? now();
  const start = windowStart ?? new Date(end.getTime() - 30 * MS_PER_DAY);
  return {
    serviceLevelsPath,
    monitoringPath,
    metricsPaths,
    probePaths,
    windowStart: start,
    windowEnd: end,
    warmUpStartedAt,
  };
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const options = parseSloArgs(argv);
  const report = evaluateSloEvidence({
    serviceLevels: parseServiceLevels(readFileSync(options.serviceLevelsPath, 'utf8')),
    policy: parseEvidencePolicy(readFileSync(options.monitoringPath, 'utf8')),
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    warmUpStartedAt: options.warmUpStartedAt,
    metrics: options.metricsPaths.map((file) => parseMetricsExport(readJsonFile(file))),
    probes: options.probePaths.map((file) => parseProbeExport(readJsonFile(file))),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.services.every((service) => service.status === 'met') ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    });
}
