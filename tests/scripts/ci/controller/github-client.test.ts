import { createVerify, generateKeyPairSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  GitHubIdentityError,
  GitHubRequestError,
  createGitHubClient,
  retryAfterMs,
  type FetchLike,
  type GitHubClientOptions,
} from '@/scripts/ci/controller/github/client';
import {
  APP_JWT_TTL_SECONDS,
  createAppJwt,
  parsePrivateKey,
} from '@/scripts/ci/controller/github/jwt';

import {
  APP_ID,
  INSTALLATION_ID,
  REPO_ID,
  SHA_MAIN_A,
  SHA_PR_HEAD_X,
  SHA_PR_MERGE_X,
} from './helpers';

let privateKeyPem = '';
let publicKeyPem = '';

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKeyPem = pair.privateKey;
  publicKeyPem = pair.publicKey;
});

interface Recorded {
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

type Handler = (request: Recorded, hit: number) => Response;

function json(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

const NOW = new Date('2026-09-04T10:00:00.000Z');

function defaultHandlers(): Record<string, Handler> {
  return {
    'GET /app': () => json({ id: APP_ID, slug: 'nabatable-local-ci' }),
    [`POST /app/installations/${INSTALLATION_ID}/access_tokens`]: () =>
      json({ token: 'ghs_testinstallationtoken000000', expires_at: '2026-09-04T11:00:00.000Z' }),
    [`GET /repositories/${REPO_ID}`]: () => json({ id: REPO_ID, full_name: 'nabatable/nabatable' }),
  };
}

function fakeFetch(handlers: Record<string, Handler>): {
  fetch: FetchLike;
  requests: Recorded[];
} {
  const requests: Recorded[] = [];
  const hits = new Map<string, number>();
  const fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const method = init?.method ?? 'GET';
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const key = `${method} ${url.pathname}${url.search}`;
    const recorded: Recorded = { method, url: input, path: url.pathname, headers, body };
    requests.push(recorded);
    const handler = handlers[key] ?? handlers[`${method} ${url.pathname}`];
    if (!handler) return new Response(`no handler for ${key}`, { status: 404 });
    const hit = (hits.get(key) ?? 0) + 1;
    hits.set(key, hit);
    return handler(recorded, hit);
  };
  return { fetch, requests };
}

function client(
  overrides: Partial<GitHubClientOptions> & { handlers?: Record<string, Handler> } = {},
): { client: ReturnType<typeof createGitHubClient>; requests: Recorded[]; sleeps: number[] } {
  const { handlers, ...rest } = overrides;
  const { fetch, requests } = fakeFetch({ ...defaultHandlers(), ...(handlers ?? {}) });
  const sleeps: number[] = [];
  const created = createGitHubClient({
    credentials: { appId: APP_ID, installationId: INSTALLATION_ID, privateKeyPem },
    identity: { localAppId: APP_ID },
    repositoryId: REPO_ID,
    fetch,
    now: () => NOW,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0,
    ...rest,
  });
  return { client: created, requests, sleeps };
}

const PULL = {
  number: 7,
  head: { sha: SHA_PR_HEAD_X, repo: { id: REPO_ID, fork: false } },
  base: { sha: SHA_MAIN_A, repo: { id: REPO_ID } },
  merge_commit_sha: SHA_PR_MERGE_X,
  mergeable: true,
  draft: false,
  author_association: 'MEMBER',
  user: { login: 'alice', type: 'User' },
  updated_at: '2026-09-04T09:00:00.000Z',
};

describe('GitHub App JWT', () => {
  it('is RS256-signed by the App key with a bounded lifetime', () => {
    const token = createAppJwt({
      appId: APP_ID,
      privateKey: parsePrivateKey(privateKeyPem),
      now: NOW,
    });
    const [header, payload, signature] = token.split('.') as [string, string, string];
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      iss: string;
      iat: number;
      exp: number;
    };
    expect(claims.iss).toBe(String(APP_ID));
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
    expect(claims.exp - claims.iat).toBe(APP_JWT_TTL_SECONDS + 60);
    expect(claims.iat).toBeLessThan(NOW.getTime() / 1000);
    const valid = createVerify('RSA-SHA256')
      .update(`${header}.${payload}`)
      .end()
      .verify(publicKeyPem, signature, 'base64url');
    expect(valid).toBe(true);
  });

  it('rejects non-RSA keys and out-of-range lifetimes', () => {
    const ec = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    expect(() => parsePrivateKey(ec.privateKey)).toThrow(/must be RSA/u);
    expect(() =>
      createAppJwt({
        appId: APP_ID,
        privateKey: parsePrivateKey(privateKeyPem),
        now: NOW,
        ttlSeconds: 601,
      }),
    ).toThrow(/600/u);
  });
});

describe('GitHub client identity', () => {
  it('refuses to be constructed with anything but the local App id', () => {
    expect(() => client({ identity: { localAppId: APP_ID + 1 } })).toThrow(GitHubIdentityError);
    expect(() => client({ identity: { localAppId: 0 } })).toThrow(/unconfigured/u);
    expect(() =>
      client({ credentials: { appId: 0, installationId: INSTALLATION_ID, privateKeyPem } }),
    ).toThrow(GitHubIdentityError);
    expect(() => client({ repositoryId: -1 })).toThrow(GitHubIdentityError);
    expect(() => client({ repository: 'nope' })).toThrow(/owner\/repo/u);
  });

  it('verifies App and repository identity, resolving owner/repo from the repository id', async () => {
    const { client: github, requests } = client();
    const description = await github.verifyIdentity();
    expect(description).toEqual({
      appId: APP_ID,
      appSlug: 'nabatable-local-ci',
      installationId: INSTALLATION_ID,
      repositoryId: REPO_ID,
      repository: 'nabatable/nabatable',
    });
    const appCall = requests.find((request) => request.path === '/app');
    expect(appCall?.headers.authorization).toMatch(/^Bearer eyJ/u);
    const repoCall = requests.find((request) => request.path === `/repositories/${REPO_ID}`);
    expect(repoCall?.headers.authorization).toBe('Bearer ghs_testinstallationtoken000000');
  });

  it('fails closed on App id/slug mismatch, repository id mismatch and owner/repo mismatch', async () => {
    const wrongApp = client({
      handlers: { 'GET /app': () => json({ id: APP_ID + 1, slug: 'nabatable-local-ci' }) },
    });
    await expect(wrongApp.client.verifyIdentity()).rejects.toThrow(GitHubIdentityError);
    const wrongSlug = client({
      handlers: { 'GET /app': () => json({ id: APP_ID, slug: 'other-app' }) },
    });
    await expect(wrongSlug.client.verifyIdentity()).rejects.toThrow(/identity mismatch/u);
    const wrongRepo = client({
      handlers: { [`GET /repositories/${REPO_ID}`]: () => json({ id: 1, full_name: 'x/y' }) },
    });
    await expect(wrongRepo.client.verifyIdentity()).rejects.toThrow(/Repository id mismatch/u);
    const wrongName = client({ repository: 'someone/else' });
    await expect(wrongName.client.verifyIdentity()).rejects.toThrow(/not the configured/u);
  });

  it('refuses repository calls before identity verification', async () => {
    const { client: github } = client();
    await expect(github.listOpenPullRequests()).rejects.toThrow(/verifyIdentity/u);
    await expect(github.listCheckRunsForSha('abc')).rejects.toThrow(/40-char/u);
  });

  it('never exposes the private key through describe(), toJSON() or logs fields', async () => {
    const { client: github } = client();
    await github.verifyIdentity();
    const serialized = JSON.stringify({ github, described: github.describe() });
    expect(serialized).not.toContain('PRIVATE KEY');
    expect(serialized).not.toContain('privateKey');
    expect(Object.keys(github)).not.toContain('privateKey');
  });
});

describe('GitHub client requests', () => {
  it('caches the installation token and refreshes it once on 401', async () => {
    let listHits = 0;
    const { client: github, requests } = client({
      handlers: {
        'GET /repos/nabatable/nabatable/pulls?state=open&per_page=100': () => {
          listHits += 1;
          if (listHits === 3) return new Response('expired', { status: 401 });
          return json([PULL]);
        },
      },
    });
    await github.verifyIdentity();
    await github.listOpenPullRequests();
    await github.listOpenPullRequests();
    const tokenCalls = () =>
      requests.filter((request) => request.path.endsWith('/access_tokens')).length;
    expect(tokenCalls()).toBe(1);
    const pulls = await github.listOpenPullRequests();
    expect(pulls).toHaveLength(1);
    expect(pulls[0]).toMatchObject({
      number: 7,
      headSha: SHA_PR_HEAD_X,
      mergeCommitSha: SHA_PR_MERGE_X,
      headRepositoryId: REPO_ID,
      author: { login: 'alice', type: 'User' },
    });
    expect(tokenCalls()).toBe(2);
  });

  it('sends If-None-Match and reuses the cached body on 304', async () => {
    const { client: github, requests } = client({
      handlers: {
        'GET /repos/nabatable/nabatable/pulls?state=open&per_page=100': (request, hit) => {
          if (hit === 1) return json([PULL], { headers: { etag: '"etag-1"' } });
          expect(request.headers['if-none-match']).toBe('"etag-1"');
          return new Response(null, { status: 304 });
        },
      },
    });
    await github.verifyIdentity();
    const first = await github.listOpenPullRequests();
    const second = await github.listOpenPullRequests();
    expect(second).toEqual(first);
    const listCalls = requests.filter((request) => request.path.endsWith('/pulls'));
    expect(listCalls).toHaveLength(2);
  });

  it('follows Link rel="next" pagination', async () => {
    const { client: github } = client({
      handlers: {
        'GET /repos/nabatable/nabatable/pulls?state=open&per_page=100': () =>
          json([PULL], {
            headers: {
              link: '<https://api.github.com/repos/nabatable/nabatable/pulls?state=open&per_page=100&page=2>; rel="next"',
            },
          }),
        'GET /repos/nabatable/nabatable/pulls?state=open&per_page=100&page=2': () =>
          json([{ ...PULL, number: 8, user: { login: 'dependabot[bot]', type: 'Bot' } }]),
      },
    });
    await github.verifyIdentity();
    const pulls = await github.listOpenPullRequests();
    expect(pulls.map((pull) => pull.number)).toEqual([7, 8]);
    expect(pulls[1]?.author).toEqual({ login: 'dependabot[bot]', type: 'Bot' });
  });

  it('backs off on 403/429 using Retry-After and x-ratelimit-reset, then succeeds', async () => {
    const resetEpoch = Math.floor(NOW.getTime() / 1000) + 5;
    const { client: github, sleeps } = client({
      handlers: {
        'GET /repos/nabatable/nabatable/branches/main': (_request, hit) => {
          if (hit === 1)
            return new Response('slow down', { status: 403, headers: { 'retry-after': '2' } });
          if (hit === 2) {
            return new Response('quota', {
              status: 429,
              headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(resetEpoch) },
            });
          }
          if (hit === 3) return new Response('busy', { status: 429 });
          return json({ commit: { sha: SHA_MAIN_A, parents: [{ sha: '9'.repeat(40) }] } });
        },
      },
    });
    await github.verifyIdentity();
    const head = await github.getBranchHead('main');
    expect(head).toEqual({ sha: SHA_MAIN_A, parents: ['9'.repeat(40)] });
    expect(sleeps).toEqual([2000, 5000, 4000]);
  });

  it('does not retry a 403 without rate-limit evidence and gives up after maxRetries', async () => {
    const forbidden = client({
      handlers: {
        'GET /repos/nabatable/nabatable/branches/main': () =>
          new Response('forbidden', { status: 403 }),
      },
    });
    await forbidden.client.verifyIdentity();
    await expect(forbidden.client.getBranchHead('main')).rejects.toThrow(GitHubRequestError);
    expect(forbidden.sleeps).toEqual([]);

    const exhausted = client({
      maxRetries: 2,
      handlers: {
        'GET /repos/nabatable/nabatable/branches/main': () => new Response('busy', { status: 429 }),
      },
    });
    await exhausted.client.verifyIdentity();
    await expect(exhausted.client.getBranchHead('main')).rejects.toThrow(/429/u);
    expect(exhausted.sleeps).toEqual([1000, 2000]);
  });

  it('creates and updates check runs with the tuple external_id and evidence output', async () => {
    const { client: github, requests } = client({
      handlers: {
        'POST /repos/nabatable/nabatable/check-runs': (request) =>
          json({
            id: 501,
            name: (request.body as { name: string }).name,
            head_sha: SHA_PR_HEAD_X,
            status: 'in_progress',
            app: { id: APP_ID },
          }),
        'PATCH /repos/nabatable/nabatable/check-runs/501': (request) =>
          json({
            id: 501,
            name: 'Local CI / pr',
            head_sha: SHA_PR_HEAD_X,
            status: 'completed',
            conclusion: (request.body as { conclusion: string }).conclusion,
            external_id: (request.body as { external_id: string }).external_id,
            app: { id: APP_ID },
          }),
        [`GET /repos/nabatable/nabatable/commits/${SHA_PR_HEAD_X}/check-runs?per_page=100&app_id=${APP_ID}&check_name=Local+CI+%2F+pr`]:
          () =>
            json({
              check_runs: [
                {
                  id: 501,
                  name: 'Local CI / pr',
                  head_sha: SHA_PR_HEAD_X,
                  status: 'completed',
                  conclusion: 'success',
                  external_id: 'k',
                  app: { id: APP_ID },
                },
              ],
            }),
      },
    });
    await github.verifyIdentity();
    const created = await github.createCheckRun({
      name: 'Local CI / pr',
      headSha: SHA_PR_HEAD_X,
      status: 'in_progress',
      externalId: 'nabatable-ci/v1:k',
      output: { title: 'running', summary: 'started' },
    });
    expect(created.id).toBe(501);
    const post = requests.find(
      (request) => request.method === 'POST' && request.path.endsWith('/check-runs'),
    );
    expect(post?.body).toEqual({
      name: 'Local CI / pr',
      head_sha: SHA_PR_HEAD_X,
      status: 'in_progress',
      external_id: 'nabatable-ci/v1:k',
      output: { title: 'running', summary: 'started' },
    });
    const updated = await github.updateCheckRun(501, {
      status: 'completed',
      conclusion: 'success',
      externalId: 'nabatable-ci/v1:k',
      output: { title: 'passed', summary: 's', text: '<!-- nabatable-ci-result -->' },
    });
    expect(updated.conclusion).toBe('success');
    expect(updated.externalId).toBe('nabatable-ci/v1:k');
    const runs = await github.listCheckRunsForSha(SHA_PR_HEAD_X, 'Local CI / pr');
    expect(runs).toEqual([
      {
        id: 501,
        name: 'Local CI / pr',
        headSha: SHA_PR_HEAD_X,
        status: 'completed',
        conclusion: 'success',
        externalId: 'k',
        appId: APP_ID,
      },
    ]);
  });

  it('jitters the poll delay around the configured interval', () => {
    const low = client({ random: () => 0 }).client.pollDelayMs();
    const high = client({ random: () => 1 }).client.pollDelayMs();
    expect(low).toBe(20_000);
    expect(high).toBe(40_000);
    const custom = client({ random: () => 0.5, pollIntervalMs: 30_000, pollJitterMs: 10_000 });
    expect(custom.client.pollDelayMs()).toBe(30_000);
  });

  it('retryAfterMs prefers Retry-After and falls back to a depleted quota reset', () => {
    const nowMs = NOW.getTime();
    expect(retryAfterMs(new Headers({ 'retry-after': '7' }), nowMs)).toBe(7000);
    expect(
      retryAfterMs(
        new Headers({
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(nowMs / 1000 + 3),
        }),
        nowMs,
      ),
    ).toBe(3000);
    expect(retryAfterMs(new Headers({ 'x-ratelimit-remaining': '10' }), nowMs)).toBeNull();
  });
});
