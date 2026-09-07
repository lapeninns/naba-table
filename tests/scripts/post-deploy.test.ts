import { describe, expect, it, vi } from 'vitest';

import { loadMonitoringConfig } from '../../scripts/monitoring/config';
import {
  runPostDeployVerification,
  validatePostDeployEvent,
} from '../../scripts/monitoring/post-deploy';

const sha = 'a'.repeat(40);
const other = 'b'.repeat(40);
const config = loadMonitoringConfig();
const env = {
  MONITORING_TOKEN: 'private-token',
  MONITORING_GITHUB_TOKEN: 'private-github',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_REPOSITORY_ID: '1105219228',
  MONITORING_EMAIL_QUEUE_GATEWAY_BASE_URL: 'https://email.example.com',
};
const services = [
  'nabatable-web',
  'booking-short-links',
  'email-queue-gateway',
  'sms-summary-gateway',
];
const requiredChecks: Record<string, string[]> = {
  'nabatable-web': ['database', 'storage', 'email-gateway'],
  'booking-short-links': ['d1', 'kv-cache'],
  'email-queue-gateway': ['email-queue-state', 'capacity-version-state'],
  'sms-summary-gateway': ['daily-summary-queue', 'daily-summary-state'],
};
const ready = (service: string) => ({
  service,
  status: 'ok',
  revision: sha,
  checks: requiredChecks[service]!.map((name) => ({ name, status: 'ok', latencyMs: 1 })),
});
function fixture(body?: unknown, lastSha = sha) {
  let call = 0;
  return vi.fn(async () => {
    const index = call++;
    if (index === 0 || index === 5)
      return Response.json({
        name: 'main',
        protected: true,
        commit: { sha: index === 5 ? lastSha : sha },
      });
    return Response.json(index === 1 && body !== undefined ? body : ready(services[index - 1]!));
  });
}
const pushEvent = () => ({
  repository: { id: 1105219228, full_name: 'lapeninns/nabatable' },
  ref: 'refs/heads/main',
  after: sha,
  target_url: 'https://evil.example',
});
const pushEnv = { ...env, GITHUB_EVENT_NAME: 'push', GITHUB_SHA: sha };
describe('post-deployment verification', () => {
  it('checks four customer services between protected main reads', async () => {
    const fetcher = fixture();
    const result = await runPostDeployVerification({ config, env, fetcher });
    expect(result.ok).toBe(true);
    expect(result.targets).toHaveLength(4);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it.each([
    null,
    [],
    'private-token',
    { ...ready(services[0]!), status: 'degraded' },
    { ...ready(services[0]!), checks: [] },
    { ...ready(services[0]!), checks: [{ status: 'error' }] },
    { ...ready(services[0]!), revision: other },
    { ...ready(services[0]!), revision: '3f73f9fe-6501-490e-a591-62e15dad7123' },
  ])('rejects malformed/unhealthy readiness %j', async (body) => {
    const result = await runPostDeployVerification({ config, env, fetcher: fixture(body) });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private-token');
  });
  it('requires tokens before any requests', async () => {
    const fetcher = fixture();
    expect(
      (await runPostDeployVerification({ config, env: { ...env, MONITORING_TOKEN: '' }, fetcher }))
        .ok,
    ).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects changing main', async () => {
    expect(
      (await runPostDeployVerification({ config, env, fetcher: fixture(undefined, other) }))
        .failures,
    ).toContain('main_changed');
  });
  it('uses bounded GET without redirects or cache and ignores base URL overrides', async () => {
    const inner = fixture();
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      // Must stay 'manual': the Workers runtime rejects 'error' and throws on every request.
      expect(init).toMatchObject({ method: 'GET', redirect: 'manual', cache: 'no-store' });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(url).not.toContain('evil.example');
      return inner();
    });
    await runPostDeployVerification({
      config,
      env: { ...env, MONITORING_WEB_BASE_URL: 'https://evil.example' },
      fetcher,
    });
  });
  it('fails closed on redirect and raw errors', async () => {
    const normal = fixture();
    let call = 0;
    const fetcher = vi.fn(async () => {
      if (call++ === 1) throw new Error('private-token');
      return normal();
    });
    const result = await runPostDeployVerification({ config, env, fetcher });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private-token');
  });
  it('rejects missing targets and unsafe origins before requests', async () => {
    for (const modified of [
      { ...config, targets: config.targets.filter((t) => t.name !== 'web') },
      {
        ...config,
        targets: config.targets.map((t) =>
          t.name === 'web'
            ? { ...t, baseUrl: 'https://user:password@evil.example/path?q=secret' }
            : t,
        ),
      },
    ]) {
      const fetcher = fixture();
      expect((await runPostDeployVerification({ config: modified, env, fetcher })).ok).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
});
describe('required dependencies and response bounds', () => {
  it.each(
    [
      [{ name: 'arbitrary', status: 'ok' }],
      [...ready('nabatable-web').checks, ...ready('nabatable-web').checks],
      ready('nabatable-web').checks.slice(1),
    ].map((checks) => ({ checks })),
  )('rejects missing or duplicate check names %j', async ({ checks }) => {
    expect(
      (
        await runPostDeployVerification({
          config,
          env,
          fetcher: fixture({ ...ready('nabatable-web'), checks }),
        })
      ).failures,
    ).toContain('invalid_readiness');
  });
  it('permits additional healthy checks and reports observation time', async () => {
    const result = await runPostDeployVerification({
      config,
      env,
      fetcher: fixture({
        ...ready('nabatable-web'),
        checks: [...ready('nabatable-web').checks, { name: 'new-dependency', status: 'ok' }],
      }),
    });
    expect(result.ok).toBe(true);
    expect(Number.isFinite(Date.parse(result.observedAt))).toBe(true);
  });
  it.each([true, false])('rejects oversized JSON with content-length=%j', async (withLength) => {
    let signal: AbortSignal | null | undefined;
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        name: 'main',
        protected: true,
        commit: { sha },
        padding: 'x'.repeat(65536),
      }),
    );
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      signal = init?.signal;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes.slice(0, 32000));
            controller.enqueue(bytes.slice(32000));
            controller.close();
          },
        }),
        { headers: withLength ? { 'content-length': String(bytes.length) } : {} },
      );
    });
    expect((await runPostDeployVerification({ config, env, fetcher })).failures).toEqual([
      'main_unavailable',
    ]);
    expect(signal?.aborted).toBe(true);
  });
});
describe('transport and authority failures', () => {
  it('rejects redirects without following their Location', async () => {
    let calls = 0;
    const fetcher = vi.fn(async () =>
      ++calls === 1 || calls === 6
        ? Response.json({ name: 'main', protected: true, commit: { sha } })
        : new Response(null, {
            status: 302,
            headers: { Location: 'https://evil.example/private-token' },
          }),
    );
    const result = await runPostDeployVerification({ config, env, fetcher });
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('http_error');
    expect(JSON.stringify(result)).not.toContain('evil.example');
  });
  it('requires the GitHub token before requests too', async () => {
    const fetcher = fixture();
    expect(
      (
        await runPostDeployVerification({
          config,
          env: { ...env, MONITORING_GITHUB_TOKEN: '' },
          fetcher,
        })
      ).failures,
    ).toEqual(['missing_token']);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { name: 'main', protected: false, commit: { sha } },
    { name: 'feature', protected: true, commit: { sha } },
    { name: 'main', protected: true, commit: { sha: 'short' } },
  ])('requires valid protected main evidence %j', async (body) => {
    const fetcher = vi.fn(async () => Response.json(body));
    expect((await runPostDeployVerification({ config, env, fetcher })).failures).toEqual([
      'main_unavailable',
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bounds a stalled body read', async () => {
    const fetcher = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start() {} })));
    const result = await runPostDeployVerification({
      config: { ...config, timeouts: { ...config.timeouts, githubRequestMs: 5 } },
      env,
      fetcher,
    });
    expect(result.failures).toEqual(['main_unavailable']);
  });
  it('rejects forged events without making any requests', async () => {
    const fetcher = fixture();
    expect(
      (
        await runPostDeployVerification({
          config,
          env: pushEnv,
          event: { ...pushEvent(), repository: { id: 1 } },
          fetcher,
        })
      ).failures,
    ).toEqual(['untrusted_event']);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
describe('trusted event contract', () => {
  it('accepts matching protected-main push and ignores destination fields', async () => {
    expect(validatePostDeployEvent('push', pushEvent(), pushEnv, sha)).toBe(true);
    const fetcher = fixture();
    expect(
      (await runPostDeployVerification({ config, env: pushEnv, event: pushEvent(), fetcher })).ok,
    ).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it('rejects old pushes before readiness probes', async () => {
    const fetcher = fixture();
    const result = await runPostDeployVerification({
      config,
      env: { ...pushEnv, GITHUB_SHA: other },
      event: { ...pushEvent(), after: other },
      fetcher,
    });
    expect(result.failures).toEqual(['untrusted_event']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['push', 'schedule', 'workflow_dispatch'])(
    'requires main workflow ref for %s',
    (name) => {
      expect(
        validatePostDeployEvent(
          name,
          pushEvent(),
          { ...pushEnv, GITHUB_REF: 'refs/heads/feature' },
          sha,
        ),
      ).toBe(false);
      expect(
        validatePostDeployEvent(name, pushEvent(), { ...pushEnv, GITHUB_REPOSITORY_ID: '1' }, sha),
      ).toBe(false);
    },
  );
  it('rejects deployment statuses and unknown events', () => {
    expect(
      validatePostDeployEvent(
        'deployment_status',
        { deployment: { production_environment: false, ref: sha } },
        env,
        sha,
      ),
    ).toBe(false);
    expect(validatePostDeployEvent('pull_request', {}, env, sha)).toBe(false);
  });
  it('rejects wrong push repository, branch, or SHA', () => {
    for (const value of [
      { ...pushEvent(), repository: { id: 1, full_name: 'lapeninns/nabatable' } },
      { ...pushEvent(), repository: { id: 1105219228, full_name: 'evil/repo' } },
      { ...pushEvent(), ref: 'refs/heads/feature' },
      { ...pushEvent(), after: other },
      { ...pushEvent(), after: 'short' },
    ])
      expect(validatePostDeployEvent('push', value, pushEnv, sha)).toBe(false);
    expect(
      validatePostDeployEvent('push', pushEvent(), { ...pushEnv, GITHUB_SHA: other }, sha),
    ).toBe(false);
  });
});
