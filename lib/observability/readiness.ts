import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Readiness contract shared by the web `/api/ready` route and the monitoring
 * verifier. Every check is bounded: a probe that exceeds its timeout reports
 * `degraded` instead of hanging the request, and a probe that throws reports
 * `down`. Checks are read-only by construction — the route only wires probes
 * that read (a bounded table select, a bucket list, a HEAD request).
 */

export const READINESS_SERVICE_NAME = 'nabatable-web';

export type ReadinessCheckStatus = 'ok' | 'degraded' | 'down';

/** Safe, enumerable detail strings. Never carries provider payloads or messages. */
export type ReadinessCheckDetail = 'timeout' | 'unconfigured' | 'error' | `http_${number}`;

export type ReadinessCheck = {
  readonly name: string;
  readonly status: ReadinessCheckStatus;
  readonly latencyMs: number;
  readonly detail?: ReadinessCheckDetail;
};

export type ReadinessReport = {
  readonly service: string;
  readonly status: ReadinessCheckStatus;
  readonly revision: string | null;
  readonly deploymentId: string | null;
  readonly observedAt: string;
  readonly checks: ReadonlyArray<ReadinessCheck>;
};

export type ReadinessProbeResult = {
  readonly status: ReadinessCheckStatus;
  readonly detail?: ReadinessCheckDetail;
};

export type ReadinessProbe = {
  readonly name: string;
  /** Upper bound for the probe. Exceeding it yields `degraded` with detail `timeout`. */
  readonly timeoutMs: number;
  readonly run: (signal: AbortSignal) => Promise<ReadinessProbeResult>;
};

export const DEFAULT_READINESS_TIMEOUT_MS = 2_000;

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Compares a presented bearer token with the configured monitoring token in
 * constant time. Missing or unconfigured tokens fail closed. Both sides are
 * hashed before comparison so the comparison cost does not depend on token
 * length.
 */
export function isAuthorizedMonitoringRequest(
  expectedToken: string | undefined,
  authorization: string | null,
): boolean {
  const expected = expectedToken?.trim() ?? '';
  if (expected.length === 0) return false;
  const supplied = authorization?.match(/^Bearer\s+([^\s]+)\s*$/iu)?.[1] ?? '';
  if (supplied.length === 0) return false;
  return timingSafeEqual(sha256(expected), sha256(supplied));
}

/**
 * Environment view used to resolve build identity. Accepts `process.env`
 * directly; only the four well-known keys are read.
 */
export type RevisionEnvironment = Readonly<Record<string, string | undefined>>;

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveRevision(env: RevisionEnvironment): {
  revision: string | null;
  deploymentId: string | null;
} {
  return {
    revision: nonEmpty(env.NABATABLE_SOURCE_REVISION) ?? nonEmpty(env.VERCEL_GIT_COMMIT_SHA),
    deploymentId: nonEmpty(env.NABATABLE_BUILD_ID) ?? nonEmpty(env.VERCEL_DEPLOYMENT_ID),
  };
}

export async function runBoundedProbe(
  probe: ReadinessProbe,
  now: () => number = Date.now,
): Promise<ReadinessCheck> {
  const startedAt = now();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<ReadinessProbeResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ status: 'degraded', detail: 'timeout' });
    }, probe.timeoutMs);
  });

  try {
    const result = await Promise.race([
      probe.run(controller.signal).catch(
        (): ReadinessProbeResult => ({
          status: 'down',
          detail: 'error',
        }),
      ),
      timeout,
    ]);
    return {
      name: probe.name,
      status: result.status,
      latencyMs: Math.max(0, now() - startedAt),
      ...(result.detail ? { detail: result.detail } : {}),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runReadinessProbes(
  probes: ReadonlyArray<ReadinessProbe>,
  now: () => number = Date.now,
): Promise<ReadinessCheck[]> {
  return Promise.all(probes.map((probe) => runBoundedProbe(probe, now)));
}

export function summarizeReadiness(checks: ReadonlyArray<ReadinessCheck>): ReadinessCheckStatus {
  if (checks.some((check) => check.status === 'down')) return 'down';
  if (checks.some((check) => check.status === 'degraded')) return 'degraded';
  return 'ok';
}

export function readinessHttpStatus(status: ReadinessCheckStatus): number {
  return status === 'down' ? 503 : 200;
}

export function buildReadinessReport(input: {
  readonly service: string;
  readonly checks: ReadonlyArray<ReadinessCheck>;
  readonly revision: string | null;
  readonly deploymentId: string | null;
  readonly observedAt?: Date;
}): ReadinessReport {
  return {
    service: input.service,
    status: summarizeReadiness(input.checks),
    revision: input.revision,
    deploymentId: input.deploymentId,
    observedAt: (input.observedAt ?? new Date()).toISOString(),
    checks: input.checks,
  };
}

/**
 * Minimal read-only surface of the service Supabase client used by the web
 * readiness probes. Keeping the type narrow makes it impossible for the probe
 * wiring to reach mutation helpers.
 */
export type ReadinessDatabaseReader = {
  readonly selectOne: (signal: AbortSignal) => Promise<{ error: { message: string } | null }>;
};

export type ReadinessStorageReader = {
  readonly listBuckets: () => Promise<{ error: { message: string } | null }>;
};

export type ReadinessGatewayProbeDependencies = {
  readonly url: string | undefined;
  readonly fetcher: typeof fetch;
};

export function createDatabaseProbe(
  reader: ReadinessDatabaseReader,
  timeoutMs = DEFAULT_READINESS_TIMEOUT_MS,
): ReadinessProbe {
  return {
    name: 'database',
    timeoutMs,
    run: async (signal) => {
      const { error } = await reader.selectOne(signal);
      return error ? { status: 'down', detail: 'error' } : { status: 'ok' };
    },
  };
}

export function createStorageProbe(
  reader: ReadinessStorageReader,
  timeoutMs = DEFAULT_READINESS_TIMEOUT_MS,
): ReadinessProbe {
  return {
    name: 'storage',
    timeoutMs,
    run: async () => {
      const { error } = await reader.listBuckets();
      return error ? { status: 'down', detail: 'error' } : { status: 'ok' };
    },
  };
}

/**
 * HEAD probe of a Worker `/health` endpoint. A 2xx–4xx answer proves the
 * Worker is reachable and routing; 5xx is `down`. HEAD never carries a body
 * and cannot enqueue, send, or mutate anything.
 */
export function createGatewayProbe(
  name: string,
  deps: ReadinessGatewayProbeDependencies,
  timeoutMs = DEFAULT_READINESS_TIMEOUT_MS,
): ReadinessProbe {
  return {
    name,
    timeoutMs,
    run: async (signal) => {
      const base = deps.url?.trim();
      if (!base) return { status: 'degraded', detail: 'unconfigured' };
      let target: URL;
      try {
        target = new URL('/health', base);
      } catch {
        return { status: 'degraded', detail: 'unconfigured' };
      }
      const response = await deps.fetcher(target.toString(), {
        method: 'HEAD',
        signal,
        redirect: 'manual',
        cache: 'no-store',
      });
      if (response.status >= 500) return { status: 'down', detail: `http_${response.status}` };
      return { status: 'ok' };
    },
  };
}
