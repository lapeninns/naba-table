import { INCIDENT_ESCALATION_AFTER_MS, INCIDENT_RESOLVE_HEALTHY_STREAK } from './contracts';

import type { HealthObservation, IncidentStatus, IncidentSummary } from './contracts';

export type IncidentTransition =
  | 'opened'
  | 'continued'
  | 'healthy_progress'
  | 'resolved'
  | 'escalated'
  | 'none';

export type IncidentUpdate = {
  readonly incident: IncidentSummary | null;
  readonly transition: IncidentTransition;
};

const KEY_PART_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;

export function incidentKey(
  observation: Pick<HealthObservation, 'service' | 'environment' | 'failureClass'>,
): string {
  return `${observation.service}|${observation.environment}|${observation.failureClass}`;
}

export function isValidObservation(value: HealthObservation): boolean {
  return (
    KEY_PART_PATTERN.test(value.service) &&
    KEY_PART_PATTERN.test(value.environment) &&
    KEY_PART_PATTERN.test(value.failureClass) &&
    typeof value.healthy === 'boolean'
  );
}

function isActive(status: IncidentStatus): boolean {
  return status !== 'resolved';
}

/**
 * Pure incident state machine. One active incident exists per (service, environment,
 * failureClass); repeated failures extend it, three consecutive healthy observations resolve it,
 * and an unacknowledged incident escalates after 15 minutes.
 */
export function applyObservation(input: {
  readonly existing: IncidentSummary | null;
  readonly observation: HealthObservation;
  readonly nowMs: number;
  readonly newId: () => string;
}): IncidentUpdate {
  const nowIso = new Date(input.nowMs).toISOString();
  const active = input.existing && isActive(input.existing.status) ? input.existing : null;

  if (!input.observation.healthy) {
    if (!active) {
      return {
        transition: 'opened',
        incident: {
          id: input.newId(),
          service: input.observation.service,
          environment: input.observation.environment,
          failureClass: input.observation.failureClass,
          status: 'open',
          openedAt: nowIso,
          lastSeenAt: nowIso,
          escalatedAt: null,
          acknowledgedAt: null,
          resolvedAt: null,
          healthyStreak: 0,
        },
      };
    }
    return {
      transition: 'continued',
      incident: { ...active, lastSeenAt: nowIso, healthyStreak: 0 },
    };
  }

  if (!active) return { transition: 'none', incident: input.existing };
  const healthyStreak = active.healthyStreak + 1;
  if (healthyStreak >= INCIDENT_RESOLVE_HEALTHY_STREAK) {
    return {
      transition: 'resolved',
      incident: { ...active, status: 'resolved', resolvedAt: nowIso, healthyStreak },
    };
  }
  return { transition: 'healthy_progress', incident: { ...active, healthyStreak } };
}

export function escalateIfDue(incident: IncidentSummary, nowMs: number): IncidentUpdate {
  if (incident.status !== 'open' || incident.acknowledgedAt) {
    return { incident, transition: 'none' };
  }
  const openedAtMs = Date.parse(incident.openedAt);
  if (!Number.isFinite(openedAtMs) || nowMs - openedAtMs < INCIDENT_ESCALATION_AFTER_MS) {
    return { incident, transition: 'none' };
  }
  return {
    transition: 'escalated',
    incident: { ...incident, status: 'escalated', escalatedAt: new Date(nowMs).toISOString() },
  };
}

export function acknowledgeIncident(
  incident: IncidentSummary,
  nowMs: number,
): IncidentSummary | null {
  if (!isActive(incident.status) || incident.acknowledgedAt) return null;
  return { ...incident, acknowledgedAt: new Date(nowMs).toISOString() };
}
