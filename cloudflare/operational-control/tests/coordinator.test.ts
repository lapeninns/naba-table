import { afterEach, describe, expect, it } from 'vitest';

import {
  baseEnv,
  createInProcessCoordinator,
  HEAD_SHA,
  IMAGE_DIGEST,
  NOW_ISO,
  NOW_MS,
  REQUIRED_WORKFLOWS,
  tuple,
} from './helpers/fixtures';
import {
  DELIVERY_DEDUP_TTL_MS,
  DISPATCH_MAX_ATTEMPTS,
  DISPATCH_RETRY_SCHEDULE_MS,
  HEARTBEAT_ALERT_AFTER_MS,
  HEARTBEAT_FALLBACK_AFTER_MS,
  INCIDENT_ESCALATION_AFTER_MS,
} from '../src/contracts';
import { computeCandidateKey, heartbeatStateFor } from '../src/coordinator';
import { GitHubConfigurationError, GitHubTransportError } from '../src/github';

import type { InProcessCoordinator } from './helpers/fixtures';
import type {
  CiRequestTuple,
  ControllerHeartbeat,
  HealthObservation,
  WebhookDelivery,
} from '../src/contracts';

let deliveries = 0;
const nextDeliveryId = (): string => `delivery-${String((deliveries += 1)).padStart(6, '0')}`;

function localCheckDelivery(
  t: CiRequestTuple = tuple(),
  overrides: Partial<Extract<WebhookDelivery['event'], { type: 'local_check' }>> = {},
  deliveryId = nextDeliveryId(),
): WebhookDelivery {
  return {
    deliveryId,
    eventType: 'check_run',
    event: {
      type: 'local_check',
      tuple: t,
      checkRunId: 9001,
      name: `Local CI / ${t.profile}`,
      status: 'completed',
      conclusion: 'success',
      occurredAt: NOW_ISO,
      ...overrides,
    },
  };
}

function hostedRunDelivery(
  path: string,
  overrides: Partial<Extract<WebhookDelivery['event'], { type: 'hosted_run' }>> = {},
  deliveryId = nextDeliveryId(),
): WebhookDelivery {
  const index = REQUIRED_WORKFLOWS.indexOf(path as (typeof REQUIRED_WORKFLOWS)[number]);
  return {
    deliveryId,
    eventType: 'workflow_run',
    event: {
      type: 'hosted_run',
      headSha: HEAD_SHA,
      workflowPath: path,
      workflowId: 7000 + index,
      runId: 500 + index,
      runAttempt: 1,
      status: 'completed',
      conclusion: 'success',
      occurredAt: NOW_ISO,
      ...overrides,
    },
  };
}

function pullRequestDelivery(action: string, headSha = HEAD_SHA): WebhookDelivery {
  return {
    deliveryId: nextDeliveryId(),
    eventType: 'pull_request',
    event: { type: 'pull_request', action, prNumber: 42, headSha, occurredAt: NOW_ISO },
  };
}

function heartbeat(): ControllerHeartbeat {
  return {
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
  };
}

const observation = (healthy: boolean, service = 'web'): HealthObservation => ({
  service,
  environment: 'production',
  failureClass: 'readiness',
  healthy,
});

async function seedReadyCandidate(harness: InProcessCoordinator, t: CiRequestTuple = tuple()) {
  await harness.coordinator.recordDelivery(localCheckDelivery(t), harness.clock.nowMs);
  for (const path of REQUIRED_WORKFLOWS) {
    await harness.coordinator.recordDelivery(hostedRunDelivery(path), harness.clock.nowMs);
  }
}

const harnesses: InProcessCoordinator[] = [];
async function harness(deps: Parameters<typeof createInProcessCoordinator>[1] = {}) {
  const created = await createInProcessCoordinator(baseEnv(), deps);
  harnesses.push(created);
  return created;
}

afterEach(() => {
  for (const created of harnesses.splice(0)) created.storage.close();
});

describe('coordinator coalescing', () => {
  it('queues exactly one gate dispatch per candidate tuple once local and hosted signals complete', async () => {
    const h = await harness();
    const local = await h.coordinator.recordDelivery(localCheckDelivery(), h.clock.nowMs);
    expect(local).toMatchObject({ duplicate: false, candidateState: 'pending' });
    expect(local.candidateKey).toBe(await computeCandidateKey(tuple()));

    for (const path of REQUIRED_WORKFLOWS.slice(0, -1)) {
      await h.coordinator.recordDelivery(hostedRunDelivery(path), h.clock.nowMs);
    }
    expect(h.coordinator.status().candidates.pending).toBe(1);
    expect(h.storage.alarmAt).toBeNull();
    expect(h.dispatchCalls).toHaveLength(0);

    await h.coordinator.recordDelivery(
      hostedRunDelivery(REQUIRED_WORKFLOWS[REQUIRED_WORKFLOWS.length - 1] as string),
      h.clock.nowMs,
    );
    let status = h.coordinator.status();
    expect(status.candidates.ready).toBe(1);
    expect(status.retryQueue.depth).toBe(1);
    expect(h.storage.alarmAt).toBe(h.clock.nowMs + 1_000);
    expect(h.dispatchCalls).toHaveLength(0);

    h.clock.nowMs += 1_000;
    await h.coordinator.alarm();
    expect(h.dispatchCalls).toEqual([tuple()]);
    status = h.coordinator.status();
    expect(status.candidates).toMatchObject({ ready: 0, dispatched: 1 });
    expect(status.retryQueue.depth).toBe(0);
    expect(h.storage.alarmAt).toBeNull();

    // Re-delivered completion events (new delivery ids) must not dispatch again.
    await h.coordinator.recordDelivery(localCheckDelivery(), h.clock.nowMs);
    for (const path of REQUIRED_WORKFLOWS) {
      await h.coordinator.recordDelivery(hostedRunDelivery(path), h.clock.nowMs);
    }
    await h.coordinator.tick(h.clock.nowMs);
    expect(h.dispatchCalls).toHaveLength(1);
    expect(h.coordinator.status().candidates.dispatched).toBe(1);
    expect(h.logs.some((line) => line.includes('ci.gate.dispatched'))).toBe(true);
  });

  it('is order independent: hosted runs first, then the local check', async () => {
    const h = await harness();
    for (const path of REQUIRED_WORKFLOWS) {
      await h.coordinator.recordDelivery(hostedRunDelivery(path), h.clock.nowMs);
    }
    expect(h.coordinator.status().candidates.ready).toBe(0);
    const result = await h.coordinator.recordDelivery(localCheckDelivery(), h.clock.nowMs);
    expect(result.candidateState).toBe('ready');
    await h.coordinator.tick(h.clock.nowMs);
    expect(h.dispatchCalls).toHaveLength(1);
  });

  it('deduplicates replayed delivery ids and expires them after the TTL', async () => {
    const h = await harness();
    const delivery = localCheckDelivery(tuple(), {}, 'replayed-delivery');
    const first = await h.coordinator.recordDelivery(delivery, h.clock.nowMs);
    const second = await h.coordinator.recordDelivery(delivery, h.clock.nowMs);
    expect(first.duplicate).toBe(false);
    expect(second).toEqual({ duplicate: true, candidateKey: null, candidateState: null });
    expect(h.coordinator.status().deliveries.tracked).toBe(1);
    h.clock.nowMs += DELIVERY_DEDUP_TTL_MS + 1;
    const afterTtl = await h.coordinator.recordDelivery(delivery, h.clock.nowMs);
    expect(afterTtl.duplicate).toBe(false);
    expect(h.coordinator.status().deliveries.tracked).toBe(1);
  });

  it('distinct tuples (a new attempt) are separate candidates with their own single dispatch', async () => {
    const h = await harness();
    await seedReadyCandidate(h, tuple());
    await h.coordinator.recordDelivery(
      localCheckDelivery(tuple({ attempt: 2 }), { checkRunId: 9002 }),
      h.clock.nowMs,
    );
    await h.coordinator.tick(h.clock.nowMs);
    expect(h.dispatchCalls).toEqual([tuple(), tuple({ attempt: 2 })]);
  });

  it('rejects candidates whose local check failed and never dispatches them', async () => {
    const h = await harness();
    await h.coordinator.recordDelivery(
      localCheckDelivery(tuple(), { conclusion: 'failure' }),
      h.clock.nowMs,
    );
    for (const path of REQUIRED_WORKFLOWS) {
      await h.coordinator.recordDelivery(hostedRunDelivery(path), h.clock.nowMs);
    }
    await h.coordinator.tick(h.clock.nowMs);
    expect(h.dispatchCalls).toHaveLength(0);
    expect(h.coordinator.status().candidates).toMatchObject({ rejected: 1, ready: 0 });
  });

  it('keeps an in-progress local check pending', async () => {
    const h = await harness();
    for (const path of REQUIRED_WORKFLOWS) {
      await h.coordinator.recordDelivery(hostedRunDelivery(path), h.clock.nowMs);
    }
    const result = await h.coordinator.recordDelivery(
      localCheckDelivery(tuple(), { status: 'in_progress', conclusion: null }),
      h.clock.nowMs,
    );
    expect(result.candidateState).toBe('pending');
    await h.coordinator.tick(h.clock.nowMs);
    expect(h.dispatchCalls).toHaveLength(0);
  });

  it('a failed hosted run rejects the candidate and a newer successful re-run revives it once', async () => {
    const h = await harness();
    await h.coordinator.recordDelivery(localCheckDelivery(), h.clock.nowMs);
    for (const path of REQUIRED_WORKFLOWS.slice(1)) {
      await h.coordinator.recordDelivery(hostedRunDelivery(path), h.clock.nowMs);
    }
    await h.coordinator.recordDelivery(
      hostedRunDelivery(REQUIRED_WORKFLOWS[0], { conclusion: 'failure' }),
      h.clock.nowMs,
    );
    expect(h.coordinator.status().candidates.rejected).toBe(1);
    // An older attempt arriving late must not override the newer record.
    await h.coordinator.recordDelivery(
      hostedRunDelivery(REQUIRED_WORKFLOWS[0], { runId: 100, conclusion: 'success' }),
      h.clock.nowMs,
    );
    expect(h.coordinator.status().candidates.rejected).toBe(1);
    await h.coordinator.recordDelivery(
      hostedRunDelivery(REQUIRED_WORKFLOWS[0], { runAttempt: 2, conclusion: 'success' }),
      h.clock.nowMs,
    );
    expect(h.coordinator.status().candidates.ready).toBe(1);
    await h.coordinator.tick(h.clock.nowMs);
    await h.coordinator.tick(h.clock.nowMs);
    expect(h.dispatchCalls).toHaveLength(1);
  });

  it('closes candidates when their pull request closes or its head moves', async () => {
    const h = await harness();
    await seedReadyCandidate(h);
    expect(h.coordinator.status().retryQueue.depth).toBe(1);
    await h.coordinator.recordDelivery(pullRequestDelivery('closed'), h.clock.nowMs);
    let status = h.coordinator.status();
    expect(status.candidates).toMatchObject({ closed: 1, ready: 0 });
    expect(status.retryQueue.depth).toBe(0);
    await h.coordinator.tick(h.clock.nowMs);
    expect(h.dispatchCalls).toHaveLength(0);

    await seedReadyCandidate(h, tuple({ attempt: 2 }));
    await h.coordinator.recordDelivery(pullRequestDelivery('synchronize', HEAD_SHA), h.clock.nowMs);
    expect(h.coordinator.status().candidates.ready).toBe(1);
    await h.coordinator.recordDelivery(
      pullRequestDelivery('synchronize', 'f'.repeat(40)),
      h.clock.nowMs,
    );
    status = h.coordinator.status();
    expect(status.candidates).toMatchObject({ closed: 2, ready: 0 });
    expect(status.retryQueue.depth).toBe(0);
  });
});

describe('coordinator dispatch retries', () => {
  it('retries transport failures with bounded exponential backoff and then fails the candidate', async () => {
    let attempts = 0;
    const h = await harness({
      async dispatchGate() {
        attempts += 1;
        throw new GitHubTransportError('GitHub responded 503 for POST dispatch.', 503, true);
      },
    });
    await seedReadyCandidate(h);
    let report = await h.coordinator.tick(h.clock.nowMs);
    expect(report).toMatchObject({ processedJobs: 1, retried: 1, failed: 0 });
    expect(h.storage.alarmAt).toBe(h.clock.nowMs + DISPATCH_RETRY_SCHEDULE_MS[0]);
    expect(h.coordinator.status().candidates.ready).toBe(1);

    // Ticking early does nothing.
    report = await h.coordinator.tick(h.clock.nowMs + 1_000);
    expect(report.processedJobs).toBe(0);
    expect(attempts).toBe(1);

    for (const delay of DISPATCH_RETRY_SCHEDULE_MS) {
      h.clock.nowMs += delay;
      report = await h.coordinator.tick(h.clock.nowMs);
    }
    expect(attempts).toBe(DISPATCH_MAX_ATTEMPTS);
    expect(report).toMatchObject({ processedJobs: 1, retried: 0, failed: 1 });
    const status = h.coordinator.status();
    expect(status.candidates).toMatchObject({ ready: 0, failed: 1 });
    expect(status.retryQueue.depth).toBe(0);
    expect(h.storage.alarmAt).toBeNull();
    expect(status.incidents.active).toHaveLength(1);
    expect(status.incidents.active[0]).toMatchObject({
      service: 'github-dispatch',
      environment: 'control-plane',
      failureClass: 'dispatch_transport_exhausted',
      status: 'open',
    });

    h.clock.nowMs += 3_600_000;
    await h.coordinator.tick(h.clock.nowMs);
    expect(attempts).toBe(DISPATCH_MAX_ATTEMPTS);
  });

  it('fails immediately on non-retryable errors', async () => {
    let attempts = 0;
    const h = await harness({
      async dispatchGate() {
        attempts += 1;
        throw new GitHubConfigurationError('GITHUB_DISPATCH_APP_ID is not configured.');
      },
    });
    await seedReadyCandidate(h);
    const report = await h.coordinator.tick(h.clock.nowMs);
    expect(report).toMatchObject({ failed: 1, retried: 0 });
    expect(attempts).toBe(1);
    expect(h.coordinator.status().candidates.failed).toBe(1);
    expect(h.coordinator.status().incidents.active[0]?.failureClass).toBe('dispatch_error');
    const failureLog = h.logs.find((line) => line.includes('ci.gate.dispatch_failed'));
    expect(failureLog).toContain('GitHubConfigurationError');
  });

  it('retries readback not-ready outcomes and records the later dispatch once', async () => {
    let calls = 0;
    const h = await harness({
      async dispatchGate() {
        calls += 1;
        if (calls === 1) return { result: 'not_ready', reason: 'hosted_run_incomplete:x' };
        return { result: 'dispatched', workflowId: '1001', ref: 'refs/heads/main' };
      },
    });
    await seedReadyCandidate(h);
    expect(await h.coordinator.tick(h.clock.nowMs)).toMatchObject({ retried: 1 });
    h.clock.nowMs += DISPATCH_RETRY_SCHEDULE_MS[0];
    expect(await h.coordinator.tick(h.clock.nowMs)).toMatchObject({ dispatched: 1 });
    expect(calls).toBe(2);
    expect(h.coordinator.status().candidates.dispatched).toBe(1);
  });

  it('marks readback rejections terminal', async () => {
    const h = await harness({
      async dispatchGate() {
        return { result: 'rejected', reason: 'pull_request_not_open' };
      },
    });
    await seedReadyCandidate(h);
    expect(await h.coordinator.tick(h.clock.nowMs)).toMatchObject({ rejected: 1 });
    expect(h.coordinator.status().candidates.rejected).toBe(1);
    expect(h.coordinator.status().retryQueue.depth).toBe(0);
  });

  it('survives evidence write failures during dispatch', async () => {
    const h = await harness({
      async writeEvidence() {
        throw new Error('R2 unavailable');
      },
    });
    await seedReadyCandidate(h);
    expect(await h.coordinator.tick(h.clock.nowMs)).toMatchObject({ dispatched: 1 });
    expect(h.logs.some((line) => line.includes('evidence.write_failed'))).toBe(true);
  });
});

describe('coordinator heartbeat tracking', () => {
  it('derives heartbeat state from age with alert and fallback thresholds', () => {
    expect(heartbeatStateFor(null)).toBe('unknown');
    expect(heartbeatStateFor(-1)).toBe('unknown');
    expect(heartbeatStateFor(0)).toBe('fresh');
    expect(heartbeatStateFor(HEARTBEAT_ALERT_AFTER_MS - 1)).toBe('fresh');
    expect(heartbeatStateFor(HEARTBEAT_ALERT_AFTER_MS)).toBe('alert');
    expect(heartbeatStateFor(HEARTBEAT_FALLBACK_AFTER_MS - 1)).toBe('alert');
    expect(heartbeatStateFor(HEARTBEAT_FALLBACK_AFTER_MS)).toBe('fallback_eligible');
  });

  it('records the latest heartbeat without ever dispatching', async () => {
    const h = await harness();
    await seedReadyCandidate(h);
    expect(h.coordinator.status().heartbeat).toMatchObject({ state: 'unknown', ageMs: null });
    h.coordinator.recordHeartbeat(heartbeat(), h.clock.nowMs);
    expect(h.coordinator.status().heartbeat).toMatchObject({
      state: 'fresh',
      ageMs: 0,
      controllerId: 'mac-mini-01',
      controllerVersion: '1.4.0',
      activeRuntime: 'node22',
      candidateRuntime: 'node24',
      lastSeenAt: NOW_ISO,
    });
    expect(h.dispatchCalls).toHaveLength(0);
    h.clock.nowMs += HEARTBEAT_ALERT_AFTER_MS;
    expect(h.coordinator.status().heartbeat.state).toBe('alert');
    h.clock.nowMs += HEARTBEAT_FALLBACK_AFTER_MS;
    expect(h.coordinator.status().heartbeat.state).toBe('fallback_eligible');
    expect(h.dispatchCalls).toHaveLength(0);
  });

  it('a fresh heartbeat counts as a healthy controller observation', async () => {
    const h = await harness();
    h.coordinator.applyObservations(
      [
        {
          service: 'local-ci-controller',
          environment: 'control-plane',
          failureClass: 'heartbeat_stale',
          healthy: false,
        },
      ],
      h.clock.nowMs,
    );
    expect(h.coordinator.status().incidents.active).toHaveLength(1);
    for (let index = 0; index < 3; index += 1) {
      h.coordinator.recordHeartbeat(heartbeat(), h.clock.nowMs);
    }
    expect(h.coordinator.status().incidents.active).toHaveLength(0);
  });
});

describe('coordinator incidents', () => {
  it('dedupes by service, environment and failure class into one active incident', async () => {
    const h = await harness();
    const first = h.coordinator.applyObservations([observation(false)], h.clock.nowMs);
    expect(first.transitions).toEqual([
      { key: 'web|production|readiness', transition: 'opened', incidentId: 'incident-1' },
    ]);
    const again = h.coordinator.applyObservations(
      [observation(false), observation(false, 'booking-short-links')],
      h.clock.nowMs + 60_000,
    );
    expect(again.transitions.map((entry) => entry.transition)).toEqual(['continued', 'opened']);
    expect(again.transitions[0]?.incidentId).toBe('incident-1');
    const active = h.coordinator.status().incidents.active;
    expect(active).toHaveLength(2);
    expect(active.map((incident) => incident.id)).toEqual(['incident-1', 'incident-2']);
  });

  it('escalates unacknowledged incidents after fifteen minutes and honours acknowledgement', async () => {
    const h = await harness();
    h.coordinator.applyObservations(
      [observation(false), observation(false, 'booking-short-links')],
      h.clock.nowMs,
    );
    expect(h.coordinator.acknowledge('incident-2', h.clock.nowMs)).toBe(true);
    expect(h.coordinator.acknowledge('incident-2', h.clock.nowMs)).toBe(false);
    expect(h.coordinator.acknowledge('missing', h.clock.nowMs)).toBe(false);

    h.clock.nowMs += INCIDENT_ESCALATION_AFTER_MS - 1;
    expect((await h.coordinator.tick(h.clock.nowMs)).escalated).toBe(0);
    h.clock.nowMs += 1;
    expect((await h.coordinator.tick(h.clock.nowMs)).escalated).toBe(1);
    const active = h.coordinator.status().incidents.active;
    expect(active.find((incident) => incident.id === 'incident-1')?.status).toBe('escalated');
    expect(active.find((incident) => incident.id === 'incident-2')).toMatchObject({
      status: 'open',
      acknowledgedAt: new Date(NOW_MS).toISOString(),
    });
    expect((await h.coordinator.tick(h.clock.nowMs + 3_600_000)).escalated).toBe(0);
  });

  it('resolves after three consecutive healthy observations and reopens as a new incident', async () => {
    const h = await harness();
    h.coordinator.applyObservations([observation(false)], h.clock.nowMs);
    h.coordinator.applyObservations([observation(true)], h.clock.nowMs);
    h.coordinator.applyObservations([observation(true)], h.clock.nowMs);
    expect(h.coordinator.status().incidents.active[0]?.healthyStreak).toBe(2);
    const resolved = h.coordinator.applyObservations([observation(true)], h.clock.nowMs);
    expect(resolved.transitions[0]?.transition).toBe('resolved');
    expect(h.coordinator.status().incidents.active).toHaveLength(0);
    const reopened = h.coordinator.applyObservations([observation(false)], h.clock.nowMs);
    expect(reopened.transitions[0]).toMatchObject({
      transition: 'opened',
      incidentId: 'incident-2',
    });
  });
});

describe('coordinator internal HTTP surface', () => {
  const origin = 'https://coordinator.internal';

  it('serves status and validates envelopes', async () => {
    const h = await harness();
    const status = await h.coordinator.fetch(new Request(`${origin}/status`));
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      candidates: { pending: 0 },
      incidents: { active: [] },
    });

    expect(
      (await h.coordinator.fetch(new Request(`${origin}/status`, { method: 'DELETE' }))).status,
    ).toBe(404);
    expect(
      (
        await h.coordinator.fetch(
          new Request(`${origin}/deliveries`, { method: 'POST', body: '{' }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await h.coordinator.fetch(
          new Request(`${origin}/deliveries`, { method: 'POST', body: '[]' }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await h.coordinator.fetch(
          new Request(`${origin}/deliveries`, {
            method: 'POST',
            body: JSON.stringify({ delivery: {} }),
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await h.coordinator.fetch(
          new Request(`${origin}/heartbeat`, {
            method: 'POST',
            body: JSON.stringify({ heartbeat: 1 }),
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await h.coordinator.fetch(
          new Request(`${origin}/observations`, {
            method: 'POST',
            body: JSON.stringify({
              observations: [
                { service: 'Bad Name', environment: 'x', failureClass: 'y', healthy: true },
              ],
            }),
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await h.coordinator.fetch(new Request(`${origin}/unknown`, { method: 'POST', body: '{}' })))
        .status,
    ).toBe(404);
  });

  it('accepts deliveries, heartbeats, observations, ticks and acknowledgements over HTTP', async () => {
    const h = await harness();
    const delivered = await h.coordinator.fetch(
      new Request(`${origin}/deliveries`, {
        method: 'POST',
        body: JSON.stringify({ delivery: localCheckDelivery(), receivedAt: NOW_ISO }),
      }),
    );
    expect(await delivered.json()).toMatchObject({ duplicate: false, candidateState: 'pending' });

    const beat = await h.coordinator.fetch(
      new Request(`${origin}/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({ heartbeat: heartbeat(), receivedAt: NOW_ISO }),
      }),
    );
    expect(beat.status).toBe(202);

    const observed = await h.coordinator.fetch(
      new Request(`${origin}/observations`, {
        method: 'POST',
        body: JSON.stringify({ observations: [observation(false)], now: NOW_ISO }),
      }),
    );
    expect(await observed.json()).toMatchObject({
      transitions: [{ transition: 'opened', incidentId: 'incident-1' }],
    });

    const ticked = await h.coordinator.fetch(
      new Request(`${origin}/tick`, { method: 'POST', body: JSON.stringify({ now: NOW_ISO }) }),
    );
    expect(await ticked.json()).toMatchObject({
      processedJobs: 0,
      escalated: 0,
      nextAlarmAt: null,
    });

    const acknowledged = await h.coordinator.fetch(
      new Request(`${origin}/incidents/incident-1/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ now: 'not-a-date' }),
      }),
    );
    expect(await acknowledged.json()).toEqual({ acknowledged: true });
  });

  it('refuses deliveries when the control plane is unconfigured', async () => {
    const created = await createInProcessCoordinator(
      baseEnv({ REPOSITORY_ID: 'REPLACE_ME_REPOSITORY_ID' }),
    );
    harnesses.push(created);
    const response = await created.coordinator.fetch(
      new Request(`${origin}/deliveries`, {
        method: 'POST',
        body: JSON.stringify({ delivery: localCheckDelivery(), receivedAt: NOW_ISO }),
      }),
    );
    expect(response.status).toBe(503);
  });
});
