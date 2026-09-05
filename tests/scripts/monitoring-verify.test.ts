import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { listAlertKeys, loadMonitoringConfig } from '@/scripts/monitoring/config';
import {
  classifyFreshness,
  parseVerifyArgs,
  probeTarget,
  runMonitoringVerification,
} from '@/scripts/monitoring/verify';

import type { MonitoringConfig } from '@/scripts/monitoring/config';
import type { MonitoringFetch, VerifyDependencies } from '@/scripts/monitoring/verify';

const TOKEN = 'ops-monitoring-token-with-at-least-thirty-two-chars';
const GITHUB_TOKEN = 'github_pat_fake_monitoring_token_value';
const HEARTBEAT_URL = 'https://heartbeat.example.test/api/push/abc123';
const EMAIL_GATEWAY_URL = 'https://email-gateway.example.test';
const OPERATIONAL_CONTROL_URL = 'https://operational-control.example.test';
const NOW = new Date('2026-09-05T00:00:00.000Z');

const config = loadMonitoringConfig();
const alertKeys = listAlertKeys(readFileSync('config/observability/alerts.yaml', 'utf8'));

type Call = { url: string; init: RequestInit | undefined };

type FakeOptions = {
  readonly readiness?: Partial<Record<string, { status?: number; body?: unknown; reject?: Error }>>;
  readonly backupAgeHours?: number | null;
  readonly drillAgeDays?: number | null;
  readonly protection?: { status?: number; contexts?: string[] };
  readonly heartbeatStatus?: number;
};

function serviceForOrigin(cfg: MonitoringConfig, origin: string): string | null {
  for (const target of cfg.targets) {
    if (target.kind === 'github') continue;
    const base =
      target.name === 'email-queue-gateway'
        ? EMAIL_GATEWAY_URL
        : target.name === 'operational-control-worker'
          ? OPERATIONAL_CONTROL_URL
          : target.baseUrl;
    if (base && new URL(base).origin === origin) return target.service;
  }
  return null;
}

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

function createFetcher(options: FakeOptions = {}): { fetcher: MonitoringFetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: MonitoringFetch = async (url, init) => {
    calls.push({ url, init });
    const parsed = new URL(url);
    if (url.startsWith(HEARTBEAT_URL)) {
      return new Response('OK', { status: options.heartbeatStatus ?? 200 });
    }
    if (parsed.origin === 'https://api.github.com') {
      if (parsed.pathname.endsWith('/protection/required_status_checks')) {
        const status = options.protection?.status ?? 200;
        return new Response(
          JSON.stringify({
            contexts: options.protection?.contexts ?? ['Release gate', 'Local CI / pr'],
          }),
          { status },
        );
      }
      const match = /\/actions\/workflows\/([^/]+)\/runs/u.exec(parsed.pathname);
      const workflow = decodeURIComponent(match?.[1] ?? '');
      const age =
        workflow === 'backup.yml'
          ? options.backupAgeHours === undefined
            ? 2
            : options.backupAgeHours
          : options.drillAgeDays === undefined
            ? 5 * 24
            : options.drillAgeDays === null
              ? null
              : options.drillAgeDays * 24;
      if (age === null) return new Response(JSON.stringify({ workflow_runs: [] }), { status: 200 });
      return new Response(
        JSON.stringify({
          workflow_runs: [{ conclusion: 'success', run_started_at: hoursAgo(age) }],
        }),
        { status: 200 },
      );
    }
    const service = serviceForOrigin(config, parsed.origin);
    if (!service) return new Response('not found', { status: 404 });
    const override = options.readiness?.[service];
    if (override?.reject) throw override.reject;
    // The control-plane Worker reports checks as a keyed map of `{ ok }` records and its
    // revision as the Workers version metadata object, not the shared array shape.
    const controlPlaneBody = {
      service,
      status: 'ok',
      revision: { id: 'ver-1', tag: 'v1', timestamp: NOW.toISOString() },
      checks: {
        coordinator: { ok: true, controller: { state: 'fresh', ageSeconds: 30 } },
        evidenceBucket: { ok: true, latestPresent: true },
      },
    };
    const body =
      override?.body ??
      (service === 'operational-control'
        ? controlPlaneBody
        : {
            service,
            status: 'ok',
            revision: `${service}-sha`,
            deploymentId: `${service}-dpl`,
            checks: [{ name: 'primary', status: 'ok', latencyMs: 12 }],
          });
    return new Response(JSON.stringify(body), { status: override?.status ?? 200 });
  };
  return { fetcher, calls };
}

function deps(
  fetcher: MonitoringFetch,
  overrides: Partial<VerifyDependencies> = {},
  env: Record<string, string | undefined> = {},
): VerifyDependencies {
  return {
    config,
    env: {
      MONITORING_TOKEN: TOKEN,
      MONITORING_GITHUB_TOKEN: GITHUB_TOKEN,
      MONITORING_HEARTBEAT_URL: HEARTBEAT_URL,
      MONITORING_EMAIL_QUEUE_GATEWAY_BASE_URL: EMAIL_GATEWAY_URL,
      MONITORING_OPERATIONAL_CONTROL_BASE_URL: OPERATIONAL_CONTROL_URL,
      ...env,
    },
    fetcher,
    now: () => NOW,
    workflowFileExists: () => true,
    alertKeys,
    ...overrides,
  };
}

function heartbeatCalls(calls: Call[]): Call[] {
  return calls.filter((call) => call.url.startsWith(HEARTBEAT_URL));
}

describe('ops:verify', () => {
  it('passes a fully healthy cycle and sends exactly one heartbeat afterwards', async () => {
    const { fetcher, calls } = createFetcher();
    const result = await runMonitoringVerification(deps(fetcher));

    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.runtime).toMatchObject({ activeRuntime: 'node22', candidateRuntime: 'node24' });
    expect(result.targets.map((target) => [target.name, target.status])).toEqual([
      ['web', 'ok'],
      ['booking-short-links', 'ok'],
      ['email-queue-gateway', 'ok'],
      ['sms-summary-gateway', 'ok'],
      ['operational-control-worker', 'ok'],
    ]);
    expect(result.targets[4]).toMatchObject({
      service: 'operational-control',
      revision: null,
      checks: [
        { name: 'coordinator', status: 'ok', latencyMs: null },
        { name: 'evidenceBucket', status: 'ok', latencyMs: null },
      ],
    });
    expect(result.targets[0]).toMatchObject({
      revision: 'nabatable-web-sha',
      deploymentId: 'nabatable-web-dpl',
      intervalMs: 300_000,
      httpStatus: 200,
    });
    expect(result.evidence).toMatchObject({
      backup: { status: 'fresh', ageHours: 2 },
      drill: { status: 'fresh' },
      missingWorkflowFiles: [],
      missingAlertRefs: [],
    });
    expect(result.requiredChecks).toEqual({ status: 'ok', missingContexts: [] });
    expect(result.heartbeat).toEqual({ configured: true, sent: true });

    const heartbeats = heartbeatCalls(calls);
    expect(heartbeats).toHaveLength(1);
    expect(heartbeats[0]?.init).toMatchObject({ method: 'GET' });
    expect(calls.indexOf(heartbeats[0]!)).toBe(calls.length - 1);

    const readyCalls = calls.filter((call) => /\/(api\/)?ready$/u.test(new URL(call.url).pathname));
    expect(readyCalls).toHaveLength(5);
    for (const call of readyCalls) {
      expect(new Headers(call.init?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
      expect(call.init).toMatchObject({ method: 'GET', redirect: 'manual' });
    }
    expect(readyCalls.map((call) => call.url)).toContain(`${EMAIL_GATEWAY_URL}/ready`);
    expect(readyCalls.map((call) => call.url)).toContain(`${OPERATIONAL_CONTROL_URL}/ready`);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain(GITHUB_TOKEN);
    expect(serialized).not.toContain(HEARTBEAT_URL);
    expect(serialized).not.toContain('api.github.com');
  });

  it('withholds the heartbeat and exits non-zero when a target is down', async () => {
    const { fetcher, calls } = createFetcher({
      readiness: {
        'booking-short-links': {
          status: 503,
          body: {
            service: 'booking-short-links',
            status: 'down',
            revision: 'x',
            deploymentId: 'y',
            checks: [{ name: 'd1', status: 'down', latencyMs: 1 }],
          },
        },
      },
    });
    const result = await runMonitoringVerification(deps(fetcher));

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(['target booking-short-links readiness down']);
    expect(result.targets[1]).toMatchObject({ status: 'down', httpStatus: 503 });
    expect(heartbeatCalls(calls)).toHaveLength(0);
    expect(result.heartbeat).toEqual({ configured: true, sent: false });
  });

  it('fails closed when the operational-control Worker origin is not configured', async () => {
    const { fetcher, calls } = createFetcher();
    const result = await runMonitoringVerification(
      deps(fetcher, {}, { MONITORING_OPERATIONAL_CONTROL_BASE_URL: undefined }),
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(['target operational-control-worker readiness unconfigured']);
    expect(result.targets[4]).toMatchObject({
      name: 'operational-control-worker',
      status: 'unconfigured',
      httpStatus: null,
    });
    expect(calls.some((call) => call.url.includes('operational-control'))).toBe(false);
    expect(heartbeatCalls(calls)).toHaveLength(0);
  });

  it('treats a 503 control-plane answer as down and rejects malformed check maps', async () => {
    const { fetcher: notReady } = createFetcher({
      readiness: {
        'operational-control': {
          status: 503,
          body: {
            service: 'operational-control',
            status: 'degraded',
            revision: null,
            checks: {
              coordinator: { ok: true, controller: null },
              evidenceBucket: { ok: false, latestPresent: false },
            },
          },
        },
      },
    });
    const down = await runMonitoringVerification(deps(notReady));
    expect(down.ok).toBe(false);
    expect(down.failures).toEqual(['target operational-control-worker readiness down']);
    expect(down.targets[4]).toMatchObject({
      status: 'down',
      httpStatus: 503,
      checks: [
        { name: 'coordinator', status: 'ok', latencyMs: null },
        { name: 'evidenceBucket', status: 'down', latencyMs: null },
      ],
    });

    const { fetcher: malformed } = createFetcher({
      readiness: {
        'operational-control': {
          body: {
            service: 'operational-control',
            status: 'ok',
            checks: { coordinator: { ready: 'yes' } },
          },
        },
      },
    });
    const invalid = await runMonitoringVerification(deps(malformed));
    expect(invalid.failures).toEqual(['target operational-control-worker readiness invalid']);
  });

  it('refuses to probe without MONITORING_TOKEN and never sends a heartbeat', async () => {
    const { fetcher, calls } = createFetcher();
    const result = await runMonitoringVerification(deps(fetcher, {}, { MONITORING_TOKEN: '  ' }));

    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      'MONITORING_TOKEN is not configured; refusing to probe readiness',
    );
    expect(result.targets.every((target) => target.status === 'unconfigured')).toBe(true);
    expect(calls.filter((call) => !call.url.startsWith('https://api.github.com'))).toEqual([]);
    expect(heartbeatCalls(calls)).toHaveLength(0);
  });

  it('marks evidence unknown and fails closed when the GitHub token is missing', async () => {
    const { fetcher, calls } = createFetcher();
    const result = await runMonitoringVerification(
      deps(fetcher, {}, { MONITORING_GITHUB_TOKEN: undefined }),
    );

    expect(result.ok).toBe(false);
    expect(result.evidence.backup.status).toBe('unknown');
    expect(result.evidence.drill.status).toBe('unknown');
    expect(result.requiredChecks.status).toBe('unavailable');
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'MONITORING_GITHUB_TOKEN is not configured; evidence freshness is unknown',
        'backup evidence is unknown',
        'drill evidence is unknown',
        'required checks configuration could not be read',
      ]),
    );
    expect(calls.some((call) => call.url.startsWith('https://api.github.com'))).toBe(false);
    expect(heartbeatCalls(calls)).toHaveLength(0);
  });

  it('classifies unauthorized, timeout, error, and invalid readiness answers as failures', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    const { fetcher, calls } = createFetcher({
      readiness: {
        'nabatable-web': { status: 401, body: { error: 'Unauthorized' } },
        'booking-short-links': { reject: timeout },
        'email-queue-gateway': { reject: new Error('ECONNRESET') },
        'sms-summary-gateway': {
          body: { service: 'some-other-service', status: 'ok', checks: [] },
        },
      },
    });
    const result = await runMonitoringVerification(deps(fetcher));

    expect(result.targets.map((target) => target.status)).toEqual([
      'unauthorized',
      'timeout',
      'error',
      'invalid',
      'ok',
    ]);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'target web readiness unauthorized',
        'target booking-short-links readiness timeout',
        'target email-queue-gateway readiness error',
        'target sms-summary-gateway readiness invalid',
      ]),
    );
    expect(heartbeatCalls(calls)).toHaveLength(0);
  });

  it('treats degraded targets and warning-band evidence as warnings that keep the cycle valid', async () => {
    const { fetcher, calls } = createFetcher({
      readiness: {
        'nabatable-web': {
          body: {
            service: 'nabatable-web',
            status: 'degraded',
            revision: 'r',
            deploymentId: 'd',
            checks: [{ name: 'email-gateway', status: 'degraded', latencyMs: 2001 }],
          },
        },
      },
      backupAgeHours: 20,
      drillAgeDays: 25,
    });
    const result = await runMonitoringVerification(deps(fetcher));

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'target web is degraded',
        'backup evidence is approaching its limit (20h old)',
        'drill evidence is approaching its limit (600h old)',
      ]),
    );
    expect(result.evidence.backup.status).toBe('warning');
    expect(result.evidence.drill.status).toBe('warning');
    expect(heartbeatCalls(calls)).toHaveLength(1);
  });

  it('fails on stale backups, missing drills, missing workflow files, and missing required checks', async () => {
    const { fetcher, calls } = createFetcher({
      backupAgeHours: 25,
      drillAgeDays: null,
      protection: { contexts: ['Release gate'] },
    });
    const result = await runMonitoringVerification(
      deps(fetcher, { workflowFileExists: (file) => file !== 'operational-verification.yml' }),
    );

    expect(result.ok).toBe(false);
    expect(result.evidence.backup.status).toBe('stale');
    expect(result.evidence.drill.status).toBe('missing');
    expect(result.evidence.missingWorkflowFiles).toEqual(['operational-verification.yml']);
    expect(result.requiredChecks).toEqual({
      status: 'missing',
      missingContexts: ['Local CI / pr'],
    });
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'backup evidence is stale',
        'drill evidence is missing',
        'required workflow file missing: operational-verification.yml',
        'required checks missing: Local CI / pr',
      ]),
    );
    expect(heartbeatCalls(calls)).toHaveLength(0);
  });

  it('fails when a threshold references an unknown alert key', async () => {
    const { fetcher } = createFetcher();
    const result = await runMonitoringVerification(
      deps(fetcher, { alertKeys: new Set(['nabatable-web.latency']) }),
    );
    expect(result.ok).toBe(false);
    expect(result.evidence.missingAlertRefs).toContain(
      'queueAge -> email-queue-gateway.queueHealth',
    );
  });

  it('downgrades unreadable branch protection to a warning only when enforcement is off', async () => {
    const { fetcher: strict } = createFetcher({ protection: { status: 404 } });
    const enforced = await runMonitoringVerification(deps(strict));
    expect(enforced.ok).toBe(false);
    expect(enforced.failures).toContain('required checks configuration could not be read');

    const relaxed: MonitoringConfig = {
      ...config,
      requiredChecks: { ...config.requiredChecks, enforce: false },
    };
    const { fetcher, calls } = createFetcher({ protection: { status: 404 } });
    const result = await runMonitoringVerification(deps(fetcher, { config: relaxed }));
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('required checks configuration could not be read');
    expect(heartbeatCalls(calls)).toHaveLength(1);
  });

  it('reports the heartbeat as unsent when the uptime endpoint rejects it and honours skipHeartbeat', async () => {
    const failing = createFetcher({ heartbeatStatus: 500 });
    const result = await runMonitoringVerification(deps(failing.fetcher));
    expect(result.ok).toBe(true);
    expect(result.heartbeat).toEqual({ configured: true, sent: false });
    expect(result.warnings).toContain('heartbeat delivery failed');

    const skipped = createFetcher();
    const skippedResult = await runMonitoringVerification(
      deps(skipped.fetcher, { skipHeartbeat: true }),
    );
    expect(skippedResult.ok).toBe(true);
    expect(heartbeatCalls(skipped.calls)).toHaveLength(0);

    const unconfigured = createFetcher();
    const unconfiguredResult = await runMonitoringVerification(
      deps(unconfigured.fetcher, {}, { MONITORING_HEARTBEAT_URL: 'http://insecure.example.test' }),
    );
    expect(unconfiguredResult.heartbeat).toEqual({ configured: false, sent: false });
    expect(unconfiguredResult.warnings).toContain('heartbeat URL is not configured');
    expect(heartbeatCalls(unconfigured.calls)).toHaveLength(0);
  });

  it('probeTarget rejects non-https and env-overridden base URLs safely', async () => {
    const web = config.targets.find((target) => target.name === 'web')!;
    const fetcher = vi.fn<MonitoringFetch>(async () => new Response('{}', { status: 200 }));
    const unconfigured = await probeTarget(
      web,
      { config, env: { MONITORING_WEB_BASE_URL: 'http://plain.example.test' }, fetcher },
      TOKEN,
    );
    expect(unconfigured.status).toBe('unconfigured');
    expect(fetcher).not.toHaveBeenCalled();

    const overridden = await probeTarget(
      web,
      {
        config,
        env: { MONITORING_WEB_BASE_URL: 'https://staging.example.test/ignored/path' },
        fetcher,
      },
      TOKEN,
    );
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://staging.example.test/api/ready');
    expect(overridden.status).toBe('invalid');
  });

  it('classifies evidence freshness at the boundaries', () => {
    const base = { workflowFile: 'backup.yml', now: NOW, warningHours: 18, maxHours: 24 };
    expect(
      classifyFreshness({ ...base, lookup: { status: 'found', at: hoursAgo(18) } }).status,
    ).toBe('fresh');
    expect(
      classifyFreshness({ ...base, lookup: { status: 'found', at: hoursAgo(18.01) } }).status,
    ).toBe('warning');
    expect(
      classifyFreshness({ ...base, lookup: { status: 'found', at: hoursAgo(24.01) } }).status,
    ).toBe('stale');
    expect(classifyFreshness({ ...base, lookup: { status: 'missing', at: null } }).status).toBe(
      'missing',
    );
    expect(classifyFreshness({ ...base, lookup: { status: 'unknown', at: null } }).status).toBe(
      'unknown',
    );
    expect(classifyFreshness({ ...base, lookup: { status: 'found', at: 'garbage' } }).status).toBe(
      'unknown',
    );
  });

  it('parses CLI arguments and rejects unknown flags', () => {
    expect(parseVerifyArgs([])).toMatchObject({
      configPath: 'config/observability/monitoring.yaml',
      alertsPath: 'config/observability/alerts.yaml',
      workflowsDir: '.github/workflows',
      skipHeartbeat: false,
    });
    expect(
      parseVerifyArgs([
        '--config',
        'x.yaml',
        '--skip-heartbeat',
        '--json',
        '--workflows-dir',
        'wf',
      ]),
    ).toMatchObject({ configPath: 'x.yaml', skipHeartbeat: true, workflowsDir: 'wf' });
    expect(() => parseVerifyArgs(['--bogus'])).toThrow(/Unknown argument/u);
  });
});
