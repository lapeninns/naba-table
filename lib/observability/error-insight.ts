import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { recordFailureObservation } from './incidents';

import type {
  FailureObservation,
  IncidentOutcome,
  IncidentPolicy,
  IncidentSeverity,
  IncidentStore,
  IncidentTransition,
} from './incidents';

const SERVICE_NAMES = [
  'booking-short-links',
  'email-queue-gateway',
  'sms-summary-gateway',
  'nabatable-web',
] as const;

const safeIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9._:/-]+$/u);
const errorEnvelopeSchema = z.object({
  service: z.enum(SERVICE_NAMES),
  event: z.enum(['http.request.failed', 'web.client.failed']),
  fields: z.object({
    traceId: safeIdentifier,
    deploySha: safeIdentifier,
    requestId: safeIdentifier,
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']),
    path: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/u),
  }),
});

export type ErrorInsight = {
  readonly service: (typeof SERVICE_NAMES)[number];
  readonly traceId: string;
  readonly deploySha: string;
  readonly requestId: string;
  readonly method: string;
  readonly path: string;
  readonly fingerprint: string;
};

export type ErrorInsightEvent = z.infer<typeof errorEnvelopeSchema>['event'];

/** Returns the validated event name of an envelope, or null when invalid. */
export function parseErrorInsightEvent(value: unknown): ErrorInsightEvent | null {
  const parsed = errorEnvelopeSchema.safeParse(value);
  return parsed.success ? parsed.data.event : null;
}

export function parseErrorInsight(value: unknown): ErrorInsight | null {
  const parsed = errorEnvelopeSchema.safeParse(value);
  if (!parsed.success) return null;

  const { service, fields } = parsed.data;
  return {
    service,
    traceId: fields.traceId,
    deploySha: fields.deploySha,
    requestId: fields.requestId,
    method: fields.method,
    path: fields.path,
    fingerprint: `${service}:${fields.method}:${fields.path}`,
  };
}

export function isAuthorizedInsightRequest(
  expectedToken: string,
  authorization: string | null,
): boolean {
  const suppliedToken = authorization?.match(/^Bearer ([^\s]+)$/u)?.[1] ?? '';
  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  return (
    expected.length > 0 &&
    expected.length === supplied.length &&
    timingSafeEqual(expected, supplied)
  );
}

/**
 * Safe incident metadata forwarded with a dispatch so the GitHub workflow can
 * update the existing issue for the incident instead of opening a new one.
 */
export type ErrorInsightIncidentContext = {
  readonly incidentId: string;
  readonly environment: string;
  readonly failureClass: string;
  readonly severity: IncidentSeverity;
  readonly transition: IncidentTransition;
  readonly occurrenceCount: number;
  readonly summarizedFailures: number;
};

export function buildGitHubDispatchRequest(
  insight: ErrorInsight,
  config: { readonly token: string; readonly repository: string },
  incident?: ErrorInsightIncidentContext,
): { url: string; init: RequestInit } {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(config.repository)) {
    throw new Error('Invalid GitHub repository slug.');
  }

  return {
    url: `https://api.github.com/repos/${config.repository}/dispatches`,
    init: {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
        'user-agent': 'nabatable-error-insight-receiver',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({
        event_type: 'runtime-error',
        client_payload: {
          service: insight.service,
          trace_id: insight.traceId,
          deploy_sha: insight.deploySha,
          request_id: insight.requestId,
          method: insight.method,
          path: insight.path,
          fingerprint: insight.fingerprint,
          ...(incident
            ? {
                incident_id: incident.incidentId,
                environment: incident.environment,
                failure_class: incident.failureClass,
                severity: incident.severity,
                incident_action: incident.transition,
                occurrence_count: incident.occurrenceCount,
                summarized_failures: incident.summarizedFailures,
              }
            : {}),
        },
      }),
    },
  };
}

// --- Incident dedupe ------------------------------------------------------

const ENVIRONMENT_NAMES = ['production', 'staging', 'development', 'test'] as const;

export type ErrorInsightEnvironment = (typeof ENVIRONMENT_NAMES)[number] | 'unknown';

/** Derives the deployment environment for the incident dedupe key. */
export function resolveInsightEnvironment(
  env: Partial<Record<'APP_ENV' | 'VERCEL_ENV' | 'NODE_ENV', string | undefined>>,
): ErrorInsightEnvironment {
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (appEnv && (ENVIRONMENT_NAMES as ReadonlyArray<string>).includes(appEnv)) {
    return appEnv as ErrorInsightEnvironment;
  }
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'staging';
  if (vercelEnv === 'development') return 'development';
  if (env.NODE_ENV === 'test') return 'test';
  return 'unknown';
}

export function classifyInsightSeverity(event: ErrorInsightEvent): {
  severity: IncidentSeverity;
} {
  return { severity: event === 'http.request.failed' ? 'critical' : 'warning' };
}

export function buildIncidentObservation(input: {
  readonly insight: ErrorInsight;
  readonly environment: string;
  readonly severity: IncidentSeverity;
  readonly observedAt: Date;
}): FailureObservation {
  return {
    service: input.insight.service,
    environment: input.environment,
    failureClass: `${input.insight.method}:sha256:${createHash('sha256').update(input.insight.path).digest('hex')}`,
    severity: input.severity,
    observedAt: input.observedAt,
    note: 'error-insight',
  };
}

export function toIncidentContext(outcome: IncidentOutcome): ErrorInsightIncidentContext {
  return {
    incidentId: outcome.incident.id,
    environment: outcome.incident.environment,
    failureClass: outcome.incident.failureClass,
    severity: outcome.incident.severity,
    transition: outcome.transition,
    occurrenceCount: outcome.incident.occurrenceCount,
    summarizedFailures: outcome.incident.summarizedFailures,
  };
}

/**
 * Whether a transition should reach GitHub. Opened/updated/escalated
 * observations dispatch; suppressed observations (beyond the bounded update
 * budget) are persisted without dispatch.
 */
export function shouldDispatchIncident(transition: IncidentTransition): boolean {
  return transition === 'opened' || transition === 'updated' || transition === 'escalated';
}

let incidentStore: IncidentStore | null = null;

/** Uses durable storage by default; tests may explicitly inject a store. */
async function getErrorInsightIncidentStore(): Promise<IncidentStore> {
  if (incidentStore) return incidentStore;
  const { createSupabaseIncidentStore } = await import('./supabase-incident-store');
  return createSupabaseIncidentStore();
}

export function setErrorInsightIncidentStore(store: IncidentStore | null): void {
  incidentStore = store;
}

export async function recordErrorInsightIncident(input: {
  readonly insight: ErrorInsight;
  readonly environment: string;
  readonly severity: IncidentSeverity;
  readonly observedAt: Date;
  readonly store?: IncidentStore;
  readonly policy?: IncidentPolicy;
}): Promise<IncidentOutcome> {
  return recordFailureObservation(
    input.store ?? (await getErrorInsightIncidentStore()),
    buildIncidentObservation(input),
    input.policy,
  );
}
