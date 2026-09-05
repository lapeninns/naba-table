import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  baseEnv,
  bearerRequest,
  checkRunPayload,
  createFakeBucket,
  createInProcessCoordinator,
  HEARTBEAT_TOKEN,
  IMAGE_DIGEST,
  MONITORING_TOKEN,
  NOW_ISO,
  NOW_MS,
  signedWebhookRequest,
  WEBHOOK_SECRET,
} from './helpers/fixtures';
import { WEBHOOK_MAX_BYTES } from '../src/contracts';
import worker, { handleRequest } from '../src/index';

import type { FakeBucket, InProcessCoordinator } from './helpers/fixtures';
import type { OperationalControlEnv } from '../src/contracts';

const ORIGIN = 'https://operational-control.example.test';

type Harness = {
  readonly env: OperationalControlEnv;
  readonly bucket: FakeBucket;
  readonly coordinator: InProcessCoordinator;
};

const harnesses: InProcessCoordinator[] = [];

async function createHarness(overrides: Partial<OperationalControlEnv> = {}): Promise<Harness> {
  const env = baseEnv();
  const coordinator = await createInProcessCoordinator(env);
  harnesses.push(coordinator);
  const bucket = createFakeBucket();
  return {
    env: { ...env, COORDINATOR: coordinator.namespace, EVIDENCE_BUCKET: bucket, ...overrides },
    bucket,
    coordinator,
  };
}

function heartbeatBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
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
    ...overrides,
  });
}

const deps = { now: () => NOW_MS };

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const created of harnesses.splice(0)) created.storage.close();
});

describe('GET /health', () => {
  it('is unauthenticated liveness only', async () => {
    const { env } = await createHarness();
    const response = await handleRequest(new Request(`${ORIGIN}/health`), env, deps);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok', service: 'operational-control' });
    expect((await handleRequest(new Request(`${ORIGIN}/`), env, deps)).status).toBe(200);
    expect((await handleRequest(new Request(`${ORIGIN}/nope`), env, deps)).status).toBe(404);
    expect(
      (await handleRequest(new Request(`${ORIGIN}/health`, { method: 'POST' }), env, deps)).status,
    ).toBe(404);
  });
});

describe('GET /ready', () => {
  it('requires the monitoring bearer token', async () => {
    const { env } = await createHarness();
    expect((await handleRequest(new Request(`${ORIGIN}/ready`), env, deps)).status).toBe(401);
    expect(
      (await handleRequest(bearerRequest('/ready', 'wrong-token-with-enough-length'), env, deps))
        .status,
    ).toBe(401);
    expect(
      (
        await handleRequest(
          bearerRequest('/ready', MONITORING_TOKEN),
          { ...env, MONITORING_TOKEN: 'REPLACE_ME_MONITORING_TOKEN' },
          deps,
        )
      ).status,
    ).toBe(401);
  });

  it('returns a bounded report with the revision and check summaries only', async () => {
    const { env, coordinator } = await createHarness();
    coordinator.coordinator.recordHeartbeat(JSON.parse(heartbeatBody()), NOW_MS);
    const response = await handleRequest(bearerRequest('/ready', MONITORING_TOKEN), env, deps);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text.length).toBeLessThan(1024);
    const body = JSON.parse(text);
    expect(Object.keys(body).sort()).toEqual([
      'activeRuntime',
      'candidateRuntime',
      'checks',
      'config',
      'revision',
      'service',
      'status',
    ]);
    expect(body).toMatchObject({
      status: 'ok',
      service: 'operational-control',
      revision: { id: 'ver-1', tag: 'v1', timestamp: NOW_ISO },
      activeRuntime: 'node22',
      candidateRuntime: 'node24',
      config: { ok: true },
      checks: {
        coordinator: { ok: true, controller: { state: 'fresh', ageSeconds: 0 } },
        evidenceBucket: { ok: true, latestPresent: false },
      },
    });
    expect(text).not.toContain(MONITORING_TOKEN);
    expect(text).not.toContain(WEBHOOK_SECRET);
  });

  it('degrades to 503 when bindings or configuration are missing', async () => {
    const { env } = await createHarness();
    const noBucket = await handleRequest(
      bearerRequest('/ready', MONITORING_TOKEN),
      { ...env, EVIDENCE_BUCKET: undefined },
      deps,
    );
    expect(noBucket.status).toBe(503);
    expect(await noBucket.json()).toMatchObject({
      status: 'degraded',
      checks: { evidenceBucket: { ok: false } },
    });

    const noCoordinator = await handleRequest(
      bearerRequest('/ready', MONITORING_TOKEN),
      { ...env, COORDINATOR: undefined },
      deps,
    );
    expect(noCoordinator.status).toBe(503);

    const unconfigured = await handleRequest(
      bearerRequest('/ready', MONITORING_TOKEN),
      { ...env, GATE_WORKFLOW_ID: 'REPLACE_ME_GATE_WORKFLOW_ID' },
      deps,
    );
    expect(unconfigured.status).toBe(503);
    expect(await unconfigured.json()).toMatchObject({
      config: { ok: false, missing: ['GATE_WORKFLOW_ID'] },
    });

    const brokenCoordinator = await handleRequest(
      bearerRequest('/ready', MONITORING_TOKEN),
      {
        ...env,
        COORDINATOR: {
          idFromName: (name) => ({ toString: () => name }),
          get: () => ({ fetch: async () => new Response('down', { status: 500 }) }),
        },
      },
      deps,
    );
    expect(brokenCoordinator.status).toBe(503);
    expect(await brokenCoordinator.json()).toMatchObject({
      checks: { coordinator: { ok: false, controller: null } },
    });
  });
});

describe('POST /github/webhook', () => {
  it('accepts a signed local check run, records it, and writes redacted evidence', async () => {
    const { env, bucket, coordinator } = await createHarness();
    const request = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-accept-1',
      payload: checkRunPayload({}),
    });
    const response = await handleRequest(request, env, deps);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, candidateState: 'pending' });
    expect(coordinator.coordinator.status().candidates.pending).toBe(1);
    expect(bucket.objects.has('evidence/2026/09/04/webhook/delivery-accept-1.json')).toBe(true);
    expect(coordinator.dispatchCalls).toHaveLength(0);
  });

  it('treats a replayed delivery id as a duplicate without re-applying it', async () => {
    const { env, coordinator } = await createHarness();
    const build = () =>
      signedWebhookRequest({
        event: 'check_run',
        deliveryId: 'delivery-replay-1',
        payload: checkRunPayload({}),
      });
    expect((await handleRequest(await build(), env, deps)).status).toBe(202);
    const replay = await handleRequest(await build(), env, deps);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ accepted: false, duplicate: true });
    expect(coordinator.coordinator.status().deliveries.tracked).toBe(1);
  });

  it('rejects invalid, missing, or re-serialized-body signatures with 401', async () => {
    const { env, coordinator } = await createHarness();
    const payload = checkRunPayload({});
    const wrongSecret = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-sig-1',
      payload,
      secret: 'a-completely-different-secret-value',
    });
    expect((await handleRequest(wrongSecret, env, deps)).status).toBe(401);
    const missing = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-sig-2',
      payload,
      signatureHeader: null,
    });
    expect((await handleRequest(missing, env, deps)).status).toBe(401);
    const differentBytes = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-sig-3',
      payload,
      rawBody: JSON.stringify(payload),
      signatureBody: JSON.stringify(payload, null, 2),
    });
    expect((await handleRequest(differentBytes, env, deps)).status).toBe(401);
    const unconfiguredSecret = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-sig-4',
      payload,
    });
    expect(
      (
        await handleRequest(
          unconfiguredSecret,
          { ...env, GITHUB_WEBHOOK_SECRET: 'REPLACE_ME_GITHUB_WEBHOOK_SECRET' },
          deps,
        )
      ).status,
    ).toBe(401);
    expect(coordinator.coordinator.status().deliveries.tracked).toBe(0);
  });

  it('rejects payloads above 512 KiB before verifying anything', async () => {
    const { env, coordinator } = await createHarness();
    const oversized = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-big-1',
      payload: null,
      rawBody: JSON.stringify({ ...checkRunPayload({}), padding: 'x'.repeat(WEBHOOK_MAX_BYTES) }),
    });
    const response = await handleRequest(oversized, env, deps);
    expect(response.status).toBe(413);
    expect(coordinator.coordinator.status().deliveries.tracked).toBe(0);
  });

  it('rejects the wrong repository, the wrong app, unsupported events and invalid JSON', async () => {
    const { env } = await createHarness();
    const wrongRepo = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-repo-1',
      payload: checkRunPayload({ repositoryId: 55 }),
    });
    const wrongRepoResponse = await handleRequest(wrongRepo, env, deps);
    expect(wrongRepoResponse.status).toBe(403);
    expect(await wrongRepoResponse.json()).toEqual({ error: 'wrong_repository' });

    const wrongApp = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-app-1',
      payload: checkRunPayload({ appId: 31337 }),
    });
    const wrongAppResponse = await handleRequest(wrongApp, env, deps);
    expect(wrongAppResponse.status).toBe(403);
    expect(await wrongAppResponse.json()).toEqual({ error: 'unexpected_app' });

    const unsupported = await signedWebhookRequest({
      event: 'issues',
      deliveryId: 'delivery-evt-1',
      payload: checkRunPayload({}),
    });
    expect((await handleRequest(unsupported, env, deps)).status).toBe(400);

    const invalidJson = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-json-1',
      payload: null,
      rawBody: '{not json',
    });
    expect((await handleRequest(invalidJson, env, deps)).status).toBe(400);

    const stale = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-stale-1',
      payload: checkRunPayload({ completedAt: new Date(NOW_MS - 2 * 3_600_000).toISOString() }),
    });
    expect((await handleRequest(stale, env, deps)).status).toBe(403);
  });

  it('fails closed when the control plane vars or coordinator binding are missing', async () => {
    const { env } = await createHarness();
    const request = await signedWebhookRequest({
      event: 'check_run',
      deliveryId: 'delivery-cfg-1',
      payload: checkRunPayload({}),
    });
    expect(
      (
        await handleRequest(
          request.clone(),
          { ...env, REPOSITORY_ID: 'REPLACE_ME_REPOSITORY_ID' },
          deps,
        )
      ).status,
    ).toBe(503);
    expect((await handleRequest(request, { ...env, COORDINATOR: undefined }, deps)).status).toBe(
      503,
    );
  });
});

describe('POST /heartbeat', () => {
  it('requires the heartbeat bearer token', async () => {
    const { env } = await createHarness();
    const unauthenticated = new Request(`${ORIGIN}/heartbeat`, {
      method: 'POST',
      body: heartbeatBody(),
    });
    expect((await handleRequest(unauthenticated, env, deps)).status).toBe(401);
    const wrongToken = bearerRequest('/heartbeat', MONITORING_TOKEN, {
      method: 'POST',
      body: heartbeatBody(),
    });
    expect((await handleRequest(wrongToken, env, deps)).status).toBe(401);
  });

  it('rejects credential-like keys and malformed bodies', async () => {
    const { env, coordinator } = await createHarness();
    const withToken = bearerRequest('/heartbeat', HEARTBEAT_TOKEN, {
      method: 'POST',
      body: heartbeatBody({ githubToken: 'ghp_secret' }),
    });
    const rejected = await handleRequest(withToken, env, deps);
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toEqual({ error: 'credential_like_key' });

    const invalidJson = bearerRequest('/heartbeat', HEARTBEAT_TOKEN, { method: 'POST', body: '{' });
    expect((await handleRequest(invalidJson, env, deps)).status).toBe(400);

    const tooLarge = bearerRequest('/heartbeat', HEARTBEAT_TOKEN, {
      method: 'POST',
      body: heartbeatBody({ controllerId: 'x'.repeat(9_000) }),
    });
    expect((await handleRequest(tooLarge, env, deps)).status).toBe(413);
    expect(coordinator.coordinator.status().heartbeat.state).toBe('unknown');
  });

  it('records a valid heartbeat so readiness reflects controller freshness', async () => {
    const { env, coordinator } = await createHarness();
    const response = await handleRequest(
      bearerRequest('/heartbeat', HEARTBEAT_TOKEN, { method: 'POST', body: heartbeatBody() }),
      env,
      deps,
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ recorded: true });
    expect(coordinator.coordinator.status().heartbeat).toMatchObject({
      state: 'fresh',
      controllerId: 'mac-mini-01',
    });
    expect(coordinator.dispatchCalls).toHaveLength(0);
    expect(
      (
        await handleRequest(
          bearerRequest('/heartbeat', HEARTBEAT_TOKEN, { method: 'POST', body: heartbeatBody() }),
          { ...env, COORDINATOR: undefined },
          deps,
        )
      ).status,
    ).toBe(503);
  });
});

describe('POST /incidents/{id}/acknowledge', () => {
  it('requires the monitoring token and acknowledges known incidents once', async () => {
    const { env, coordinator } = await createHarness();
    coordinator.coordinator.applyObservations(
      [{ service: 'web', environment: 'production', failureClass: 'readiness', healthy: false }],
      NOW_MS,
    );
    expect(
      (
        await handleRequest(
          new Request(`${ORIGIN}/incidents/incident-1/acknowledge`, { method: 'POST' }),
          env,
          deps,
        )
      ).status,
    ).toBe(401);
    const acknowledged = await handleRequest(
      bearerRequest('/incidents/incident-1/acknowledge', MONITORING_TOKEN, { method: 'POST' }),
      env,
      deps,
    );
    expect(acknowledged.status).toBe(200);
    expect(await acknowledged.json()).toEqual({ acknowledged: true });
    const again = await handleRequest(
      bearerRequest('/incidents/incident-1/acknowledge', MONITORING_TOKEN, { method: 'POST' }),
      env,
      deps,
    );
    expect(again.status).toBe(404);
    expect(
      (
        await handleRequest(
          bearerRequest('/incidents/incident-1/acknowledge', MONITORING_TOKEN, { method: 'POST' }),
          { ...env, COORDINATOR: undefined },
          deps,
        )
      ).status,
    ).toBe(503);
  });
});

describe('worker entrypoints', () => {
  it('wraps fetch in request observability and runs the scheduled cycle without network access', async () => {
    const { env } = await createHarness();
    const waited: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => {
        waited.push(promise);
      },
      passThroughOnException: () => undefined,
      props: {},
    } as unknown as ExecutionContext;
    const response = await worker.fetch(new Request(`${ORIGIN}/health`), env, ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);

    const accepted = await worker.fetch(
      await signedWebhookRequest({
        event: 'check_run',
        deliveryId: 'delivery-entry-1',
        payload: checkRunPayload({ completedAt: new Date(Date.now() - 1_000).toISOString() }),
      }),
      env,
      ctx,
    );
    expect(accepted.status).toBe(202);
    expect(waited.length).toBeGreaterThan(0);
    await Promise.all(waited);

    await expect(
      worker.scheduled(
        {
          scheduledTime: NOW_MS,
          cron: '*/5 * * * *',
          noRetry: () => undefined,
        } as ScheduledController,
        { ...env, TARGETS_JSON: '[]', UPTIME_HEARTBEAT_URL: undefined },
      ),
    ).resolves.toBeUndefined();
  });
});
