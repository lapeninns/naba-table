/**
 * Shared Worker readiness helper. Each Worker mounts `GET /ready` through
 * {@link handleReadinessRequest}; `/health` stays unauthenticated and
 * unchanged. Every probe is bounded by a timeout and read-only: `select 1`
 * against D1, a KV read of a sentinel key, a queue binding presence check, and
 * a read-only Durable Object ping.
 */

export type ReadinessStatus = 'ok' | 'degraded' | 'down';

export type ReadinessDetail = 'timeout' | 'unconfigured' | 'error' | `http_${number}`;

export type ReadinessCheck = {
  readonly name: string;
  readonly status: ReadinessStatus;
  readonly latencyMs: number;
  readonly detail?: ReadinessDetail;
};

export type ReadinessProbeResult = {
  readonly status: ReadinessStatus;
  readonly detail?: ReadinessDetail;
};

export type ReadinessProbe = {
  readonly name: string;
  readonly timeoutMs?: number;
  readonly run: (signal: AbortSignal) => Promise<ReadinessProbeResult>;
};

export type ReadinessReport = {
  readonly service: string;
  readonly status: ReadinessStatus;
  readonly revision: string | null;
  readonly deploymentId: string | null;
  readonly versionTag: string | null;
  readonly observedAt: string;
  readonly checks: ReadonlyArray<ReadinessCheck>;
};

export type ReadinessEnv = {
  readonly MONITORING_TOKEN?: string;
  readonly DEPLOY_SHA?: string;
  readonly CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
};

export const DEFAULT_READINESS_TIMEOUT_MS = 1_500;

const TEXT_ENCODER = new TextEncoder();

/**
 * Constant-time comparison that does not depend on `node:crypto`, so it runs
 * in every Worker regardless of `nodejs_compat`. The loop always walks the
 * longer input and folds the length difference into the result.
 */
export function constantTimeEquals(left: string, right: string): boolean {
  const a = TEXT_ENCODER.encode(left);
  const b = TEXT_ENCODER.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

export function isAuthorizedReadinessRequest(
  request: Request,
  expectedToken: string | undefined,
): boolean {
  const expected = expectedToken?.trim() ?? '';
  if (expected.length === 0) return false;
  const header = request.headers.get('authorization') ?? '';
  const supplied = /^Bearer\s+([^\s]+)\s*$/iu.exec(header)?.[1] ?? '';
  if (supplied.length === 0) return false;
  return constantTimeEquals(expected, supplied);
}

export async function runReadinessProbe(
  probe: ReadinessProbe,
  now: () => number = Date.now,
): Promise<ReadinessCheck> {
  const startedAt = now();
  const controller = new AbortController();
  const timeoutMs = probe.timeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ReadinessProbeResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ status: 'degraded', detail: 'timeout' });
    }, timeoutMs);
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

export function summarizeReadiness(checks: ReadonlyArray<ReadinessCheck>): ReadinessStatus {
  if (checks.some((check) => check.status === 'down')) return 'down';
  if (checks.some((check) => check.status === 'degraded')) return 'degraded';
  return 'ok';
}

export function resolveWorkerRevision(env: ReadinessEnv): {
  revision: string | null;
  deploymentId: string | null;
  versionTag: string | null;
} {
  const deploySha = env.DEPLOY_SHA?.trim() || null;
  const versionId = env.CF_VERSION_METADATA?.id?.trim() || null;
  const versionTag = env.CF_VERSION_METADATA?.tag?.trim() || null;
  return {
    revision: deploySha ?? versionId,
    deploymentId: versionId,
    versionTag,
  };
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function isReadinessRequest(request: Request): boolean {
  if (request.method !== 'GET') return false;
  return new URL(request.url).pathname === '/ready';
}

/**
 * Handles `GET /ready`. Fails closed: an unconfigured `MONITORING_TOKEN` or a
 * missing/invalid bearer yields a generic 401 without running any probe.
 */
export async function handleReadinessRequest(input: {
  readonly request: Request;
  readonly env: ReadinessEnv;
  readonly service: string;
  readonly probes: ReadonlyArray<ReadinessProbe>;
  readonly now?: () => number;
}): Promise<Response> {
  if (!isAuthorizedReadinessRequest(input.request, input.env.MONITORING_TOKEN)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const now = input.now ?? Date.now;
  const checks = await Promise.all(input.probes.map((probe) => runReadinessProbe(probe, now)));
  const status = summarizeReadiness(checks);
  const report: ReadinessReport = {
    service: input.service,
    status,
    ...resolveWorkerRevision(input.env),
    observedAt: new Date(now()).toISOString(),
    checks,
  };
  return jsonResponse(report, status === 'down' ? 503 : 200);
}

// --- Probe builders -------------------------------------------------------

export type D1ReadBinding = {
  readonly prepare: (query: string) => {
    readonly bind: (...args: unknown[]) => { readonly first: <T>() => Promise<T | null> };
  };
};

export function createD1Probe(
  db: D1ReadBinding | undefined,
  options: { readonly name?: string; readonly timeoutMs?: number } = {},
): ReadinessProbe {
  return {
    name: options.name ?? 'd1',
    timeoutMs: options.timeoutMs,
    run: async () => {
      if (!db) return { status: 'down', detail: 'unconfigured' };
      await db.prepare('select 1 as ready').bind().first();
      return { status: 'ok' };
    },
  };
}

export type KvReadBinding = {
  readonly get: (key: string, type: 'json') => Promise<unknown>;
};

export const READINESS_SENTINEL_KEY = 'readiness:sentinel';

export function createKvProbe(
  kv: KvReadBinding | undefined,
  options: { readonly name?: string; readonly key?: string; readonly timeoutMs?: number } = {},
): ReadinessProbe {
  return {
    name: options.name ?? 'kv',
    timeoutMs: options.timeoutMs,
    run: async () => {
      if (!kv) return { status: 'degraded', detail: 'unconfigured' };
      await kv.get(options.key ?? READINESS_SENTINEL_KEY, 'json');
      return { status: 'ok' };
    },
  };
}

export function createQueueBindingProbe(
  queue: { readonly send: unknown } | undefined,
  options: { readonly name?: string } = {},
): ReadinessProbe {
  return {
    name: options.name ?? 'queue',
    timeoutMs: 100,
    run: async () =>
      queue && typeof queue.send === 'function'
        ? { status: 'ok' }
        : { status: 'down', detail: 'unconfigured' },
  };
}

export type DurableObjectPingBinding<Id = unknown> = {
  readonly idFromName: (name: string) => Id;
  readonly get: (id: Id) => {
    readonly fetch: (request: Request) => Promise<Response>;
  };
};

export function createDurableObjectProbe<Id>(
  binding: DurableObjectPingBinding<Id> | undefined,
  options: {
    readonly name?: string;
    readonly objectName?: string;
    readonly path?: string;
    readonly timeoutMs?: number;
  } = {},
): ReadinessProbe {
  return {
    name: options.name ?? 'durable-object',
    timeoutMs: options.timeoutMs,
    run: async (signal) => {
      if (!binding) return { status: 'down', detail: 'unconfigured' };
      const stub = binding.get(binding.idFromName(options.objectName ?? 'readiness'));
      const response = await stub.fetch(
        new Request(`https://durable-object.internal${options.path ?? '/health'}`, {
          method: 'GET',
          signal,
        }),
      );
      if (response.status >= 500) return { status: 'down', detail: `http_${response.status}` };
      return { status: 'ok' };
    },
  };
}
