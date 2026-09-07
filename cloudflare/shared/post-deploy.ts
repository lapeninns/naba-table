/** Runtime-neutral readiness observation; callers must establish and recheck protected-main authority. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
const REQUIRED_CHECKS = {
  'nabatable-web': ['database', 'storage', 'email-gateway'],
  'booking-short-links': ['d1', 'kv-cache'],
  'email-queue-gateway': ['email-queue-state', 'capacity-version-state'],
  'sms-summary-gateway': ['daily-summary-queue', 'daily-summary-state'],
} as const;
const MAX_RESPONSE_BYTES = 64 * 1024;
export type Service = keyof typeof REQUIRED_CHECKS;
export type Diagnostic =
  | 'ok'
  | 'missing_token'
  | 'invalid_config'
  | 'untrusted_event'
  | 'main_unavailable'
  | 'main_changed'
  | 'request_failed'
  | 'http_error'
  | 'invalid_readiness'
  | 'revision_mismatch';
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function fullSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
}

function validChecks(value: unknown, service: Service): boolean {
  if (!Array.isArray(value)) return false;
  const names = new Set<string>();
  for (const entry of value) {
    const check = record(entry);
    if (
      typeof check.name !== 'string' ||
      !check.name.trim() ||
      check.status !== 'ok' ||
      names.has(check.name)
    )
      return false;
    names.add(check.name);
  }
  return REQUIRED_CHECKS[service].every((name) => names.has(name));
}

export async function requestPostDeployJson(
  fetcher: Fetcher,
  url: string,
  token: string,
  timeout: number,
): Promise<{ status: number; body: unknown } | null> {
  // The timeout covers response headers AND body consumption, including injected fetchers in tests.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, {
          method: 'GET',
          // Cloudflare Workers refuses redirect: 'error' outright ("won't be implemented since it
          // does not make sense at the edge; use \"manual\" and check the response status code")
          // and that refusal throws on every request, which made this engine fail for all callers
          // in the Workers runtime while still working under Node. Redirects are refused below by
          // status instead, so both runtimes fail closed and neither follows a Location header.
          redirect: 'manual',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${token}`,
            accept: 'application/json',
            'cache-control': 'no-cache',
            'user-agent': 'nabatable-post-deploy',
            'x-github-api-version': '2022-11-28',
          },
        });
        const redirected =
          response.redirected || (response.status >= 300 && response.status < 400);
        if (response.status !== 200 || redirected)
          return { status: redirected ? 302 : response.status, body: null };
        const length = response.headers.get('content-length');
        if (length !== null && (!/^\d+$/u.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
          controller.abort();
          void response.body?.cancel().catch(() => {});
          return null;
        }
        if (!response.body) return null;
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            size += next.value.byteLength;
            if (size > MAX_RESPONSE_BYTES) {
              controller.abort();
              void reader.cancel().catch(() => {});
              return null;
            }
            chunks.push(next.value);
          }
        } finally {
          reader.releaseLock();
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return {
          status: response.status,
          body: JSON.parse(
            new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
          ) as unknown,
        };
      })(),
      new Promise<null>((resolve) => {
        timer = setTimeout(
          () => {
            controller.abort();
            resolve(null);
          },
          Math.min(30_000, Math.max(1, timeout)),
        );
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type ObservationDependencies = {
  expectedRepository: string;
  expectedSha: string;
  targets: ReadonlyArray<{ service: string; url: string }>;
  token: string;
  fetcher: Fetcher;
  timeoutMs: number;
};
export type ObservationResult = {
  ok: boolean;
  observedAt: string;
  expectedSha: string | null;
  targets: Array<{ service: Service; status: Diagnostic; observedSha: string | null }>;
  failures: Diagnostic[];
};
function validatedTargets(
  targets: ObservationDependencies['targets'],
): Array<{ service: Service; url: string }> | null {
  const services = Object.keys(REQUIRED_CHECKS) as Service[];
  if (targets.length !== services.length) return null;
  const result: Array<{ service: Service; url: string }> = [];
  for (const service of services) {
    const matches = targets.filter((target) => target.service === service);
    const target = matches[0];
    if (matches.length !== 1 || !target) return null;
    try {
      const url = new URL(target.url);
      const path = service === 'nabatable-web' ? '/api/ready' : '/ready';
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== path ||
        target.url.includes('?') ||
        target.url.includes('#') ||
        target.url !== `${url.origin}${path}`
      )
        return null;
      result.push({ service, url: target.url });
    } catch {
      return null;
    }
  }
  return result;
}
export async function observePostDeployment(
  deps: ObservationDependencies,
): Promise<ObservationResult> {
  const result: ObservationResult = {
    ok: false,
    observedAt: new Date().toISOString(),
    expectedSha: fullSha(deps.expectedSha) ? deps.expectedSha : null,
    targets: [],
    failures: [],
  };
  if (!deps.token.trim()) {
    result.failures.push('missing_token');
    return result;
  }
  const targets = validatedTargets(deps.targets);
  if (
    deps.expectedRepository !== 'lapeninns/nabatable' ||
    !result.expectedSha ||
    !targets ||
    !Number.isFinite(deps.timeoutMs) ||
    deps.timeoutMs <= 0
  ) {
    result.failures.push('invalid_config');
    return result;
  }
  result.targets = await Promise.all(
    targets.map(async (target) => {
      const response = await requestPostDeployJson(
        deps.fetcher,
        target.url,
        deps.token,
        deps.timeoutMs,
      );
      const body = record(response?.body);
      const observedSha = fullSha(body.revision) ? body.revision : null;
      let status: Diagnostic = 'ok';
      if (!response) status = 'request_failed';
      else if (response.status !== 200) status = 'http_error';
      else if (
        body.service !== target.service ||
        body.status !== 'ok' ||
        !validChecks(body.checks, target.service)
      )
        status = 'invalid_readiness';
      else if (observedSha !== deps.expectedSha) status = 'revision_mismatch';
      return { service: target.service, status, observedSha };
    }),
  );
  for (const target of result.targets)
    if (target.status !== 'ok' && !result.failures.includes(target.status))
      result.failures.push(target.status);
  result.ok = result.failures.length === 0;
  return result;
}
