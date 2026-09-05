import { describe, expect, it } from 'vitest';

import { IMAGE_DIGEST, NOW_ISO, NOW_MS } from './helpers/fixtures';
import { validateHeartbeat } from '../src/heartbeat';

function heartbeat(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
    ...overrides,
  };
}

describe('heartbeat contract validation', () => {
  it('accepts a well-formed heartbeat and normalizes timestamps', () => {
    const result = validateHeartbeat(
      heartbeat({ sentAt: '2026-09-04T10:00:00Z', lastCompletedAt: '2026-09-04T09:59:00Z' }),
      NOW_MS,
    );
    expect(result).toEqual({
      ok: true,
      heartbeat: {
        controllerId: 'mac-mini-01',
        controllerVersion: '1.4.0',
        imageDigest: IMAGE_DIGEST,
        activeRuntime: 'node22',
        candidateRuntime: 'node24',
        status: 'idle',
        sentAt: '2026-09-04T10:00:00.000Z',
        queueDepth: 0,
        running: 0,
        maxConcurrent: 2,
        lastCompletedAt: '2026-09-04T09:59:00.000Z',
      },
    });
  });

  it('rejects credential-like keys before anything else', () => {
    for (const key of [
      'token',
      'apiKey',
      'api_key',
      'Authorization',
      'private_key',
      'GITHUB_TOKEN',
      'sessionCookie',
      'jwt',
      'signature',
    ]) {
      expect(validateHeartbeat(heartbeat({ [key]: 'value' }), NOW_MS)).toEqual({
        ok: false,
        reason: 'credential_like_key',
      });
    }
  });

  it('rejects unknown keys, nested values and non-object bodies', () => {
    expect(validateHeartbeat(heartbeat({ hostname: 'x' }), NOW_MS)).toEqual({
      ok: false,
      reason: 'unknown_key',
    });
    expect(validateHeartbeat(heartbeat({ queueDepth: { depth: 1 } }), NOW_MS)).toEqual({
      ok: false,
      reason: 'nested_values_not_allowed',
    });
    expect(validateHeartbeat([], NOW_MS)).toEqual({ ok: false, reason: 'body_not_object' });
    expect(validateHeartbeat('heartbeat', NOW_MS)).toEqual({
      ok: false,
      reason: 'body_not_object',
    });
  });

  it('validates every field against the contract', () => {
    const cases: readonly [Record<string, unknown>, string][] = [
      [{ controllerId: 'mac mini' }, 'invalid_controller_id'],
      [{ controllerVersion: '' }, 'invalid_controller_version'],
      [{ imageDigest: 'sha256:short' }, 'invalid_image_digest'],
      [{ activeRuntime: 'node20' }, 'invalid_runtime'],
      [{ candidateRuntime: 'bun' }, 'invalid_runtime'],
      [{ status: 'stopped' }, 'invalid_status'],
      [{ sentAt: 'yesterday' }, 'invalid_sent_at'],
      [{ sentAt: new Date(NOW_MS - 6 * 60_000).toISOString() }, 'sent_at_out_of_window'],
      [{ sentAt: new Date(NOW_MS + 6 * 60_000).toISOString() }, 'sent_at_out_of_window'],
      [{ queueDepth: -1 }, 'invalid_capacity'],
      [{ running: 3, maxConcurrent: 2 }, 'invalid_capacity'],
      [{ maxConcurrent: 0 }, 'invalid_capacity'],
      [{ running: 1.5 }, 'invalid_capacity'],
      [{ lastCompletedAt: 'never' }, 'invalid_last_completed_at'],
    ];
    for (const [overrides, reason] of cases) {
      expect(validateHeartbeat(heartbeat(overrides), NOW_MS)).toEqual({ ok: false, reason });
    }
  });
});
