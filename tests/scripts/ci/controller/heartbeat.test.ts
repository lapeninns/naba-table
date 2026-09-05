import { describe, expect, it } from 'vitest';

import {
  assertHeartbeatPayloadSafe,
  createHeartbeatEmitter,
} from '@/scripts/ci/controller/heartbeat';

import { DIGEST_1 } from '../contracts/fixtures';

import type { ControllerHeartbeatPayload } from '@/scripts/ci/controller/types';

const payload: ControllerHeartbeatPayload = {
  controllerId: 'mac-controller',
  controllerVersion: '0.1.0',
  imageDigest: DIGEST_1,
  activeRuntime: 'node22',
  candidateRuntime: 'node24',
  status: 'idle',
  sentAt: '2026-09-04T10:00:00.000Z',
  queueDepth: 0,
  running: 0,
  maxConcurrent: 1,
};

describe('heartbeat payload safety', () => {
  it('accepts the Worker allow-list', () => {
    expect(() => assertHeartbeatPayloadSafe({ ...payload })).not.toThrow();
  });

  it('rejects credential-like, unknown and nested fields and secret-shaped values', () => {
    expect(() => assertHeartbeatPayloadSafe({ ...payload, token: 'x' })).toThrow(/credential/u);
    expect(() => assertHeartbeatPayloadSafe({ ...payload, privateKeyPath: '/x' })).toThrow(
      /credential/u,
    );
    expect(() => assertHeartbeatPayloadSafe({ ...payload, github: { appId: 1 } })).toThrow(
      /not accepted/u,
    );
    expect(() =>
      assertHeartbeatPayloadSafe({ ...payload, controllerId: 'ghs_abcdefghijklmnop' }),
    ).toThrow(/looks like a secret/u);
    expect(() =>
      assertHeartbeatPayloadSafe({
        ...payload,
        controllerId: ['-----BEGIN RSA ', 'PRIVATE KEY-----'].join(''),
      }),
    ).toThrow(/looks like a secret/u);
  });
});

describe('heartbeat emitter', () => {
  it('posts the payload with the Keychain bearer token', async () => {
    const requests: { url: string; init: RequestInit | undefined }[] = [];
    const emitter = createHeartbeatEmitter({
      url: 'https://ops.example.test/heartbeat',
      token: async () => 'test-heartbeat-token',
      fetch: async (url, init) => {
        requests.push({ url, init });
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      },
    });
    const outcome = await emitter.emit(payload);
    expect(outcome).toEqual({ ok: true, status: 202 });
    expect(requests).toHaveLength(1);
    const headers = requests[0]?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-heartbeat-token');
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual(payload);
    expect(emitter.describe()).toEqual({ url: 'https://ops.example.test/heartbeat' });
  });

  it('reports rejection, transport failure and token failure without throwing', async () => {
    const rejected = createHeartbeatEmitter({
      url: 'https://ops.example.test/heartbeat',
      token: async () => 'tok',
      fetch: async () => new Response('nope', { status: 401 }),
    });
    expect(await rejected.emit(payload)).toEqual({ ok: false, status: 401, error: 'HTTP 401' });

    const failing = createHeartbeatEmitter({
      url: 'https://ops.example.test/heartbeat',
      token: async () => 'tok',
      fetch: async () => {
        throw new Error('ECONNRESET');
      },
    });
    expect((await failing.emit(payload)).error).toBe('ECONNRESET');

    const noToken = createHeartbeatEmitter({
      url: 'https://ops.example.test/heartbeat',
      token: async () => {
        throw new Error('Keychain item not readable');
      },
      fetch: async () => new Response('', { status: 202 }),
    });
    const outcome = await noToken.emit(payload);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/Keychain/u);
  });

  it('refuses to send a payload the Worker would reject', async () => {
    let fetched = false;
    const emitter = createHeartbeatEmitter({
      url: 'https://ops.example.test/heartbeat',
      token: async () => 'tok',
      fetch: async () => {
        fetched = true;
        return new Response('', { status: 202 });
      },
    });
    const widened = { ...payload, secretToken: 'x' } as unknown as ControllerHeartbeatPayload;
    const outcome = await emitter.emit(widened);
    expect(outcome.ok).toBe(false);
    expect(fetched).toBe(false);
  });

  it('only accepts https URLs without embedded credentials', () => {
    expect(() =>
      createHeartbeatEmitter({ url: 'http://ops.example.test/heartbeat', token: async () => 'x' }),
    ).toThrow(/https/u);
    expect(() =>
      createHeartbeatEmitter({ url: 'https://user:pw@ops.example.test/', token: async () => 'x' }),
    ).toThrow(/credentials/u);
    expect(() =>
      createHeartbeatEmitter({ url: 'http://localhost:8787/heartbeat', token: async () => 'x' }),
    ).not.toThrow();
    expect(() => createHeartbeatEmitter({ url: 'not a url', token: async () => 'x' })).toThrow(
      /valid URL/u,
    );
  });
});
