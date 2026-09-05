import { describe, expect, it } from 'vitest';

import {
  baseEnv,
  BASE_SHA,
  checkRunPayload,
  HEAD_SHA,
  hostedCheckRunPayload,
  mainTuple,
  NOW_MS,
  pullRequestPayload,
  pushPayload,
  repository,
  REQUIRED_WORKFLOWS,
  TESTED_SHA,
  tuple,
  workflowRunPayload,
} from './helpers/fixtures';
import { resolveControlPlaneConfig } from '../src/config';
import { ciRequestTupleKey, parseCiRequestTuple, parseWebhookDelivery } from '../src/webhook';

import type { ControlPlaneConfig } from '../src/config';
import type { CiRequestTuple } from '../src/contracts';

const resolved = resolveControlPlaneConfig(baseEnv());
const config: ControlPlaneConfig = resolved.ok
  ? resolved.config
  : (() => {
      throw new Error('fixture env must resolve');
    })();

function headers(event: string, deliveryId = 'delivery-0001'): Headers {
  return new Headers({ 'x-github-delivery': deliveryId, 'x-github-event': event });
}

function parse(event: string, payload: unknown, deliveryId?: string) {
  return parseWebhookDelivery({
    headers: headers(event, deliveryId),
    payload,
    config,
    nowMs: NOW_MS,
  });
}

describe('webhook normalization', () => {
  it('normalizes a completed local check run carrying a valid tuple', () => {
    const result = parse('check_run', checkRunPayload({}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.delivery.deliveryId).toBe('delivery-0001');
    expect(result.delivery.eventType).toBe('check_run');
    expect(result.delivery.event).toMatchObject({
      type: 'local_check',
      tuple: tuple(),
      checkRunId: 9001,
      name: 'Local CI / pr',
      status: 'completed',
      conclusion: 'success',
    });
  });

  it('rejects deliveries for a different repository id', () => {
    expect(parse('check_run', checkRunPayload({ repositoryId: 987654321 }))).toEqual({
      ok: false,
      status: 403,
      code: 'wrong_repository',
    });
    expect(parse('check_run', { ...checkRunPayload({}), repository: { id: '123456789' } })).toEqual(
      {
        ok: false,
        status: 400,
        code: 'invalid_payload',
      },
    );
  });

  it('rejects check runs from an unexpected GitHub App but observes GitHub Actions runs', () => {
    expect(parse('check_run', checkRunPayload({ appId: 777 }))).toEqual({
      ok: false,
      status: 403,
      code: 'unexpected_app',
    });
    const observed = parse('check_run', hostedCheckRunPayload());
    expect(observed.ok).toBe(true);
    if (observed.ok) {
      expect(observed.delivery.event).toMatchObject({ type: 'observed', kind: 'hosted_check' });
    }
  });

  it('rejects local check runs whose name or external_id disagree with the tuple', () => {
    expect(parse('check_run', checkRunPayload({ name: 'Local CI / main' }))).toEqual({
      ok: false,
      status: 422,
      code: 'invalid_tuple',
    });
    expect(parse('check_run', checkRunPayload({ name: 'Release gate' }))).toEqual({
      ok: false,
      status: 422,
      code: 'invalid_tuple',
    });
    expect(parse('check_run', checkRunPayload({ externalId: 'not-a-tuple-key' }))).toEqual({
      ok: false,
      status: 422,
      code: 'invalid_tuple',
    });
    // The legacy JSON encoding is not the controller's external_id format and must not be accepted.
    expect(parse('check_run', checkRunPayload({ externalId: JSON.stringify(tuple()) }))).toEqual({
      ok: false,
      status: 422,
      code: 'invalid_tuple',
    });
    expect(parse('check_run', checkRunPayload({ headSha: BASE_SHA }))).toEqual({
      ok: false,
      status: 422,
      code: 'invalid_tuple',
    });
    expect(parse('check_run', checkRunPayload({ status: 'unknown' }))).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_payload',
    });
    expect(parse('check_run', checkRunPayload({ conclusion: 'maybe' }))).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_payload',
    });
    expect(parse('check_run', checkRunPayload({ checkRunId: -1 }))).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_payload',
    });
    expect(parse('check_run', { repository: repository(), check_run: { id: 1 } })).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_payload',
    });
  });

  it('rejects missing delivery ids, unsupported events and non-object payloads', () => {
    expect(parse('check_run', checkRunPayload({}), '')).toEqual({
      ok: false,
      status: 400,
      code: 'missing_delivery_id',
    });
    expect(parse('check_run', checkRunPayload({}), 'bad id!')).toEqual({
      ok: false,
      status: 400,
      code: 'missing_delivery_id',
    });
    expect(parse('issues', checkRunPayload({}))).toEqual({
      ok: false,
      status: 400,
      code: 'unsupported_event',
    });
    expect(parse('check_run', 'text')).toEqual({ ok: false, status: 400, code: 'invalid_payload' });
    expect(parse('check_run', [])).toEqual({ ok: false, status: 400, code: 'invalid_payload' });
  });

  it('rejects deliveries outside the replay window', () => {
    const stale = checkRunPayload({ completedAt: new Date(NOW_MS - 61 * 60_000).toISOString() });
    expect(parse('check_run', stale)).toEqual({ ok: false, status: 403, code: 'stale_delivery' });
    const future = checkRunPayload({ completedAt: new Date(NOW_MS + 6 * 60_000).toISOString() });
    expect(parse('check_run', future)).toEqual({ ok: false, status: 403, code: 'stale_delivery' });
    const skewed = checkRunPayload({ completedAt: new Date(NOW_MS + 4 * 60_000).toISOString() });
    expect(parse('check_run', skewed).ok).toBe(true);
  });

  it('normalizes workflow_run, pull_request, push and check_suite events', () => {
    const run = parse('workflow_run', workflowRunPayload({ path: REQUIRED_WORKFLOWS[0] }));
    expect(run.ok).toBe(true);
    if (run.ok) {
      expect(run.delivery.event).toMatchObject({
        type: 'hosted_run',
        headSha: HEAD_SHA,
        workflowPath: REQUIRED_WORKFLOWS[0],
        workflowId: 7000,
        runId: 500,
        runAttempt: 1,
        status: 'completed',
        conclusion: 'success',
      });
    }
    expect(parse('workflow_run', workflowRunPayload({ path: 'evil/../x.yml' }))).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_payload',
    });
    expect(parse('workflow_run', { repository: repository() })).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_payload',
    });

    const pr = parse('pull_request', pullRequestPayload({ action: 'synchronize' }));
    expect(pr.ok).toBe(true);
    if (pr.ok) {
      expect(pr.delivery.event).toMatchObject({
        type: 'pull_request',
        action: 'synchronize',
        prNumber: 42,
        headSha: HEAD_SHA,
      });
    }
    expect(parse('pull_request', pullRequestPayload({ action: 'bad action' }))).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_payload',
    });
    expect(parse('pull_request', { repository: repository(), pull_request: {} })).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_payload',
    });

    const push = parse('push', pushPayload());
    expect(push.ok).toBe(true);
    if (push.ok) {
      expect(push.delivery.event).toMatchObject({
        type: 'push',
        ref: 'refs/heads/main',
        afterSha: HEAD_SHA,
      });
    }
    const { head_commit: _omitted, ...withoutHeadCommit } = pushPayload();
    void _omitted;
    const epochPush = parse('push', withoutHeadCommit);
    expect(epochPush.ok).toBe(true);
    if (epochPush.ok) {
      expect(epochPush.delivery.event.occurredAt).toBe(new Date(NOW_MS - 5_000).toISOString());
    }
    expect(parse('push', { ...pushPayload(), ref: 'main' })).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_payload',
    });

    const suite = parse('check_suite', {
      repository: repository(),
      check_suite: { head_sha: HEAD_SHA, updated_at: new Date(NOW_MS).toISOString() },
    });
    expect(suite.ok).toBe(true);
    if (suite.ok) {
      expect(suite.delivery.event).toMatchObject({ type: 'observed', kind: 'check_suite' });
    }
    expect(parse('check_suite', { repository: repository(), check_suite: {} })).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_payload',
    });
  });
});

describe('CI request tuple parsing', () => {
  const PR_KEY = `nabatable-ci/v1:123456789:pr:42:${HEAD_SHA}:${BASE_SHA}:${TESTED_SHA}:policy-2026.09:sha256:${'d'.repeat(64)}:1.4.0:1`;

  it('serializes tuples exactly like the controller and gate tuple key', () => {
    expect(ciRequestTupleKey(tuple())).toBe(PR_KEY);
    expect(ciRequestTupleKey(mainTuple())).toBe(
      `nabatable-ci/v1:123456789:main:none:${HEAD_SHA}:${BASE_SHA}:${HEAD_SHA}:policy-2026.09:sha256:${'d'.repeat(64)}:1.4.0:1`,
    );
  });

  it('round-trips PR, main and nightly tuple keys', () => {
    expect(parseCiRequestTuple(PR_KEY, config)).toEqual(tuple());
    expect(parseCiRequestTuple(ciRequestTupleKey(mainTuple()), config)).toEqual(mainTuple());
    expect(
      parseCiRequestTuple(ciRequestTupleKey(mainTuple({ profile: 'nightly' })), config),
    ).toEqual(mainTuple({ profile: 'nightly' }));
    expect(parseCiRequestTuple(ciRequestTupleKey(tuple({ attempt: 100 })), config)).toEqual(
      tuple({ attempt: 100 }),
    );
    const parsedMain = parseCiRequestTuple(ciRequestTupleKey(mainTuple()), config);
    expect(parsedMain).not.toBeNull();
    expect(parsedMain && 'prNumber' in parsedMain).toBe(false);
  });

  it('accepts only strings in the exact key format, never JSON or objects', () => {
    const cases: unknown[] = [
      JSON.stringify(tuple()),
      tuple(),
      mainTuple(),
      null,
      undefined,
      42,
      '',
      'not a tuple key',
      `${PR_KEY}:`,
      `${PR_KEY}:extra`,
      ` ${PR_KEY}`,
      PR_KEY.replace('nabatable-ci/v1', 'nabatable-ci/v2'),
      PR_KEY.replace('nabatable-ci/v1:', ''),
    ];
    for (const value of cases) {
      expect(parseCiRequestTuple(value, config), String(value)).toBeNull();
    }
  });

  it('fails closed on any drift from the tuple contract', () => {
    const cases: readonly Partial<Record<keyof CiRequestTuple, unknown>>[] = [
      { repositoryId: '1' },
      { repositoryId: '0123456789' },
      { profile: 'release' },
      { headSha: 'abc' },
      { headSha: HEAD_SHA.toUpperCase() },
      { baseSha: '' },
      { testedSha: HEAD_SHA },
      { prNumber: 0 },
      { prNumber: 10_000_001 },
      { prNumber: 'none' },
      { policyVersion: 'policy with spaces' },
      { policyVersion: 'a'.repeat(65) },
      { controllerVersion: '' },
      { imageDigest: 'sha256:abc' },
      { imageDigest: `sha512:${'d'.repeat(64)}` },
      { imageDigest: `sha256:${'D'.repeat(64)}` },
      { attempt: 0 },
      { attempt: 101 },
      { attempt: '01' },
      { attempt: '+1' },
      { attempt: 1.5 },
    ];
    for (const overrides of cases) {
      const key = ciRequestTupleKey({ ...tuple(), ...overrides } as CiRequestTuple);
      expect(parseCiRequestTuple(key, config), key).toBeNull();
    }
    expect(
      parseCiRequestTuple(ciRequestTupleKey({ ...mainTuple(), prNumber: 42 }), config),
    ).toBeNull();
    expect(
      parseCiRequestTuple(ciRequestTupleKey(mainTuple({ testedSha: TESTED_SHA })), config),
    ).toBeNull();
    // A different configured repository rejects an otherwise valid key.
    expect(parseCiRequestTuple(PR_KEY, { repositoryId: '987654321' })).toBeNull();
  });

  it('rejects colons smuggled into free-text fields', () => {
    const smuggled = `nabatable-ci/v1:123456789:pr:42:${HEAD_SHA}:${BASE_SHA}:${TESTED_SHA}:policy:2026:sha256:${'d'.repeat(64)}:1`;
    expect(smuggled.split(':')).toHaveLength(12);
    expect(parseCiRequestTuple(smuggled, config)).toBeNull();
  });
});
