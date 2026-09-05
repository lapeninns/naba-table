import { createAppJwt, parsePrivateKey } from '../../controller/github/jwt';
import type { FetchLike } from '../r2/upload';
import type { CommandRunner } from '../runner';

interface SourceAuthInput {
  readonly repositoryId: number;
  readonly remoteUrl: string;
  readonly keychainAccount: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}
interface SourceAuthDeps {
  readonly runner: CommandRunner;
  readonly fetch: FetchLike;
}

function integerSetting(env: SourceAuthInput['env'], primary: string, alias: string): number {
  const value = env[primary] ?? env[alias];
  if (
    !value ||
    !/^[1-9][0-9]*$/u.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    (env[primary] !== undefined && env[alias] !== undefined && env[primary] !== env[alias])
  ) {
    throw new Error('source authentication configuration is missing or inconsistent');
  }
  return Number(value);
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('invalid response');
  return value as Record<string, unknown>;
}

/** Host-only CI App authentication. No ambient developer token or credential helper. */
export async function acquireSourceToken(
  input: SourceAuthInput,
  deps: SourceAuthDeps,
): Promise<{
  readonly token: string;
  readonly release: () => Promise<void>;
}> {
  const appId = integerSetting(
    input.env,
    'NABATABLE_CI_GITHUB_APP_ID',
    'NABATABLE_LOCAL_CI_APP_ID',
  );
  const installationId = integerSetting(
    input.env,
    'NABATABLE_CI_GITHUB_APP_INSTALLATION_ID',
    'NABATABLE_LOCAL_CI_INSTALLATION_ID',
  );
  const remote = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git$/u.exec(
    input.remoteUrl,
  );
  if (!remote || !Number.isSafeInteger(input.repositoryId) || input.repositoryId <= 0) {
    throw new Error('source authentication configuration has an invalid repository');
  }
  const repo = `${remote[1]}/${remote[2]}`;
  let token: string | undefined;
  const request = async (endpoint: string, auth: string, method = 'GET', body?: unknown) => {
    const response = await deps.fetch(`https://api.github.com${endpoint}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${auth}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error('GitHub request failed');
    return response.status === 204 ? {} : record(await response.json());
  };
  const release = async () => {
    if (!token) return;
    try {
      await request('/installation/token', token, 'DELETE');
      token = undefined;
    } catch {
      throw new Error('source token revocation failed');
    }
  };
  try {
    const key = await deps.runner.run({
      command: '/usr/bin/security',
      args: [
        'find-generic-password',
        '-s',
        input.env.NABATABLE_CI_KEYCHAIN_GITHUB_APP_KEY ??
          'nabatable-ci/github-app/nabatable-local-ci/private-key',
        '-a',
        input.keychainAccount,
        '-w',
      ],
      env: { PATH: '/usr/bin:/bin' },
      timeoutMs: 15_000,
      maxOutputBytes: 32_768,
      purpose: 'read CI App key for source fetch',
    });
    if (key.exitCode !== 0 || key.timedOut || key.stdoutTruncated)
      throw new Error('key unavailable');
    const storedKey = key.stdout.trim();
    const pem = storedKey.includes('-----BEGIN')
      ? storedKey
      : Buffer.from(storedKey, 'base64').toString('utf8');
    const jwt = createAppJwt({ appId, privateKey: parsePrivateKey(pem), now: new Date() });
    const app = await request('/app', jwt);
    const installation = await request(`/app/installations/${installationId}`, jwt);
    if (app.id !== appId || installation.app_id !== appId || installation.suspended_at !== null)
      throw new Error('App binding mismatch');
    const issued = await request(
      `/app/installations/${installationId}/access_tokens`,
      jwt,
      'POST',
      {
        repository_ids: [input.repositoryId],
        permissions: { contents: 'read' },
      },
    );
    if (typeof issued.token !== 'string' || !/^[A-Za-z0-9_.-]+$/u.test(issued.token))
      throw new Error('invalid token');
    token = issued.token;
    const permissions = record(issued.permissions);
    const expiresAt = typeof issued.expires_at === 'string' ? Date.parse(issued.expires_at) : NaN;
    if (
      !Number.isFinite(expiresAt) ||
      expiresAt < Date.now() + 60_000 ||
      permissions.contents !== 'read' ||
      Object.entries(permissions).some(
        ([name, value]) => !['contents', 'metadata'].includes(name) || value !== 'read',
      )
    )
      throw new Error('invalid token scope');
    const repository = await request(`/repos/${repo}`, token);
    if (repository.id !== input.repositoryId || repository.full_name !== repo)
      throw new Error('repository binding mismatch');
    return { token, release };
  } catch {
    await release();
    throw new Error('source authentication failed');
  }
}
