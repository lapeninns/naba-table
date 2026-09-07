import { afterEach, describe, expect, it, vi } from 'vitest';

import { MONITORING_TOKEN, NOW_MS } from './helpers/fixtures';
import {
  DEPLOYMENT_LATEST_KEY,
  PRODUCTION_TARGETS,
  runDeploymentObservation,
  writeDeploymentEvidence,
} from '../src/deployment-verification';
import { createAppJwt } from '../src/github';
import worker, { handleRequest } from '../src/index';
import { runScheduledCycle } from '../src/readiness';

import type { EvidenceBucket, OperationalControlEnv } from '../src/contracts';
import type { DeploymentEvidence } from '../src/deployment-verification';

vi.mock('../src/github', () => ({
  createAppJwt: vi.fn(async () => 'test-app-jwt'),
}));
vi.mock('../src/readiness', () => ({ runScheduledCycle: vi.fn(async () => undefined) }));
const sha = 'a'.repeat(40);
const token = 'test-installation-token';
function bucket() {
  const objects = new Map<string, { value: string; etag: string }>();
  let version = 0;
  const storage: EvidenceBucket = {
    async put(key, value, options) {
      const current = objects.get(key);
      if (options?.onlyIf?.etagMatches && current?.etag !== options.onlyIf.etagMatches) return null;
      if (options?.onlyIf?.etagDoesNotMatch === '*' && current) return null;
      const next = { value, etag: String(++version) };
      objects.set(key, next);
      return next;
    },
    async head(key) {
      const item = objects.get(key);
      return item ? { uploaded: new Date(NOW_MS), size: item.value.length } : null;
    },
    async get(key) {
      const item = objects.get(key);
      return item
        ? { etag: item.etag, size: item.value.length, text: async () => item.value }
        : null;
    },
  };
  return { storage, objects };
}
function env(storage: EvidenceBucket): OperationalControlEnv {
  return {
    EVIDENCE_BUCKET: storage,
    POST_DEPLOY_OBSERVER_ENABLED: 'true',
    DEPLOYMENT_ENVIRONMENT: 'production',
    REPOSITORY_ID: '1105219228',
    PROTECTED_REF: 'refs/heads/main',
    GITHUB_DISPATCH_APP_ID: '123',
    GITHUB_DISPATCH_INSTALLATION_ID: '456',
    GITHUB_DISPATCH_APP_PRIVATE_KEY: 'test-only-key',
    MONITORING_TOKEN,
  };
}
function network(overrides: { mint?: unknown; branch?: unknown; revokeStatus?: number } = {}) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/access_tokens'))
      return Response.json(
        overrides.mint ?? {
          token,
          expires_at: new Date(NOW_MS + 3600000).toISOString(),
          permissions: { contents: 'read', metadata: 'read' },
          repositories: [{ id: 1105219228, full_name: 'lapeninns/nabatable' }],
        },
        { status: 201 },
      );
    if (url.endsWith('/installation/token'))
      return new Response(null, { status: overrides.revokeStatus ?? 204 });
    if (url.endsWith('/branches/main'))
      return Response.json(overrides.branch ?? { name: 'main', protected: true, commit: { sha } });
    const target = PRODUCTION_TARGETS.find((item) => item.url === url);
    if (!target) throw new Error('Unexpected test URL');
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${MONITORING_TOKEN}`);
    const checks = {
      'nabatable-web': ['database', 'storage', 'email-gateway'],
      'booking-short-links': ['d1', 'kv-cache'],
      'email-queue-gateway': ['email-queue-state', 'capacity-version-state'],
      'sms-summary-gateway': ['daily-summary-queue', 'daily-summary-state'],
    };
    return Response.json({
      status: 'ok',
      service: target.service,
      revision: sha,
      checks: checks[target.service].map((name) => ({ name, status: 'ok' })),
    });
  });
}
afterEach(() => vi.restoreAllMocks());
describe('hourly production deployment observation', () => {
  it('does no external work when disabled, staging, or outside the hourly slot', async () => {
    const { storage } = bucket();
    const fetcher = network();
    for (const overrides of [
      { POST_DEPLOY_OBSERVER_ENABLED: undefined },
      { POST_DEPLOY_OBSERVER_ENABLED: 'false' },
      { DEPLOYMENT_ENVIRONMENT: 'staging' },
    ]) {
      await runDeploymentObservation({
        env: { ...env(storage), ...overrides },
        scheduledTime: NOW_MS,
        now: () => NOW_MS,
        fetcher,
      });
    }
    await runDeploymentObservation({
      env: env(storage),
      scheduledTime: NOW_MS + 300000,
      now: () => NOW_MS,
      fetcher,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([2000, 59999])(
    'observes the hourly UTC minute with a %ims delivery offset',
    async (offset) => {
      const { storage, objects } = bucket();
      const scheduledTime = NOW_MS + offset;
      const fetcher = network();
      await runDeploymentObservation({
        env: env(storage),
        scheduledTime,
        now: () => scheduledTime,
        fetcher,
      });
      expect(fetcher).toHaveBeenCalled();
      expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value)).toMatchObject({
        ok: true,
        scheduledAt: new Date(scheduledTime).toISOString(),
      });
    },
  );
  it('uses the scheduled minute for a delivery delayed into minute 05', async () => {
    const { storage, objects } = bucket();
    const scheduledTime = NOW_MS + 2000;
    const observedTime = scheduledTime + 300000;
    await runDeploymentObservation({
      env: env(storage),
      scheduledTime,
      now: () => observedTime,
      fetcher: network(),
    });
    expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value)).toMatchObject({
      ok: true,
      scheduledAt: new Date(scheduledTime).toISOString(),
      observedAt: new Date(observedTime).toISOString(),
    });
  });
  it.each([60000, 300000, -1000])(
    'skips outside UTC minute 00 at an offset of %ims',
    async (offset) => {
      const { storage, objects } = bucket();
      const fetcher = network();
      await runDeploymentObservation({
        env: env(storage),
        scheduledTime: NOW_MS + offset,
        now: () => NOW_MS,
        fetcher,
      });
      expect(fetcher).not.toHaveBeenCalled();
      expect(objects.size).toBe(0);
    },
  );
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'skips nonfinite scheduled time %s',
    async (scheduledTime) => {
      const { storage, objects } = bucket();
      const fetcher = network();
      await runDeploymentObservation({
        env: env(storage),
        scheduledTime,
        now: () => NOW_MS,
        fetcher,
      });
      expect(fetcher).not.toHaveBeenCalled();
      expect(objects.size).toBe(0);
    },
  );
  it('mints only contents read for the sole repository, checks main twice and revokes', async () => {
    const { storage, objects } = bucket();
    const fetcher = network();
    await runDeploymentObservation({
      env: env(storage),
      scheduledTime: NOW_MS,
      now: () => NOW_MS,
      fetcher,
    });
    const mint = fetcher.mock.calls.find(([url]) => String(url).endsWith('/access_tokens'));
    expect(JSON.parse(String(mint?.[1]?.body))).toEqual({
      repository_ids: [1105219228],
      permissions: { contents: 'read' },
    });
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).endsWith('/branches/main')),
    ).toHaveLength(2);
    expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe('DELETE');
    expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value)).toMatchObject({
      ok: true,
      expectedSha: sha,
      schemaVersion: 1,
    });
    expect([...objects.keys()].filter((key) => key.includes('/history/'))).toHaveLength(1);
    expect(JSON.stringify([...objects.values()])).not.toContain(token);
  });
  it.each([
    { permissions: { contents: 'write', metadata: 'read' } },
    { permissions: { contents: 'read', metadata: 'read', actions: 'write' } },
    {
      repositories: [
        { id: 1105219228, full_name: 'lapeninns/nabatable' },
        { id: 1, full_name: 'another/repo' },
      ],
    },
    { expires_at: new Date(NOW_MS - 1).toISOString() },
  ])('revokes even when minted scope is rejected: %j', async (invalid) => {
    const { storage, objects } = bucket();
    const fetcher = network({
      mint: {
        token,
        expires_at: new Date(NOW_MS + 3600000).toISOString(),
        permissions: { contents: 'read', metadata: 'read' },
        repositories: [{ id: 1105219228, full_name: 'lapeninns/nabatable' }],
        ...invalid,
      },
    });
    await runDeploymentObservation({
      env: env(storage),
      scheduledTime: NOW_MS,
      now: () => NOW_MS,
      fetcher,
    });
    expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe('DELETE');
    expect(fetcher.mock.calls).toHaveLength(2);
    expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value)).toMatchObject({
      ok: false,
      failures: ['invalid_token_scope'],
    });
  });
  it('fails closed if branch is unprotected and records redacted revoke failures', async () => {
    const { storage, objects } = bucket();
    await runDeploymentObservation({
      env: env(storage),
      scheduledTime: NOW_MS,
      now: () => NOW_MS,
      fetcher: network({
        branch: { name: 'main', protected: false, commit: { sha } },
        revokeStatus: 500,
      }),
    });
    const result = objects.get(DEPLOYMENT_LATEST_KEY)!.value;
    expect(JSON.parse(result)).toMatchObject({
      ok: false,
      failures: ['main_unavailable', 'github_token_revoke_failed'],
    });
    expect(result).not.toContain(token);
  });
  it('attributes an unusable dispatch configuration without any external call', async () => {
    const { storage, objects } = bucket();
    const fetcher = network();
    await runDeploymentObservation({
      env: { ...env(storage), GITHUB_DISPATCH_APP_ID: 'not-numeric' },
      scheduledTime: NOW_MS,
      now: () => NOW_MS,
      fetcher,
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value)).toMatchObject({
      ok: false,
      expectedSha: null,
      failures: ['invalid_config'],
    });
  });
  it('attributes a JWT signing failure before the mint request', async () => {
    const { storage, objects } = bucket();
    const fetcher = network();
    vi.mocked(createAppJwt).mockRejectedValueOnce(new Error('bad private key material'));
    await runDeploymentObservation({
      env: env(storage),
      scheduledTime: NOW_MS,
      now: () => NOW_MS,
      fetcher,
    });
    expect(fetcher).not.toHaveBeenCalled();
    const stored = objects.get(DEPLOYMENT_LATEST_KEY)!.value;
    expect(JSON.parse(stored).failures).toEqual(['github_jwt_failed']);
    // The thrown message must never reach stored evidence.
    expect(stored).not.toContain('bad private key material');
  });
  it('attributes a mint response that carries no token, with nothing to revoke', async () => {
    const { storage, objects } = bucket();
    const fetcher = network({
      mint: {
        expires_at: new Date(NOW_MS + 3600000).toISOString(),
        permissions: { contents: 'read', metadata: 'read' },
        repositories: [{ id: 1105219228, full_name: 'lapeninns/nabatable' }],
      },
    });
    await runDeploymentObservation({
      env: env(storage),
      scheduledTime: NOW_MS,
      now: () => NOW_MS,
      fetcher,
    });
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value).failures).toEqual([
      'github_token_absent',
    ]);
  });
  it('keeps the generic reason for a failed readback so the two main reads stay distinct', async () => {
    const { storage, objects } = bucket();
    let branchReads = 0;
    const base = network();
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).endsWith('/branches/main') && ++branchReads === 2)
        return new Response(null, { status: 500 });
      return base(input, init);
    });
    await runDeploymentObservation({
      env: env(storage),
      scheduledTime: NOW_MS,
      now: () => NOW_MS,
      fetcher,
    });
    const stored = JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value);
    expect(stored.expectedSha).toBe(sha);
    expect(stored.failures).toEqual(['github_observation_failed']);
  });
});

function healthyEvidence(time = NOW_MS): DeploymentEvidence {
  return {
    schemaVersion: 1,
    repository: 'lapeninns/nabatable',
    environment: 'production',
    scheduledAt: new Date(time).toISOString(),
    observedAt: new Date(time).toISOString(),
    expectedSha: sha,
    ok: true,
    failures: [],
    targets: PRODUCTION_TARGETS.map(({ service }) => ({ service, status: 'ok', observedSha: sha })),
  };
}
describe('cached deployment evidence', () => {
  it('keeps history without letting an older completion overwrite latest', async () => {
    const { storage, objects } = bucket();
    await writeDeploymentEvidence(storage, healthyEvidence(NOW_MS));
    await writeDeploymentEvidence(storage, healthyEvidence(NOW_MS - 3600000));
    expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value).scheduledAt).toBe(
      new Date(NOW_MS).toISOString(),
    );
    expect(objects.size).toBe(3);
  });
  it('retries a lost compare-and-swap and preserves the concurrent newer write', async () => {
    const { storage, objects } = bucket();
    await writeDeploymentEvidence(storage, healthyEvidence(NOW_MS - 3600000));
    const originalPut = storage.put;
    let raced = false;
    storage.put = async (key, value, options) => {
      if (key === DEPLOYMENT_LATEST_KEY && !raced) {
        raced = true;
        await originalPut(key, JSON.stringify(healthyEvidence(NOW_MS + 3600000)));
      }
      return originalPut(key, value, options);
    };
    await writeDeploymentEvidence(storage, healthyEvidence(NOW_MS));
    expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value).scheduledAt).toBe(
      new Date(NOW_MS + 3600000).toISOString(),
    );
  });
  it('requires monitoring auth, exposes cached evidence, and has no POST route', async () => {
    const { storage } = bucket();
    await writeDeploymentEvidence(storage, healthyEvidence());
    const target = 'https://control.example.test/deployment-verification';
    const request = new Request(target, {
      headers: { authorization: `Bearer ${MONITORING_TOKEN}` },
    });
    expect((await handleRequest(new Request(target), env(storage))).status).toBe(401);
    expect(
      (await handleRequest(new Request(target, { method: 'POST' }), env(storage))).status,
    ).toBe(404);
    const result = await handleRequest(request, env(storage), { now: () => NOW_MS });
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(await result.json()).toMatchObject({
      cached: true,
      ageSeconds: 0,
      evidence: { ok: true },
    });
  });
  it.each([
    { observedAt: new Date(NOW_MS + 1).toISOString() },
    {
      observedAt: new Date(NOW_MS - 76 * 60000).toISOString(),
      scheduledAt: new Date(NOW_MS - 76 * 60000).toISOString(),
    },
    { targets: healthyEvidence().targets.slice(1) },
    { schemaVersion: 2 },
    { unexpectedSecret: 'must-not-escape' },
    { ok: true, failures: ['revision_mismatch'] },
  ])('rejects stale, future or malformed stored evidence: %j', async (changes) => {
    const { storage } = bucket();
    await storage.put(DEPLOYMENT_LATEST_KEY, JSON.stringify({ ...healthyEvidence(), ...changes }));
    const result = await handleRequest(
      new Request('https://control.example.test/deployment-verification', {
        headers: { authorization: `Bearer ${MONITORING_TOKEN}` },
      }),
      env(storage),
      { now: () => NOW_MS },
    );
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain('must-not-escape');
  });
  it('rejects an oversized stored object without consuming its body', async () => {
    const { storage } = bucket();
    const text = vi.fn(async () => '{}');
    storage.get = async () => ({ etag: '1', size: 20000, text });
    const result = await handleRequest(
      new Request('https://control.example.test/deployment-verification', {
        headers: { authorization: `Bearer ${MONITORING_TOKEN}` },
      }),
      env(storage),
      { now: () => NOW_MS },
    );
    expect(result.status).toBe(503);
    expect(text).not.toHaveBeenCalled();
  });
});

describe('bounded transport and current main', () => {
  it('records main advancement between probes and final readback', async () => {
    const { storage, objects } = bucket();
    const normal = network();
    let branchReads = 0;
    const fetcher: typeof fetch = async (url, init) => {
      if (String(url).endsWith('/branches/main') && ++branchReads === 2)
        return Response.json({ name: 'main', protected: true, commit: { sha: 'b'.repeat(40) } });
      return normal(url, init);
    };
    await runDeploymentObservation({
      env: env(storage),
      scheduledTime: NOW_MS,
      now: () => NOW_MS,
      fetcher,
    });
    expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value)).toMatchObject({
      ok: false,
      failures: ['main_changed'],
    });
  });
  it('bounds token response bodies', async () => {
    const { storage, objects } = bucket();
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response('x'.repeat(65537), { status: 201 }),
    );
    await runDeploymentObservation({
      env: env(storage),
      scheduledTime: NOW_MS,
      now: () => NOW_MS,
      fetcher,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value).ok).toBe(false);
  });
  it('bounds stalled token responses without leaking transport errors', async () => {
    vi.useFakeTimers();
    try {
      const { storage, objects } = bucket();
      const fetcher = vi.fn<typeof fetch>(async () => new Promise<Response>(() => {}));
      const pending = runDeploymentObservation({
        env: env(storage),
        scheduledTime: NOW_MS,
        now: () => NOW_MS,
        fetcher,
      });
      await vi.advanceTimersByTimeAsync(5001);
      await pending;
      expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value).failures).toEqual([
        'github_token_mint_failed',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('scheduled failure isolation', () => {
  it('observes deployments despite a legacy heartbeat/coordinator cycle rejection', async () => {
    const { storage, objects } = bucket();
    vi.mocked(runScheduledCycle).mockRejectedValueOnce(new Error('legacy-failure-sensitive-text'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetcher = network();
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
    try {
      await expect(
        worker.scheduled(
          {
            scheduledTime: NOW_MS,
            cron: '*/5 * * * *',
            noRetry: () => undefined,
          } as ScheduledController,
          env(storage),
        ),
      ).rejects.toThrow('One or more scheduled cycles failed.');
      expect(JSON.parse(objects.get(DEPLOYMENT_LATEST_KEY)!.value).ok).toBe(true);
      expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(
        'legacy-failure-sensitive-text',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('still runs the legacy cycle when evidence storage fails', async () => {
    const { storage } = bucket();
    storage.put = async () => {
      throw new Error('storage-failure-sensitive-text');
    };
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', network());
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
    vi.mocked(runScheduledCycle).mockClear();
    try {
      await expect(
        worker.scheduled(
          {
            scheduledTime: NOW_MS,
            cron: '*/5 * * * *',
            noRetry: () => undefined,
          } as ScheduledController,
          env(storage),
        ),
      ).rejects.toThrow('One or more scheduled cycles failed.');
      expect(runScheduledCycle).toHaveBeenCalledOnce();
      expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(
        'storage-failure-sensitive-text',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
