import { afterEach, describe, expect, it } from 'vitest';

import { createFakeFetcher, jsonResponse } from './helpers/fetch';
import {
  baseEnv,
  createFakeBucket,
  createInProcessCoordinator,
  IMAGE_DIGEST,
  MONITORING_TOKEN,
  NOW_ISO,
  NOW_MS,
} from './helpers/fixtures';
import { EVIDENCE_LATEST_KEY, HEARTBEAT_FALLBACK_AFTER_MS } from '../src/contracts';
import { createCoordinatorClient } from '../src/coordinator-client';
import { parseProbeTargets, probeTarget, runScheduledCycle } from '../src/readiness';

import type { FetchCall } from './helpers/fetch';
import type { InProcessCoordinator } from './helpers/fixtures';
import type { ProbeTarget } from '../src/contracts';

const UPTIME_URL = 'https://uptime.example.test/ping/abc';
const WEB_URL = 'https://app.example.test/api/ready';
const LINKS_URL = 'https://go.example.test/ready';

const harnesses: InProcessCoordinator[] = [];
afterEach(() => {
  for (const created of harnesses.splice(0)) created.storage.close();
});

async function healthyHarness(options: { heartbeat?: boolean } = {}) {
  const env = baseEnv({ UPTIME_HEARTBEAT_URL: UPTIME_URL });
  const created = await createInProcessCoordinator(env);
  harnesses.push(created);
  if (options.heartbeat !== false) {
    created.coordinator.recordHeartbeat(
      {
        controllerId: 'mac-mini-01',
        controllerVersion: '1.4.0',
        imageDigest: IMAGE_DIGEST,
        activeRuntime: 'node22',
        candidateRuntime: 'node24',
        status: 'idle',
        sentAt: NOW_ISO,
        queueDepth: 0,
        running: 0,
        maxConcurrent: 2,
      },
      NOW_MS,
    );
  }
  const bucket = createFakeBucket();
  bucket.objects.set(
    EVIDENCE_LATEST_KEY,
    JSON.stringify({ writtenAt: new Date(NOW_MS - 60_000).toISOString() }),
  );
  const coordinator = createCoordinatorClient(
    created.namespace.get(created.namespace.idFromName('primary')),
  );
  return { created, bucket, coordinator, env: { ...env, EVIDENCE_BUCKET: bucket } };
}

function okFetcher(statuses: Partial<Record<string, number>> = {}) {
  const logs: string[] = [];
  const fake = createFakeFetcher((call) => {
    const status = statuses[call.url] ?? 200;
    return jsonResponse({ status: status === 200 ? 'ok' : 'down' }, status);
  });
  return { ...fake, logs };
}

describe('probe target parsing', () => {
  it('accepts a bounded list of https readiness URLs', () => {
    const result = parseProbeTargets(baseEnv().TARGETS_JSON);
    expect(result).toEqual({
      ok: true,
      targets: [
        { name: 'web', environment: 'production', url: WEB_URL },
        { name: 'booking-short-links', environment: 'production', url: LINKS_URL },
      ],
    });
  });

  it('fails closed on placeholders and malformed definitions', () => {
    const target = (overrides: Record<string, unknown>) =>
      JSON.stringify([{ name: 'web', environment: 'production', url: WEB_URL, ...overrides }]);
    const cases: readonly [string | undefined, string][] = [
      [undefined, 'targets_unconfigured'],
      ['   ', 'targets_unconfigured'],
      ['REPLACE_ME_TARGETS', 'targets_invalid_json'],
      ['{', 'targets_invalid_json'],
      ['[]', 'targets_empty'],
      ['{}', 'targets_empty'],
      [JSON.stringify(Array.from({ length: 11 }, () => ({}))), 'targets_too_many'],
      ['[1]', 'target_shape_invalid'],
      [target({ name: 'Web Prod' }), 'target_name_invalid'],
      [target({ environment: 'qa' }), 'target_environment_invalid'],
      [target({ url: 'https://REPLACE_ME_HOST/ready' }), 'target_url_placeholder'],
      [target({ url: 'http://app.example.test/ready' }), 'target_url_invalid'],
      [target({ url: 'https://app.example.test/ready?token=x' }), 'target_url_invalid'],
      [target({ url: 'https://user:pw@app.example.test/ready' }), 'target_url_invalid'],
      [target({ url: 'not a url' }), 'target_url_invalid'],
      [
        JSON.stringify([
          { name: 'web', environment: 'production', url: WEB_URL },
          { name: 'web', environment: 'production', url: LINKS_URL },
        ]),
        'target_duplicate',
      ],
    ];
    for (const [raw, reason] of cases) {
      expect(parseProbeTargets(raw)).toEqual({ ok: false, reason });
    }
  });
});

describe('readiness probes', () => {
  const target: ProbeTarget = { name: 'web', environment: 'production', url: WEB_URL };

  it('calls an injected Workers fetch without an object receiver', async () => {
    let outboundCalls = 0;
    const fetcher: typeof fetch = async function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation');
      outboundCalls += 1;
      return new Response('ok');
    };
    const result = await probeTarget({
      target,
      monitoringToken: MONITORING_TOKEN,
      fetcher,
      now: () => NOW_MS,
    });
    expect(result).toMatchObject({ healthy: true, status: 200, failureClass: null });
    expect(outboundCalls).toBe(1);
  });

  it.each([
    ['https://app.example.test', WEB_URL, 'staging', true],
    ['https://app.example.test/', WEB_URL, 'staging', true],
    ['https://app.example.test', WEB_URL, 'production', false],
    ['https://app.example.test', LINKS_URL, 'staging', false],
    ['https://app.example.test', 'https://app.example.test.evil.test/ready', 'staging', false],
    ['https://app.example.test', 'https://app.example.test:8443/ready', 'staging', false],
    ['https://app.example.test', 'http://app.example.test/ready', 'staging', false],
    ['http://app.example.test', WEB_URL, 'staging', false],
    ['https://user:pw@app.example.test', WEB_URL, 'staging', false],
    ['https://app.example.test/path', WEB_URL, 'staging', false],
    ['https://app.example.test?token=x', WEB_URL, 'staging', false],
    ['https://app.example.test#hash', WEB_URL, 'staging', false],
    ['invalid', WEB_URL, 'staging', false],
    [undefined, WEB_URL, 'staging', false],
  ] as const)(
    'scopes automation bypass for %s and %s (%s)',
    async (origin, url, environment, expected) => {
      const fake = okFetcher();
      await probeTarget({
        target: { name: 'web', environment, url },
        monitoringToken: MONITORING_TOKEN,
        vercelAutomationBypassOrigin: origin,
        vercelAutomationBypassSecret: 'synthetic-bypass-secret',
        fetcher: fake.fetcher,
        now: () => NOW_MS,
      });
      expect(fake.calls[0]?.headers.get('x-vercel-protection-bypass')).toBe(
        expected ? 'synthetic-bypass-secret' : null,
      );
      expect(fake.calls[0]?.redirect).toBe('manual');
    },
  );

  it.each([undefined, '', 'REPLACE_ME_BYPASS'])(
    'omits an unconfigured bypass secret (%s)',
    async (secret) => {
      const fake = okFetcher();
      await probeTarget({
        target: { ...target, environment: 'staging' },
        monitoringToken: MONITORING_TOKEN,
        vercelAutomationBypassOrigin: 'https://app.example.test',
        vercelAutomationBypassSecret: secret,
        fetcher: fake.fetcher,
        now: () => NOW_MS,
      });
      expect(fake.calls[0]?.headers.get('x-vercel-protection-bypass')).toBeNull();
    },
  );

  it('issues a GET with the monitoring bearer, no redirects, and classifies the outcome', async () => {
    const healthy = okFetcher();
    await expect(
      probeTarget({
        target,
        monitoringToken: MONITORING_TOKEN,
        fetcher: healthy.fetcher,
        now: () => NOW_MS,
      }),
    ).resolves.toEqual({
      name: 'web',
      environment: 'production',
      healthy: true,
      status: 200,
      durationMs: 0,
      failureClass: null,
    });
    const call = healthy.calls[0] as FetchCall;
    expect(call.method).toBe('GET');
    expect(call.redirect).toBe('manual');
    expect(call.headers.get('authorization')).toBe(`Bearer ${MONITORING_TOKEN}`);

    const degraded = okFetcher({ [WEB_URL]: 503 });
    await expect(
      probeTarget({
        target,
        monitoringToken: MONITORING_TOKEN,
        fetcher: degraded.fetcher,
        now: () => NOW_MS,
      }),
    ).resolves.toMatchObject({ healthy: false, status: 503, failureClass: 'unhealthy_status' });

    const timeout = createFakeFetcher(() => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      throw error;
    });
    await expect(
      probeTarget({
        target,
        monitoringToken: MONITORING_TOKEN,
        fetcher: timeout.fetcher,
        now: () => NOW_MS,
      }),
    ).resolves.toMatchObject({ healthy: false, status: null, failureClass: 'timeout' });

    const network = createFakeFetcher(() => {
      throw new TypeError('fetch failed');
    });
    await expect(
      probeTarget({
        target,
        monitoringToken: MONITORING_TOKEN,
        fetcher: network.fetcher,
        now: () => NOW_MS,
      }),
    ).resolves.toMatchObject({ healthy: false, status: null, failureClass: 'network' });
  });
});

describe('scheduled control cycle', () => {
  it('pings the uptime URL only after every check in the cycle passed', async () => {
    const { env, coordinator, bucket } = await healthyHarness();
    const fetch = okFetcher();
    const logs: string[] = [];
    const report = await runScheduledCycle({
      env,
      coordinator,
      fetcher: fetch.fetcher,
      now: () => NOW_MS,
      sink: (record) => logs.push(record),
    });
    expect(report.valid).toBe(true);
    expect(report.invalidReasons).toEqual([]);
    expect(report.uptimePinged).toBe(true);
    expect(report.heartbeat.state).toBe('fresh');
    expect(report.fallbackEligible).toBe(false);
    expect(report.activeRuntime).toBe('node22');
    expect(report.candidateRuntime).toBe('node24');
    expect(fetch.calls.map((call) => call.url)).toEqual([WEB_URL, LINKS_URL, UPTIME_URL]);
    expect(fetch.calls.every((call) => call.method === 'GET')).toBe(true);
    const uptimeCall = fetch.calls[2] as FetchCall;
    expect(uptimeCall.headers.get('authorization')).toBeNull();
    expect([...bucket.objects.keys()].some((key) => key.includes('/cycle/'))).toBe(true);
    expect(logs.some((line) => line.includes('scheduled.cycle_completed'))).toBe(true);
    expect(logs.join('\n')).not.toContain(MONITORING_TOKEN);
  });

  it('keeps bypass secrets and provider error details out of cycle evidence and logs', async () => {
    const { env, coordinator, bucket } = await healthyHarness();
    const secret = 'synthetic-bypass-secret-never-persist';
    const fake = createFakeFetcher((call) => {
      if (call.url === WEB_URL) throw new Error(`provider echoed ${secret}`);
      return jsonResponse({ status: 'ok' });
    });
    const logs: string[] = [];
    const report = await runScheduledCycle({
      env: {
        ...env,
        TARGETS_JSON: JSON.stringify([
          { name: 'web', environment: 'staging', url: WEB_URL },
          { name: 'links', environment: 'staging', url: LINKS_URL },
        ]),
        VERCEL_AUTOMATION_BYPASS_ORIGIN: 'https://app.example.test',
        VERCEL_AUTOMATION_BYPASS_SECRET: secret,
      },
      coordinator,
      fetcher: fake.fetcher,
      now: () => NOW_MS,
      sink: (record) => logs.push(record),
    });
    expect(fake.calls[0]?.headers.get('x-vercel-protection-bypass')).toBe(secret);
    expect(fake.calls[1]?.headers.get('x-vercel-protection-bypass')).toBeNull();
    expect(report.valid).toBe(false);
    expect(report.probes[0]?.failureClass).toBe('network');
    for (const value of [JSON.stringify(report), logs.join('\n'), ...bucket.objects.values()]) {
      expect(value).not.toContain(secret);
      expect(value).not.toContain('provider echoed');
      expect(value).not.toContain('x-vercel-protection-bypass');
    }
  });

  it('withholds the uptime ping when a target is unhealthy and opens an incident', async () => {
    const { env, coordinator } = await healthyHarness();
    const fetch = okFetcher({ [WEB_URL]: 503 });
    const report = await runScheduledCycle({
      env,
      coordinator,
      fetcher: fetch.fetcher,
      now: () => NOW_MS,
    });
    expect(report.valid).toBe(false);
    expect(report.uptimePinged).toBe(false);
    expect(report.invalidReasons).toEqual(['probe_unhealthy:production/web', 'active_incidents']);
    expect(report.activeIncidents).toBe(1);
    expect(fetch.calls.map((call) => call.url)).not.toContain(UPTIME_URL);
    const status = await coordinator.status();
    expect(status.incidents.active[0]).toMatchObject({
      service: 'web',
      environment: 'production',
      failureClass: 'readiness',
    });
  });

  it('withholds the uptime ping when the controller heartbeat is missing, stale or fallback-eligible', async () => {
    const missing = await healthyHarness({ heartbeat: false });
    const first = await runScheduledCycle({
      env: missing.env,
      coordinator: missing.coordinator,
      fetcher: okFetcher().fetcher,
      now: () => NOW_MS,
    });
    expect(first.uptimePinged).toBe(false);
    expect(first.invalidReasons).toEqual(['controller_heartbeat_unknown', 'active_incidents']);

    const stale = await healthyHarness();
    const nowMs = NOW_MS + HEARTBEAT_FALLBACK_AFTER_MS;
    stale.created.clock.nowMs = nowMs;
    stale.bucket.objects.set(
      EVIDENCE_LATEST_KEY,
      JSON.stringify({ writtenAt: new Date(nowMs - 60_000).toISOString() }),
    );
    const second = await runScheduledCycle({
      env: stale.env,
      coordinator: stale.coordinator,
      fetcher: okFetcher().fetcher,
      now: () => nowMs,
    });
    expect(second.uptimePinged).toBe(false);
    expect(second.fallbackEligible).toBe(true);
    expect(second.heartbeat.state).toBe('fallback_eligible');
    expect(second.invalidReasons).toContain('controller_heartbeat_fallback_eligible');
  });

  it('withholds the uptime ping when evidence is missing or stale', async () => {
    const { env, coordinator, bucket } = await healthyHarness();
    bucket.objects.delete(EVIDENCE_LATEST_KEY);
    const missing = await runScheduledCycle({
      env,
      coordinator,
      fetcher: okFetcher().fetcher,
      now: () => NOW_MS,
    });
    expect(missing.uptimePinged).toBe(false);
    expect(missing.invalidReasons).toEqual(['evidence_missing']);
    // The cycle itself refreshed the pointer, so the next cycle is valid.
    const next = okFetcher();
    const second = await runScheduledCycle({
      env,
      coordinator,
      fetcher: next.fetcher,
      now: () => NOW_MS + 1,
    });
    expect(second.valid).toBe(true);
    expect(second.uptimePinged).toBe(true);
  });

  it('reports configuration gaps without probing anything', async () => {
    const { env, coordinator } = await healthyHarness();
    const fetch = okFetcher();
    const report = await runScheduledCycle({
      env: { ...env, MONITORING_TOKEN: undefined, TARGETS_JSON: '[]', REPOSITORY_ID: 'REPLACE_ME' },
      coordinator: null,
      fetcher: fetch.fetcher,
      now: () => NOW_MS,
    });
    expect(fetch.calls).toHaveLength(0);
    expect(report.valid).toBe(false);
    expect(report.invalidReasons).toEqual([
      'unconfigured:REPOSITORY_ID',
      'targets_empty',
      'monitoring_token_unconfigured',
      'coordinator_unconfigured',
      'controller_heartbeat_unknown',
    ]);
    expect(report.tick).toBeNull();
    void coordinator;
  });

  it('logs rather than pings when the uptime URL is unconfigured or the ping fails', async () => {
    const unconfigured = await healthyHarness();
    const logs: string[] = [];
    const first = await runScheduledCycle({
      env: { ...unconfigured.env, UPTIME_HEARTBEAT_URL: 'REPLACE_ME_UPTIME_URL' },
      coordinator: unconfigured.coordinator,
      fetcher: okFetcher().fetcher,
      now: () => NOW_MS,
      sink: (record) => logs.push(record),
    });
    expect(first.valid).toBe(true);
    expect(first.uptimePinged).toBe(false);
    expect(logs.some((line) => line.includes('scheduled.uptime_unconfigured'))).toBe(true);

    const failing = await healthyHarness();
    const second = await runScheduledCycle({
      env: failing.env,
      coordinator: failing.coordinator,
      fetcher: okFetcher({ [UPTIME_URL]: 500 }).fetcher,
      now: () => NOW_MS,
    });
    expect(second.valid).toBe(true);
    expect(second.uptimePinged).toBe(false);

    const httpUptime = await healthyHarness();
    const third = await runScheduledCycle({
      env: { ...httpUptime.env, UPTIME_HEARTBEAT_URL: 'http://uptime.example.test/ping' },
      coordinator: httpUptime.coordinator,
      fetcher: okFetcher().fetcher,
      now: () => NOW_MS,
    });
    expect(third.uptimePinged).toBe(false);
  });

  it('treats a failing coordinator as an invalid cycle', async () => {
    const { env } = await healthyHarness();
    const broken = createCoordinatorClient({
      fetch: async () => new Response('down', { status: 500 }),
    });
    const logs: string[] = [];
    const report = await runScheduledCycle({
      env,
      coordinator: broken,
      fetcher: okFetcher().fetcher,
      now: () => NOW_MS,
      sink: (record) => logs.push(record),
    });
    expect(report.uptimePinged).toBe(false);
    expect(report.invalidReasons).toContain('coordinator_unavailable');
    expect(logs.some((line) => line.includes('scheduled.coordinator_unavailable'))).toBe(true);
  });
});
