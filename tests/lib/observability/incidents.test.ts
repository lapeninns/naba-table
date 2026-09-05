import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INCIDENT_POLICY,
  acknowledgeIncident,
  applyFailure,
  applyHealthy,
  buildIncidentKey,
  createInMemoryIncidentStore,
  evaluateEscalation,
  recordFailureObservation,
  recordHealthyObservation,
} from '@/lib/observability/incidents';

import type { FailureObservation, Incident } from '@/lib/observability/incidents';

const key = { service: 'nabatable-web', environment: 'production', failureClass: 'POST:/api/x' };

function failure(at: string, severity: 'critical' | 'warning' = 'critical'): FailureObservation {
  return { ...key, severity, observedAt: new Date(at) };
}

function minutesAfter(base: string, minutes: number): string {
  return new Date(Date.parse(base) + minutes * 60_000).toISOString();
}

const T0 = '2026-09-04T10:00:00.000Z';

describe('incident state machine', () => {
  it('builds a dedupe key and rejects unsafe segments', () => {
    expect(buildIncidentKey(key)).toBe('nabatable-web|production|POST:/api/x');
    expect(() => buildIncidentKey({ ...key, failureClass: 'guest@example.com said hi' })).toThrow(
      /safe identifiers/u,
    );
  });

  it('opens on first failure and records bounded updates before summarizing', () => {
    let outcome = applyFailure(null, failure(T0));
    expect(outcome.transition).toBe('opened');
    expect(outcome.incident).toMatchObject({
      status: 'open',
      occurrenceCount: 1,
      summarizedFailures: 0,
      owner: null,
      acknowledgedAt: null,
    });

    for (let index = 1; index < DEFAULT_INCIDENT_POLICY.maxUpdates; index += 1) {
      outcome = applyFailure(outcome.incident, failure(minutesAfter(T0, index)));
      expect(outcome.transition).toBe('updated');
    }
    expect(outcome.incident.updates.filter((update) => update.kind === 'failure')).toHaveLength(
      DEFAULT_INCIDENT_POLICY.maxUpdates,
    );

    outcome = applyFailure(outcome.incident, failure(minutesAfter(T0, 11)));
    expect(outcome.transition).toBe('suppressed');
    expect(outcome.incident.summarizedFailures).toBe(1);
    expect(outcome.incident.occurrenceCount).toBe(DEFAULT_INCIDENT_POLICY.maxUpdates + 1);
    expect(outcome.incident.updates.filter((update) => update.kind === 'failure')).toHaveLength(
      DEFAULT_INCIDENT_POLICY.maxUpdates,
    );
  });

  it('upgrades severity to critical and never downgrades it', () => {
    const warning = applyFailure(null, failure(T0, 'warning')).incident;
    const upgraded = applyFailure(warning, failure(minutesAfter(T0, 1), 'critical')).incident;
    const stillCritical = applyFailure(upgraded, failure(minutesAfter(T0, 2), 'warning')).incident;
    expect(warning.severity).toBe('warning');
    expect(upgraded.severity).toBe('critical');
    expect(stillCritical.severity).toBe('critical');
  });

  it('rejects observations for a different key against an active incident', () => {
    const incident = applyFailure(null, failure(T0)).incident;
    expect(() => applyFailure(incident, { ...failure(T0), failureClass: 'GET:/other' })).toThrow(
      /does not match/u,
    );
    expect(() =>
      applyHealthy(incident, { ...key, service: 'other', observedAt: new Date(T0) }),
    ).toThrow(/does not match/u);
  });

  it('escalates critical incidents after 15 minutes unacknowledged, once', () => {
    const incident = applyFailure(null, failure(T0)).incident;
    expect(evaluateEscalation(incident, new Date(minutesAfter(T0, 14))).transition).toBe('noop');

    const escalated = evaluateEscalation(incident, new Date(minutesAfter(T0, 15)));
    expect(escalated.transition).toBe('escalated');
    expect(escalated.incident.status).toBe('escalated');
    expect(escalated.incident.escalatedAt).toBe(minutesAfter(T0, 15));
    expect(evaluateEscalation(escalated.incident, new Date(minutesAfter(T0, 30))).transition).toBe(
      'noop',
    );
  });

  it('does not escalate warnings or acknowledged incidents', () => {
    const warning = applyFailure(null, failure(T0, 'warning')).incident;
    expect(evaluateEscalation(warning, new Date(minutesAfter(T0, 60))).transition).toBe('noop');

    const critical = applyFailure(null, failure(T0)).incident;
    const acknowledged = acknowledgeIncident(critical, {
      owner: 'oncall-a',
      at: new Date(minutesAfter(T0, 5)),
    });
    expect(acknowledged.transition).toBe('acknowledged');
    expect(acknowledged.incident).toMatchObject({
      status: 'acknowledged',
      owner: 'oncall-a',
      acknowledgedBy: 'oncall-a',
      acknowledgedAt: minutesAfter(T0, 5),
    });
    expect(
      evaluateEscalation(acknowledged.incident, new Date(minutesAfter(T0, 60))).transition,
    ).toBe('noop');
    expect(
      acknowledgeIncident(acknowledged.incident, { owner: 'oncall-b', at: new Date() }),
    ).toMatchObject({
      transition: 'noop',
      incident: { owner: 'oncall-b', acknowledgedBy: 'oncall-a' },
    });
    expect(() => acknowledgeIncident(critical, { owner: 'bad owner!', at: new Date() })).toThrow(
      /owner/u,
    );
  });

  it('resolves after three consecutive healthy observations and resets on failure', () => {
    let incident: Incident = applyFailure(null, failure(T0)).incident;
    const healthy = (minutes: number) => ({
      ...key,
      observedAt: new Date(minutesAfter(T0, minutes)),
    });

    let outcome = applyHealthy(incident, healthy(1));
    expect(outcome?.transition).toBe('healthy');
    incident = outcome!.incident;
    outcome = applyHealthy(incident, healthy(2));
    expect(outcome?.incident.consecutiveHealthy).toBe(2);
    incident = outcome!.incident;

    incident = applyFailure(incident, failure(minutesAfter(T0, 3))).incident;
    expect(incident.consecutiveHealthy).toBe(0);

    for (const minute of [4, 5]) incident = applyHealthy(incident, healthy(minute))!.incident;
    outcome = applyHealthy(incident, healthy(6));
    expect(outcome?.transition).toBe('resolved');
    expect(outcome?.incident).toMatchObject({
      status: 'resolved',
      resolvedAt: minutesAfter(T0, 6),
    });

    expect(applyHealthy(outcome!.incident, healthy(7))).toBeNull();
    expect(applyFailure(outcome!.incident, failure(minutesAfter(T0, 8))).transition).toBe('opened');
  });

  it('atomically counts concurrent failures and emits one opening transition', async () => {
    const store = createInMemoryIncidentStore();
    const outcomes = await Promise.all(
      Array.from({ length: 20 }, () => recordFailureObservation(store, failure(T0))),
    );
    expect(outcomes.filter((outcome) => outcome.transition === 'opened')).toHaveLength(1);
    expect(store.list()[0]?.occurrenceCount).toBe(20);
  });

  it('orchestrates through the store with escalation winning over updates', async () => {
    const store = createInMemoryIncidentStore();
    const opened = await recordFailureObservation(store, failure(T0));
    expect(opened.transition).toBe('opened');
    await expect(store.getActive(key)).resolves.toMatchObject({ id: opened.incident.id });

    const escalated = await recordFailureObservation(store, failure(minutesAfter(T0, 16)));
    expect(escalated.transition).toBe('escalated');
    expect(escalated.incident.occurrenceCount).toBe(2);

    for (const minute of [20, 21]) {
      const outcome = await recordHealthyObservation(store, {
        ...key,
        observedAt: new Date(minutesAfter(T0, minute)),
      });
      expect(outcome?.transition).toBe('healthy');
    }
    const resolved = await recordHealthyObservation(store, {
      ...key,
      observedAt: new Date(minutesAfter(T0, 22)),
    });
    expect(resolved?.transition).toBe('resolved');
    await expect(store.getActive(key)).resolves.toBeNull();
    expect(store.list()).toHaveLength(1);
    await expect(
      recordHealthyObservation(store, { ...key, observedAt: new Date(minutesAfter(T0, 23)) }),
    ).resolves.toBeNull();
  });
});
