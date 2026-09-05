import { describe, expect, it } from 'vitest';

import { NOW_MS } from './helpers/fixtures';
import { INCIDENT_ESCALATION_AFTER_MS } from '../src/contracts';
import {
  acknowledgeIncident,
  applyObservation,
  escalateIfDue,
  incidentKey,
  isValidObservation,
} from '../src/incidents';

import type { HealthObservation, IncidentSummary } from '../src/contracts';

const observation = (healthy: boolean): HealthObservation => ({
  service: 'web',
  environment: 'production',
  failureClass: 'readiness',
  healthy,
});

let ids = 0;
const newId = (): string => `incident-${(ids += 1)}`;

describe('incident state machine', () => {
  it('opens, continues, and resolves after three consecutive healthy observations', () => {
    const opened = applyObservation({
      existing: null,
      observation: observation(false),
      nowMs: NOW_MS,
      newId,
    });
    expect(opened.transition).toBe('opened');
    const incident = opened.incident as IncidentSummary;
    expect(incident.status).toBe('open');
    expect(incident.healthyStreak).toBe(0);

    const continued = applyObservation({
      existing: incident,
      observation: observation(false),
      nowMs: NOW_MS + 60_000,
      newId,
    });
    expect(continued.transition).toBe('continued');
    expect(continued.incident?.id).toBe(incident.id);
    expect(continued.incident?.lastSeenAt).toBe(new Date(NOW_MS + 60_000).toISOString());

    let current = continued.incident as IncidentSummary;
    for (const expected of ['healthy_progress', 'healthy_progress', 'resolved']) {
      const update = applyObservation({
        existing: current,
        observation: observation(true),
        nowMs: NOW_MS + 120_000,
        newId,
      });
      expect(update.transition).toBe(expected);
      current = update.incident as IncidentSummary;
    }
    expect(current.status).toBe('resolved');
    expect(current.resolvedAt).toBe(new Date(NOW_MS + 120_000).toISOString());

    const afterResolution = applyObservation({
      existing: current,
      observation: observation(true),
      nowMs: NOW_MS + 180_000,
      newId,
    });
    expect(afterResolution.transition).toBe('none');
  });

  it('a failure after a partial healthy streak resets the streak on the same incident', () => {
    const incident = applyObservation({
      existing: null,
      observation: observation(false),
      nowMs: NOW_MS,
      newId,
    }).incident as IncidentSummary;
    const progressed = applyObservation({
      existing: incident,
      observation: observation(true),
      nowMs: NOW_MS,
      newId,
    }).incident as IncidentSummary;
    expect(progressed.healthyStreak).toBe(1);
    const reset = applyObservation({
      existing: progressed,
      observation: observation(false),
      nowMs: NOW_MS,
      newId,
    });
    expect(reset.transition).toBe('continued');
    expect(reset.incident?.healthyStreak).toBe(0);
    expect(reset.incident?.id).toBe(incident.id);
  });

  it('escalates an unacknowledged incident after fifteen minutes, but never an acknowledged one', () => {
    const incident = applyObservation({
      existing: null,
      observation: observation(false),
      nowMs: NOW_MS,
      newId,
    }).incident as IncidentSummary;
    expect(escalateIfDue(incident, NOW_MS + INCIDENT_ESCALATION_AFTER_MS - 1).transition).toBe(
      'none',
    );
    const escalated = escalateIfDue(incident, NOW_MS + INCIDENT_ESCALATION_AFTER_MS);
    expect(escalated.transition).toBe('escalated');
    expect(escalated.incident?.status).toBe('escalated');
    expect(
      escalateIfDue(escalated.incident as IncidentSummary, NOW_MS + 3_600_000).transition,
    ).toBe('none');

    const acknowledged = acknowledgeIncident(incident, NOW_MS + 60_000) as IncidentSummary;
    expect(acknowledged.acknowledgedAt).toBe(new Date(NOW_MS + 60_000).toISOString());
    expect(escalateIfDue(acknowledged, NOW_MS + 3_600_000).transition).toBe('none');
    expect(acknowledgeIncident(acknowledged, NOW_MS + 120_000)).toBeNull();
    expect(acknowledgeIncident({ ...incident, status: 'resolved' }, NOW_MS)).toBeNull();
  });

  it('derives the dedupe key and validates observation identifiers', () => {
    expect(incidentKey(observation(false))).toBe('web|production|readiness');
    expect(isValidObservation(observation(true))).toBe(true);
    expect(isValidObservation({ ...observation(true), service: 'Web Prod' })).toBe(false);
    expect(isValidObservation({ ...observation(true), failureClass: '' })).toBe(false);
  });
});
