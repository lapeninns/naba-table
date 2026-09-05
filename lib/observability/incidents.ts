/**
 * Incident lifecycle as pure functions over an injectable store.
 *
 * - Dedupe key: `(service, environment, failureClass)`; at most one *active*
 *   incident per key.
 * - Updates are bounded: the first `maxUpdates` failure observations are
 *   recorded individually; later observations are folded into a summary
 *   counter and reported as `suppressed` so downstream sinks (GitHub issues,
 *   pagers) are not flooded.
 * - Critical incidents escalate once they stay unacknowledged for
 *   `escalateAfterMs` (15 minutes by default).
 * - An incident resolves after `resolveAfterHealthyObservations` consecutive
 *   healthy observations (3 by default); any failure resets the streak.
 *
 * Nothing here logs. Callers own logging and must keep guest PII, tokens and
 * provider payloads out of `failureClass` and update notes.
 */

export type IncidentSeverity = 'critical' | 'warning';

export type IncidentStatus = 'open' | 'acknowledged' | 'escalated' | 'resolved';

export type IncidentKey = {
  readonly service: string;
  readonly environment: string;
  readonly failureClass: string;
};

export type IncidentUpdate = {
  readonly at: string;
  readonly kind: 'failure' | 'healthy' | 'acknowledged' | 'escalated' | 'resolved';
  /** Short, safe, enumerable note (never free-form provider output). */
  readonly note?: string;
};

export type Incident = IncidentKey & {
  readonly id: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly openedAt: string;
  readonly lastFailureAt: string;
  readonly lastObservedAt: string;
  readonly occurrenceCount: number;
  readonly updates: ReadonlyArray<IncidentUpdate>;
  /** Failure observations folded into the summary once `maxUpdates` was reached. */
  readonly summarizedFailures: number;
  readonly owner: string | null;
  readonly acknowledgedAt: string | null;
  readonly acknowledgedBy: string | null;
  readonly escalatedAt: string | null;
  readonly resolvedAt: string | null;
  readonly consecutiveHealthy: number;
};

export type IncidentPolicy = {
  readonly maxUpdates: number;
  readonly escalateAfterMs: number;
  readonly resolveAfterHealthyObservations: number;
};

export const DEFAULT_INCIDENT_POLICY: IncidentPolicy = Object.freeze({
  maxUpdates: 10,
  escalateAfterMs: 15 * 60_000,
  resolveAfterHealthyObservations: 3,
});

export type FailureObservation = IncidentKey & {
  readonly severity: IncidentSeverity;
  readonly observedAt: Date;
  readonly note?: string;
};

export type HealthyObservation = IncidentKey & {
  readonly observedAt: Date;
};

export type IncidentTransition =
  | 'opened'
  | 'updated'
  | 'suppressed'
  | 'escalated'
  | 'acknowledged'
  | 'healthy'
  | 'resolved'
  | 'noop';

export type IncidentOutcome = {
  readonly incident: Incident;
  readonly transition: IncidentTransition;
};

export interface IncidentStore {
  /** Returns the single active (non-resolved) incident for the key, if any. */
  getActive(key: IncidentKey): Promise<Incident | null>;
  save(incident: Incident): Promise<void>;
}

const SAFE_SEGMENT = /^[A-Za-z0-9._:/-]{1,200}$/u;

export function buildIncidentKey(key: IncidentKey): string {
  for (const segment of [key.service, key.environment, key.failureClass]) {
    if (!SAFE_SEGMENT.test(segment)) {
      throw new Error('Incident key segments must be bounded safe identifiers.');
    }
  }
  return `${key.service}|${key.environment}|${key.failureClass}`;
}

function isSameKey(left: IncidentKey, right: IncidentKey): boolean {
  return (
    left.service === right.service &&
    left.environment === right.environment &&
    left.failureClass === right.failureClass
  );
}

function withUpdate(incident: Incident, update: IncidentUpdate): Incident {
  return { ...incident, updates: [...incident.updates, update] };
}

function isActive(incident: Incident | null): incident is Incident {
  return incident !== null && incident.status !== 'resolved';
}

export function openIncident(observation: FailureObservation): Incident {
  const at = observation.observedAt.toISOString();
  const key = buildIncidentKey(observation);
  return {
    id: `${key}|${at}`,
    service: observation.service,
    environment: observation.environment,
    failureClass: observation.failureClass,
    severity: observation.severity,
    status: 'open',
    openedAt: at,
    lastFailureAt: at,
    lastObservedAt: at,
    occurrenceCount: 1,
    updates: [{ at, kind: 'failure', ...(observation.note ? { note: observation.note } : {}) }],
    summarizedFailures: 0,
    owner: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    escalatedAt: null,
    resolvedAt: null,
    consecutiveHealthy: 0,
  };
}

/**
 * Applies a failure observation to the current active incident (or none).
 * Returns the next incident and the transition that happened.
 */
export function applyFailure(
  current: Incident | null,
  observation: FailureObservation,
  policy: IncidentPolicy = DEFAULT_INCIDENT_POLICY,
): IncidentOutcome {
  if (!isActive(current)) {
    return { incident: openIncident(observation), transition: 'opened' };
  }
  if (!isSameKey(current, observation)) {
    throw new Error('Failure observation does not match the active incident key.');
  }

  const at = observation.observedAt.toISOString();
  const severity: IncidentSeverity =
    current.severity === 'critical' || observation.severity === 'critical' ? 'critical' : 'warning';
  const base: Incident = {
    ...current,
    severity,
    lastFailureAt: at,
    lastObservedAt: at,
    occurrenceCount: current.occurrenceCount + 1,
    consecutiveHealthy: 0,
  };

  const recordedFailures = current.updates.filter((update) => update.kind === 'failure').length;
  if (recordedFailures >= policy.maxUpdates) {
    return {
      incident: { ...base, summarizedFailures: current.summarizedFailures + 1 },
      transition: 'suppressed',
    };
  }

  return {
    incident: withUpdate(base, {
      at,
      kind: 'failure',
      ...(observation.note ? { note: observation.note } : {}),
    }),
    transition: 'updated',
  };
}

/**
 * Applies a healthy observation. Resolves the incident once the configured
 * number of consecutive healthy observations is reached.
 */
export function applyHealthy(
  current: Incident | null,
  observation: HealthyObservation,
  policy: IncidentPolicy = DEFAULT_INCIDENT_POLICY,
): IncidentOutcome | null {
  if (!isActive(current)) return null;
  if (!isSameKey(current, observation)) {
    throw new Error('Healthy observation does not match the active incident key.');
  }

  const at = observation.observedAt.toISOString();
  const consecutiveHealthy = current.consecutiveHealthy + 1;
  if (consecutiveHealthy >= policy.resolveAfterHealthyObservations) {
    return {
      incident: withUpdate(
        {
          ...current,
          status: 'resolved',
          resolvedAt: at,
          lastObservedAt: at,
          consecutiveHealthy,
        },
        { at, kind: 'resolved' },
      ),
      transition: 'resolved',
    };
  }

  return {
    incident: { ...current, lastObservedAt: at, consecutiveHealthy },
    transition: 'healthy',
  };
}

export function acknowledgeIncident(
  current: Incident,
  input: { readonly owner: string; readonly at: Date },
): IncidentOutcome {
  if (current.status === 'resolved') return { incident: current, transition: 'noop' };
  if (!SAFE_SEGMENT.test(input.owner)) {
    throw new Error('Incident owner must be a bounded safe identifier.');
  }
  if (current.acknowledgedAt) {
    return { incident: { ...current, owner: input.owner }, transition: 'noop' };
  }
  const at = input.at.toISOString();
  return {
    incident: withUpdate(
      {
        ...current,
        status: current.status === 'escalated' ? 'escalated' : 'acknowledged',
        owner: input.owner,
        acknowledgedAt: at,
        acknowledgedBy: input.owner,
        lastObservedAt: at,
      },
      { at, kind: 'acknowledged' },
    ),
    transition: 'acknowledged',
  };
}

/**
 * Escalates a critical incident that has stayed unacknowledged for longer
 * than the policy window. Idempotent: an already escalated or acknowledged
 * incident is returned unchanged.
 */
export function evaluateEscalation(
  current: Incident,
  now: Date,
  policy: IncidentPolicy = DEFAULT_INCIDENT_POLICY,
): IncidentOutcome {
  if (
    current.status === 'resolved' ||
    current.status === 'escalated' ||
    current.acknowledgedAt !== null ||
    current.severity !== 'critical'
  ) {
    return { incident: current, transition: 'noop' };
  }
  const openedAtMs = Date.parse(current.openedAt);
  if (!Number.isFinite(openedAtMs) || now.getTime() - openedAtMs < policy.escalateAfterMs) {
    return { incident: current, transition: 'noop' };
  }
  const at = now.toISOString();
  return {
    incident: withUpdate(
      { ...current, status: 'escalated', escalatedAt: at, lastObservedAt: at },
      { at, kind: 'escalated' },
    ),
    transition: 'escalated',
  };
}

/**
 * Store-backed orchestration for a failure: loads the active incident, applies
 * the failure, evaluates escalation, and persists. The escalation transition
 * wins over `updated`/`suppressed` so callers can page exactly once.
 */
export async function recordFailureObservation(
  store: IncidentStore,
  observation: FailureObservation,
  policy: IncidentPolicy = DEFAULT_INCIDENT_POLICY,
): Promise<IncidentOutcome> {
  const active = await store.getActive(observation);
  const applied = applyFailure(active, observation, policy);
  const escalated = evaluateEscalation(applied.incident, observation.observedAt, policy);
  const outcome: IncidentOutcome =
    escalated.transition === 'escalated'
      ? { incident: escalated.incident, transition: 'escalated' }
      : applied;
  await store.save(outcome.incident);
  return outcome;
}

export async function recordHealthyObservation(
  store: IncidentStore,
  observation: HealthyObservation,
  policy: IncidentPolicy = DEFAULT_INCIDENT_POLICY,
): Promise<IncidentOutcome | null> {
  const active = await store.getActive(observation);
  const outcome = applyHealthy(active, observation, policy);
  if (outcome) await store.save(outcome.incident);
  return outcome;
}

export type InMemoryIncidentStore = IncidentStore & {
  readonly list: () => ReadonlyArray<Incident>;
  readonly clear: () => void;
};

export function createInMemoryIncidentStore(): InMemoryIncidentStore {
  const incidents = new Map<string, Incident>();
  return {
    async getActive(key) {
      const incident = incidents.get(buildIncidentKey(key)) ?? null;
      return isActive(incident) ? incident : null;
    },
    async save(incident) {
      incidents.set(buildIncidentKey(incident), incident);
    },
    list: () => Array.from(incidents.values()),
    clear: () => incidents.clear(),
  };
}
