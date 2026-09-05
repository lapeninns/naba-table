import { describe, expect, it, vi } from 'vitest';

import { canonicalTuple, parseCiTuple, type CiRequestTuple } from '@/scripts/deploy/ci-tuple';
import {
  GitHubVariableLockStore,
  LockHeldError,
  acquireLock,
  parseLockRecord,
  releaseLock,
  type LockRecord,
  type LockStore,
} from '@/scripts/deploy/staging-lock';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

const tupleA: CiRequestTuple = {
  repositoryId: '123456',
  profile: 'main',
  headSha: SHA_A,
  baseSha: SHA_B,
  testedSha: SHA_A,
  policyVersion: '2026.09',
  imageDigest: 'sha256:' + 'c'.repeat(64),
  controllerVersion: '1.0.0',
  attempt: 1,
};

const tupleB: CiRequestTuple = { ...tupleA, prNumber: 42, profile: 'pr', attempt: 2 };

class MemoryStore implements LockStore {
  record: LockRecord | null = null;
  writes = 0;
  read(): Promise<LockRecord | null> {
    return Promise.resolve(this.record);
  }
  write(record: LockRecord | null): Promise<void> {
    this.writes += 1;
    this.record = record;
    return Promise.resolve();
  }
}

const at = (iso: string) => () => new Date(iso);

describe('deploy:staging-lock', () => {
  it('acquires a free lock with a TTL and renews for the same owner/tuple @deploy', async () => {
    const store = new MemoryStore();
    const first = await acquireLock({
      store,
      owner: 'release-gate',
      tuple: tupleA,
      ttlSeconds: 600,
      now: at('2026-09-05T10:00:00.000Z'),
    });
    expect(first.status).toBe('acquired');
    expect(first.record.expiresAt).toBe('2026-09-05T10:10:00.000Z');

    const renewed = await acquireLock({
      store,
      owner: 'release-gate',
      tuple: { ...tupleA },
      ttlSeconds: 600,
      now: at('2026-09-05T10:05:00.000Z'),
    });
    expect(renewed.status).toBe('renewed');
    expect(renewed.record.acquiredAt).toBe('2026-09-05T10:00:00.000Z');
    expect(renewed.record.expiresAt).toBe('2026-09-05T10:15:00.000Z');
  });

  it('refuses acquire and release from a different tuple or owner while live @deploy @security', async () => {
    const store = new MemoryStore();
    await acquireLock({
      store,
      owner: 'release-gate',
      tuple: tupleA,
      ttlSeconds: 600,
      now: at('2026-09-05T10:00:00.000Z'),
    });
    await expect(
      acquireLock({
        store,
        owner: 'release-gate',
        tuple: tupleB,
        ttlSeconds: 600,
        now: at('2026-09-05T10:01:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(LockHeldError);
    await expect(
      acquireLock({
        store,
        owner: 'someone-else',
        tuple: tupleA,
        ttlSeconds: 600,
        now: at('2026-09-05T10:01:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(LockHeldError);
    await expect(
      releaseLock({
        store,
        owner: 'release-gate',
        tuple: tupleB,
        now: at('2026-09-05T10:01:00.000Z'),
      }),
    ).rejects.toThrow(/refusing to release/u);
    expect(store.record?.owner).toBe('release-gate');
  });

  it('treats an expired lock as free and clears it on release @deploy', async () => {
    const store = new MemoryStore();
    await acquireLock({
      store,
      owner: 'release-gate',
      tuple: tupleA,
      ttlSeconds: 60,
      now: at('2026-09-05T10:00:00.000Z'),
    });
    const later = at('2026-09-05T10:02:00.000Z');
    const released = await releaseLock({ store, owner: 'other', tuple: tupleB, now: later });
    expect(released.status).toBe('not-held');
    expect(store.record).toBeNull();
    const acquired = await acquireLock({
      store,
      owner: 'other',
      tuple: tupleB,
      ttlSeconds: 60,
      now: later,
    });
    expect(acquired.status).toBe('acquired');
    const done = await releaseLock({ store, owner: 'other', tuple: tupleB, now: later });
    expect(done.status).toBe('released');
  });

  it('rejects invalid TTLs, owners and malformed lock records @deploy', async () => {
    const store = new MemoryStore();
    await expect(acquireLock({ store, owner: 'x', tuple: tupleA, ttlSeconds: 0 })).rejects.toThrow(
      /ttlSeconds/u,
    );
    await expect(
      acquireLock({ store, owner: '  ', tuple: tupleA, ttlSeconds: 10 }),
    ).rejects.toThrow(/owner/u);
    expect(parseLockRecord({ owner: 'x', tuple: {}, acquiredAt: 'a', expiresAt: 'b' })).toBeNull();
    expect(parseLockRecord({ released: true })).toBeNull();
    expect(() => parseCiTuple({ ...tupleA, headSha: 'short' })).toThrow(/40-hex/u);
    expect(canonicalTuple(tupleA)).toBe(canonicalTuple({ ...tupleA }));
  });

  it('persists through the GitHub Actions variable API with an injected fetch @deploy @external-mock', async () => {
    let stored: string | null = null;
    const calls: { method: string; url: string; auth: boolean }[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ method, url, auth: headers.authorization === 'Bearer ghs_fake_token' });
      if (method === 'GET') {
        return stored === null
          ? new Response('{"message":"Not Found"}', { status: 404 })
          : new Response(JSON.stringify({ name: 'STAGING_DEPLOY_LOCK', value: stored }), {
              status: 200,
            });
      }
      const body = JSON.parse(String(init?.body)) as { value: string };
      if (method === 'PATCH' && stored === null) return new Response('', { status: 404 });
      stored = body.value;
      return new Response(null, { status: method === 'POST' ? 201 : 204 });
    });
    const store = new GitHubVariableLockStore({
      repository: 'lapen-inns/nabatable',
      token: 'ghs_fake_token',
      fetchImpl,
    });
    expect(await store.read()).toBeNull();
    const result = await acquireLock({
      store,
      owner: 'hosted-fallback',
      tuple: tupleA,
      ttlSeconds: 300,
      now: at('2026-09-05T10:00:00.000Z'),
    });
    expect(result.status).toBe('acquired');
    const read = await store.read();
    expect(read?.owner).toBe('hosted-fallback');
    expect(read?.tuple).toEqual(tupleA);
    // read (null) -> acquire reads again -> PATCH 404 -> POST create -> read back.
    expect(calls.map((call) => call.method)).toEqual(['GET', 'GET', 'PATCH', 'POST', 'GET']);
    expect(calls.every((call) => call.auth)).toBe(true);
    expect(calls[0]?.url).toBe(
      'https://api.github.com/repos/lapen-inns/nabatable/actions/variables/STAGING_DEPLOY_LOCK',
    );
    await releaseLock({
      store,
      owner: 'hosted-fallback',
      tuple: tupleA,
      now: at('2026-09-05T10:01:00.000Z'),
    });
    expect(await store.read()).toBeNull();
  });

  it('refuses to construct a GitHub store without a repository slug or token @deploy', () => {
    expect(() => new GitHubVariableLockStore({ repository: 'bad', token: 't' })).toThrow(
      /owner\/repo/u,
    );
    expect(() => new GitHubVariableLockStore({ repository: 'a/b', token: '' })).toThrow(/token/u);
  });
});
