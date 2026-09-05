import { resolveControlPlaneConfig } from './config';
import {
  ACTIVE_RUNTIME,
  CANDIDATE_RUNTIME,
  EVIDENCE_LATEST_KEY,
  HEARTBEAT_MAX_BYTES,
  READY_CHECK_TIMEOUT_MS,
  SERVICE_NAME,
  WEBHOOK_MAX_BYTES,
} from './contracts';
import { createCoordinatorClient } from './coordinator-client';
import { writeEvidence } from './evidence';
import { validateHeartbeat } from './heartbeat';
import { isBearerAuthorized, json, parseJsonBytes, readBoundedBody, withTimeout } from './http';
import { runScheduledCycle } from './readiness';
import { verifyWebhookSignature } from './signature';
import { parseWebhookDelivery } from './webhook';
import { observeWorkerRequest, writeStructuredLog } from '../../shared/observability';

import type { OperationalControlEnv } from './contracts';
import type { CoordinatorClient } from './coordinator-client';

export { Coordinator } from './coordinator';

export type WorkerDeps = {
  readonly now?: () => number;
  readonly fetcher?: typeof fetch;
  readonly waitUntil?: (promise: Promise<unknown>) => void;
};

export function coordinatorFor(env: OperationalControlEnv): CoordinatorClient | null {
  if (!env.COORDINATOR) return null;
  return createCoordinatorClient(env.COORDINATOR.get(env.COORDINATOR.idFromName('primary')));
}

function log(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown>,
): void {
  writeStructuredLog({ level, event, service: SERVICE_NAME, fields });
}

async function handleWebhook(
  request: Request,
  env: OperationalControlEnv,
  deps: WorkerDeps,
): Promise<Response> {
  const config = resolveControlPlaneConfig(env);
  if (!config.ok) {
    log('error', 'webhook.unconfigured', { missing: config.missing });
    return json({ error: 'Control plane is unconfigured.' }, { status: 503 });
  }
  const coordinator = coordinatorFor(env);
  if (!coordinator) return json({ error: 'Coordinator binding is missing.' }, { status: 503 });

  const body = await readBoundedBody(request, WEBHOOK_MAX_BYTES);
  if (!body.ok) {
    return json(
      { error: body.reason === 'too_large' ? 'Payload too large.' : 'Unreadable payload.' },
      { status: body.reason === 'too_large' ? 413 : 400 },
    );
  }
  const signatureValid = await verifyWebhookSignature({
    secret: env.GITHUB_WEBHOOK_SECRET,
    rawBody: body.bytes,
    signatureHeader: request.headers.get('x-hub-signature-256'),
  });
  if (!signatureValid) return json({ error: 'Invalid signature.' }, { status: 401 });

  const nowMs = (deps.now ?? Date.now)();
  const parsed = parseWebhookDelivery({
    headers: request.headers,
    payload: parseJsonBytes(body.bytes),
    config: config.config,
    nowMs,
  });
  if (!parsed.ok) {
    log('warn', 'webhook.rejected', {
      code: parsed.code,
      eventType: request.headers.get('x-github-event'),
    });
    return json({ error: parsed.code }, { status: parsed.status });
  }

  const receivedAt = new Date(nowMs).toISOString();
  const recorded = await coordinator.recordDelivery({ delivery: parsed.delivery, receivedAt });
  if (recorded.duplicate) return json({ accepted: false, duplicate: true }, { status: 200 });

  const { event } = parsed.delivery;
  if (event.type === 'local_check' || event.type === 'hosted_run') {
    const evidence = writeEvidence({
      bucket: env.EVIDENCE_BUCKET,
      kind: 'webhook',
      id: parsed.delivery.deliveryId,
      payload: {
        eventType: parsed.delivery.eventType,
        event,
        candidateKey: recorded.candidateKey,
        candidateState: recorded.candidateState,
      },
      now: new Date(nowMs),
    }).catch(() => undefined);
    if (deps.waitUntil) deps.waitUntil(evidence);
    else await evidence;
  }
  log('info', 'webhook.accepted', {
    eventType: parsed.delivery.eventType,
    kind: event.type,
    candidateState: recorded.candidateState,
  });
  return json({ accepted: true, candidateState: recorded.candidateState }, { status: 202 });
}

async function handleHeartbeat(
  request: Request,
  env: OperationalControlEnv,
  deps: WorkerDeps,
): Promise<Response> {
  if (!isBearerAuthorized(request, env.HEARTBEAT_TOKEN))
    return json({ error: 'Unauthorized' }, { status: 401 });
  const coordinator = coordinatorFor(env);
  if (!coordinator) return json({ error: 'Coordinator binding is missing.' }, { status: 503 });
  const body = await readBoundedBody(request, HEARTBEAT_MAX_BYTES);
  if (!body.ok)
    return json(
      { error: 'Invalid heartbeat body.' },
      { status: body.reason === 'too_large' ? 413 : 400 },
    );
  const payload = parseJsonBytes(body.bytes);
  if (payload === undefined) return json({ error: 'Invalid JSON body.' }, { status: 400 });
  const nowMs = (deps.now ?? Date.now)();
  const validated = validateHeartbeat(payload, nowMs);
  if (!validated.ok) {
    log('warn', 'heartbeat.rejected', { reason: validated.reason });
    return json({ error: validated.reason }, { status: 422 });
  }
  await coordinator.recordHeartbeat({
    heartbeat: validated.heartbeat,
    receivedAt: new Date(nowMs).toISOString(),
  });
  return json({ recorded: true }, { status: 202 });
}

async function handleReady(request: Request, env: OperationalControlEnv): Promise<Response> {
  if (!isBearerAuthorized(request, env.MONITORING_TOKEN))
    return json({ error: 'Unauthorized' }, { status: 401 });
  const config = resolveControlPlaneConfig(env);
  const coordinator = coordinatorFor(env);

  let coordinatorCheck: {
    ok: boolean;
    controller: { state: string; ageSeconds: number | null } | null;
  } = { ok: false, controller: null };
  if (coordinator) {
    try {
      const status = await withTimeout(
        coordinator.status(),
        READY_CHECK_TIMEOUT_MS,
        'coordinator status',
      );
      coordinatorCheck = {
        ok: true,
        controller: {
          state: status.heartbeat.state,
          ageSeconds:
            status.heartbeat.ageMs === null ? null : Math.floor(status.heartbeat.ageMs / 1000),
        },
      };
    } catch {
      coordinatorCheck = { ok: false, controller: null };
    }
  }

  let evidenceCheck: { ok: boolean; latestPresent: boolean } = { ok: false, latestPresent: false };
  if (env.EVIDENCE_BUCKET) {
    try {
      const head = await withTimeout(
        env.EVIDENCE_BUCKET.head(EVIDENCE_LATEST_KEY),
        READY_CHECK_TIMEOUT_MS,
        'evidence head',
      );
      evidenceCheck = { ok: true, latestPresent: head !== null };
    } catch {
      evidenceCheck = { ok: false, latestPresent: false };
    }
  }

  const ready = config.ok && coordinatorCheck.ok && evidenceCheck.ok;
  return json(
    {
      status: ready ? 'ok' : 'degraded',
      service: SERVICE_NAME,
      // Same contract as the customer Workers: the baked source SHA wins so
      // deploy:workers can bind /ready to the exact revision it just shipped.
      revision: env.DEPLOY_SHA?.trim() || env.CF_VERSION_METADATA?.id || null,
      activeRuntime: ACTIVE_RUNTIME,
      candidateRuntime: CANDIDATE_RUNTIME,
      config: config.ok ? { ok: true } : { ok: false, missing: config.missing },
      checks: { coordinator: coordinatorCheck, evidenceBucket: evidenceCheck },
    },
    { status: ready ? 200 : 503 },
  );
}

async function handleAcknowledge(
  request: Request,
  env: OperationalControlEnv,
  incidentId: string,
  deps: WorkerDeps,
): Promise<Response> {
  if (!isBearerAuthorized(request, env.INCIDENT_ACKNOWLEDGEMENT_TOKEN))
    return json({ error: 'Unauthorized' }, { status: 401 });
  const coordinator = coordinatorFor(env);
  if (!coordinator) return json({ error: 'Coordinator binding is missing.' }, { status: 503 });
  const acknowledged = await coordinator.acknowledgeIncident(
    incidentId,
    new Date((deps.now ?? Date.now)()).toISOString(),
  );
  return json({ acknowledged }, { status: acknowledged ? 200 : 404 });
}

export async function handleRequest(
  request: Request,
  env: OperationalControlEnv,
  deps: WorkerDeps = {},
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    return json({ status: 'ok', service: SERVICE_NAME });
  }
  if (request.method === 'GET' && url.pathname === '/ready') return handleReady(request, env);
  if (request.method === 'POST' && url.pathname === '/github/webhook')
    return handleWebhook(request, env, deps);
  if (request.method === 'POST' && url.pathname === '/heartbeat')
    return handleHeartbeat(request, env, deps);
  const acknowledge = url.pathname.match(/^\/incidents\/([A-Za-z0-9-]{1,64})\/acknowledge$/u);
  if (request.method === 'POST' && acknowledge?.[1])
    return handleAcknowledge(request, env, acknowledge[1], deps);
  return json({ error: 'Not found' }, { status: 404 });
}

const worker = {
  async fetch(
    request: Request,
    env: OperationalControlEnv,
    ctx?: ExecutionContext,
  ): Promise<Response> {
    const waitUntil = (promise: Promise<unknown>): void => ctx?.waitUntil(promise);
    return observeWorkerRequest({
      request,
      service: SERVICE_NAME,
      deploySha: env.DEPLOY_SHA ?? env.CF_VERSION_METADATA?.id,
      errorInsight: {
        url: env.ERROR_INSIGHT_WEBHOOK_URL,
        token: env.ERROR_INSIGHT_TOKEN,
        waitUntil,
      },
      posthog: { apiKey: env.POSTHOG_PROJECT_API_KEY, host: env.POSTHOG_HOST, waitUntil },
      handler: () => handleRequest(request, env, { waitUntil }),
    });
  },

  async scheduled(_controller: ScheduledController, env: OperationalControlEnv): Promise<void> {
    await runScheduledCycle({
      env,
      coordinator: coordinatorFor(env),
      fetcher: fetch,
      now: Date.now,
    });
  },
};

export default worker;
