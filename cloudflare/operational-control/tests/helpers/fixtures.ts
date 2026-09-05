import { createSqliteContext } from './sqlite-storage';
import { DEFAULT_REQUIRED_HOSTED_WORKFLOWS, GITHUB_ACTIONS_APP_ID } from '../../src/contracts';
import { Coordinator } from '../../src/coordinator';
import { computeWebhookSignature } from '../../src/signature';
import { ciRequestTupleKey } from '../../src/webhook';

import type { FakeCoordinatorStorage } from './sqlite-storage';
import type {
  CiRequestTuple,
  CoordinatorNamespace,
  EvidenceBucket,
  OperationalControlEnv,
} from '../../src/contracts';
import type { CoordinatorDeps } from '../../src/coordinator';

export const REPOSITORY_ID = '123456789';
export const LOCAL_CI_APP_ID = 424242;
export const GATE_WORKFLOW_ID = '1001';
export const FALLBACK_WORKFLOW_ID = '1002';
export const SCHEDULED_VALIDATION_WORKFLOW_ID = '1003';
export const WEBHOOK_SECRET = 'webhook-secret-with-enough-length';
export const HEARTBEAT_TOKEN = 'heartbeat-token-with-enough-length';
export const INCIDENT_ACKNOWLEDGEMENT_TOKEN = 'incident-acknowledgement-token-test-only';
export const MONITORING_TOKEN = 'monitoring-token-with-enough-length';
export const NOW_MS = Date.parse('2026-09-04T10:00:00.000Z');
export const NOW_ISO = new Date(NOW_MS).toISOString();
export const HEAD_SHA = 'a'.repeat(40);
export const BASE_SHA = 'b'.repeat(40);
export const TESTED_SHA = 'c'.repeat(40);
export const IMAGE_DIGEST = `sha256:${'d'.repeat(64)}`;
export const REQUIRED_WORKFLOWS = DEFAULT_REQUIRED_HOSTED_WORKFLOWS;

export function tuple(overrides: Partial<CiRequestTuple> = {}): CiRequestTuple {
  return {
    repositoryId: REPOSITORY_ID,
    profile: 'pr',
    prNumber: 42,
    headSha: HEAD_SHA,
    baseSha: BASE_SHA,
    testedSha: TESTED_SHA,
    policyVersion: 'policy-2026.09',
    imageDigest: IMAGE_DIGEST,
    controllerVersion: '1.4.0',
    attempt: 1,
    ...overrides,
  };
}

export function mainTuple(overrides: Partial<CiRequestTuple> = {}): CiRequestTuple {
  const withPr = tuple({ profile: 'main', testedSha: HEAD_SHA, ...overrides });
  return Object.fromEntries(
    Object.entries(withPr).filter(([key]) => key !== 'prNumber'),
  ) as CiRequestTuple;
}

export type FakeBucket = EvidenceBucket & {
  readonly objects: Map<string, string>;
  failPut: boolean;
  failGet: boolean;
  uploadedAt: Date;
};

export function createFakeBucket(): FakeBucket {
  const bucket: FakeBucket = {
    objects: new Map(),
    failPut: false,
    failGet: false,
    uploadedAt: new Date(NOW_MS),
    async put(key, value) {
      if (bucket.failPut) throw new Error('R2 unavailable');
      bucket.objects.set(key, value);
      return null;
    },
    async head(key) {
      if (bucket.failGet) throw new Error('R2 unavailable');
      const value = bucket.objects.get(key);
      return value === undefined ? null : { uploaded: bucket.uploadedAt, size: value.length };
    },
    async get(key) {
      if (bucket.failGet) throw new Error('R2 unavailable');
      const value = bucket.objects.get(key);
      return value === undefined ? null : { text: async () => value };
    },
  };
  return bucket;
}

export function baseEnv(overrides: Partial<OperationalControlEnv> = {}): OperationalControlEnv {
  return {
    GITHUB_WEBHOOK_SECRET: WEBHOOK_SECRET,
    HEARTBEAT_TOKEN,
    MONITORING_TOKEN,
    INCIDENT_ACKNOWLEDGEMENT_TOKEN,
    REPOSITORY_ID,
    LOCAL_CI_APP_ID: String(LOCAL_CI_APP_ID),
    GATE_WORKFLOW_ID,
    FALLBACK_WORKFLOW_ID,
    SCHEDULED_VALIDATION_WORKFLOW_ID,
    PROTECTED_REF: 'refs/heads/main',
    TARGETS_JSON: JSON.stringify([
      { name: 'web', environment: 'production', url: 'https://app.example.test/api/ready' },
      {
        name: 'booking-short-links',
        environment: 'production',
        url: 'https://go.example.test/ready',
      },
    ]),
    CF_VERSION_METADATA: { id: 'ver-1', tag: 'v1', timestamp: NOW_ISO },
    ...overrides,
  };
}

export function repository(): Record<string, unknown> {
  return { id: Number(REPOSITORY_ID), full_name: 'nabatable/nabatable' };
}

export function checkRunPayload(input: {
  readonly tuple?: CiRequestTuple;
  readonly appId?: number;
  readonly status?: string;
  readonly conclusion?: string | null;
  readonly name?: string;
  readonly externalId?: string;
  readonly completedAt?: string;
  readonly headSha?: string;
  readonly repositoryId?: number;
  readonly checkRunId?: number;
}): Record<string, unknown> {
  const requestTuple = input.tuple ?? tuple();
  return {
    action: 'completed',
    repository: { ...repository(), ...(input.repositoryId ? { id: input.repositoryId } : {}) },
    check_run: {
      id: input.checkRunId ?? 9001,
      name: input.name ?? `Local CI / ${requestTuple.profile}`,
      head_sha: input.headSha ?? requestTuple.headSha,
      external_id: input.externalId ?? ciRequestTupleKey(requestTuple),
      status: input.status ?? 'completed',
      conclusion: input.conclusion === undefined ? 'success' : input.conclusion,
      started_at: new Date(NOW_MS - 120_000).toISOString(),
      completed_at: input.completedAt ?? new Date(NOW_MS - 60_000).toISOString(),
      app: { id: input.appId ?? LOCAL_CI_APP_ID },
    },
  };
}

export function hostedCheckRunPayload(): Record<string, unknown> {
  return checkRunPayload({
    appId: GITHUB_ACTIONS_APP_ID,
    name: 'Full Vitest suite',
    externalId: '',
  });
}

export function workflowRunPayload(input: {
  readonly path: string;
  readonly runId?: number;
  readonly runAttempt?: number;
  readonly status?: string;
  readonly conclusion?: string | null;
  readonly headSha?: string;
  readonly updatedAt?: string;
}): Record<string, unknown> {
  return {
    action: 'completed',
    repository: repository(),
    workflow_run: {
      id:
        input.runId ??
        500 + REQUIRED_WORKFLOWS.indexOf(input.path as (typeof REQUIRED_WORKFLOWS)[number]),
      workflow_id:
        7000 + REQUIRED_WORKFLOWS.indexOf(input.path as (typeof REQUIRED_WORKFLOWS)[number]),
      run_attempt: input.runAttempt ?? 1,
      path: input.path,
      head_sha: input.headSha ?? HEAD_SHA,
      status: input.status ?? 'completed',
      conclusion: input.conclusion === undefined ? 'success' : input.conclusion,
      updated_at: input.updatedAt ?? new Date(NOW_MS - 30_000).toISOString(),
    },
  };
}

export function pullRequestPayload(input: {
  readonly action: string;
  readonly number?: number;
  readonly headSha?: string;
}): Record<string, unknown> {
  return {
    action: input.action,
    repository: repository(),
    pull_request: {
      number: input.number ?? 42,
      head: { sha: input.headSha ?? HEAD_SHA },
      updated_at: new Date(NOW_MS - 10_000).toISOString(),
    },
  };
}

export function pushPayload(): Record<string, unknown> {
  return {
    ref: 'refs/heads/main',
    after: HEAD_SHA,
    repository: { ...repository(), pushed_at: Math.floor((NOW_MS - 5_000) / 1000) },
    head_commit: { timestamp: new Date(NOW_MS - 5_000).toISOString() },
  };
}

export async function signedWebhookRequest(input: {
  readonly event: string;
  readonly deliveryId: string;
  readonly payload: unknown;
  readonly secret?: string;
  readonly rawBody?: string;
  readonly signatureBody?: string;
  readonly signatureHeader?: string | null;
}): Promise<Request> {
  const rawBody = input.rawBody ?? JSON.stringify(input.payload);
  const signedOver = input.signatureBody ?? rawBody;
  const signature = await computeWebhookSignature(
    input.secret ?? WEBHOOK_SECRET,
    new TextEncoder().encode(signedOver),
  );
  const headers = new Headers({
    'content-type': 'application/json',
    'x-github-delivery': input.deliveryId,
    'x-github-event': input.event,
  });
  if (input.signatureHeader !== null)
    headers.set('x-hub-signature-256', input.signatureHeader ?? signature);
  return new Request('https://operational-control.example.test/github/webhook', {
    method: 'POST',
    headers,
    body: rawBody,
  });
}

export function bearerRequest(path: string, token: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  return new Request(`https://operational-control.example.test${path}`, { ...init, headers });
}

export type InProcessCoordinator = {
  readonly coordinator: Coordinator;
  readonly namespace: CoordinatorNamespace;
  readonly storage: FakeCoordinatorStorage;
  readonly dispatchCalls: CiRequestTuple[];
  readonly logs: string[];
  clock: { nowMs: number };
};

export async function createInProcessCoordinator(
  env: OperationalControlEnv,
  deps: Partial<CoordinatorDeps> = {},
): Promise<InProcessCoordinator> {
  const context = await createSqliteContext();
  const clock = { nowMs: NOW_MS };
  const dispatchCalls: CiRequestTuple[] = [];
  const logs: string[] = [];
  let ids = 0;
  const coordinator = new Coordinator(context, env, {
    now: () => clock.nowMs,
    newId: () => `incident-${(ids += 1)}`,
    sink: (record) => logs.push(record),
    async dispatchGate(requestTuple) {
      dispatchCalls.push(requestTuple);
      return { result: 'dispatched', workflowId: GATE_WORKFLOW_ID, ref: 'refs/heads/main' };
    },
    async writeEvidence() {
      return { ok: true, key: 'evidence/test', bytes: 1 };
    },
    ...deps,
  });
  const namespace: CoordinatorNamespace = {
    idFromName: (name) => ({ toString: () => name }),
    get: () => ({ fetch: (input, init) => coordinator.fetch(new Request(input, init)) }),
  };
  return { coordinator, namespace, storage: context.storage, dispatchCalls, logs, clock };
}
