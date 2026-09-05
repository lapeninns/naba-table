import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { acquireSourceToken } from '@/scripts/ci/executor/spool/source-auth';

import { FakeRunner, okResult, when } from './helpers';

const pem = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();
const input = {
  repositoryId: 42,
  remoteUrl: 'https://github.com/example/private.git',
  keychainAccount: 'test-ci',
  env: { NABATABLE_LOCAL_CI_APP_ID: '123', NABATABLE_LOCAL_CI_INSTALLATION_ID: '456' },
};
function fixture(repositoryId = 42) {
  const runner = new FakeRunner([
    when('/usr/bin/security', ['find-generic-password'], okResult({ stdout: pem })),
  ]);
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    if (init.method === 'DELETE') return new Response(null, { status: 204 });
    const body = url.endsWith('/access_tokens')
      ? {
          token: 'test.source.token',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          permissions: { contents: 'read', metadata: 'read' },
        }
      : url.endsWith('/app')
        ? { id: 123 }
        : url.includes('/app/installations/')
          ? { app_id: 123, suspended_at: null }
          : { id: repositoryId, full_name: 'example/private' };
    return Response.json(body, { status: url.endsWith('/access_tokens') ? 201 : 200 });
  });
  return { runner, fetch };
}

describe('host source authentication', () => {
  it('mints only contents-read access for the configured repository and revokes it', async () => {
    const deps = fixture();
    const lease = await acquireSourceToken(input, deps);
    const mint = deps.fetch.mock.calls.find(([url]) => url.endsWith('/access_tokens'));
    expect(JSON.parse(String(mint?.[1].body))).toEqual({
      repository_ids: [42],
      permissions: { contents: 'read' },
    });
    expect(lease.token).toBe('test.source.token');
    await lease.release();
    expect(deps.fetch.mock.calls.at(-1)?.[1].method).toBe('DELETE');
    for (const [, init] of deps.fetch.mock.calls) expect(init.redirect).toBe('error');
  });
  it('rejects a repository mismatch and revokes before returning', async () => {
    const deps = fixture(99);
    await expect(acquireSourceToken(input, deps)).rejects.toThrow('source authentication failed');
    expect(deps.fetch.mock.calls.at(-1)?.[1].method).toBe('DELETE');
  });
  it('refuses conflicting App settings without accessing the Keychain or network', async () => {
    const deps = fixture();
    await expect(
      acquireSourceToken(
        { ...input, env: { ...input.env, NABATABLE_CI_GITHUB_APP_ID: '999' } },
        deps,
      ),
    ).rejects.toThrow('source authentication configuration');
    expect(deps.runner.calls).toHaveLength(0);
    expect(deps.fetch).not.toHaveBeenCalled();
  });
  it('does not propagate provider or Keychain diagnostics', async () => {
    const deps = fixture();
    deps.fetch.mockRejectedValue(new Error('test-sensitive-value'));
    await expect(acquireSourceToken(input, deps)).rejects.toThrow('source authentication failed');
  });
});
