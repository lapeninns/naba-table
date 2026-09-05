import { generateKeyPairSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  GitHubRequestError,
  createGitHubClient,
  type FetchLike,
} from '@/scripts/ci/controller/github/client';

import { APP_ID, INSTALLATION_ID, REPO_ID, SHA_MAIN_A } from '../controller/helpers';

/**
 * Phase 1: cache poisoning.
 *
 * The controller's only cache is the GitHub client's ETag store. A poisoned or
 * misapplied cache entry could make the controller act on a stale pull-request
 * list (dispatching a superseded head, or missing a newly opened fork PR that
 * must be rejected). These tests pin the cache to one URL, forbid it for writes
 * and prove that a 304 for an uncached URL is an error rather than an answer.
 */

let privateKeyPem = '';

beforeAll(() => {
  privateKeyPem = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  }).privateKey;
});

const NOW = new Date('2026-09-04T10:00:00.000Z');
const PULLS = '/repos/nabatable/nabatable/pulls';
const CHECK_RUNS = '/repos/nabatable/nabatable/check-runs';

interface Recorded {
  readonly method: string;
  readonly path: string;
  readonly search: string;
  readonly headers: Record<string, string>;
}

type Handler = (request: Recorded, hit: number) => Response;

function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

function pull(number: number, headSha: string) {
  return {
    number,
    head: { sha: headSha, repo: { id: REPO_ID, fork: false } },
    base: { sha: SHA_MAIN_A, repo: { id: REPO_ID } },
    merge_commit_sha: 'c'.repeat(40),
    mergeable: true,
    draft: false,
    author_association: 'MEMBER',
    user: { login: 'alice', type: 'User' },
    updated_at: '2026-09-04T09:00:00.000Z',
  };
}

function build(handlers: Record<string, Handler>) {
  const requests: Recorded[] = [];
  const hits = new Map<string, number>();
  const identity: Record<string, Handler> = {
    'GET /app': () => json({ id: APP_ID, slug: 'nabatable-local-ci' }),
    [`POST /app/installations/${INSTALLATION_ID}/access_tokens`]: () =>
      json({ token: 'ghs_test0000000000000000', expires_at: '2026-09-04T11:00:00.000Z' }),
    [`GET /repositories/${REPO_ID}`]: () => json({ id: REPO_ID, full_name: 'nabatable/nabatable' }),
  };
  const all = { ...identity, ...handlers };
  const fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const method = init?.method ?? 'GET';
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    const recorded: Recorded = { method, path: url.pathname, search: url.search, headers };
    requests.push(recorded);
    const exact = `${method} ${url.pathname}${url.search}`;
    const handler = all[exact] ?? all[`${method} ${url.pathname}`];
    if (!handler) return new Response(`no handler for ${exact}`, { status: 404 });
    const hit = (hits.get(exact) ?? 0) + 1;
    hits.set(exact, hit);
    return handler(recorded, hit);
  };
  const client = createGitHubClient({
    credentials: { appId: APP_ID, installationId: INSTALLATION_ID, privateKeyPem },
    identity: { localAppId: APP_ID },
    repositoryId: REPO_ID,
    fetch,
    now: () => NOW,
    sleep: async () => undefined,
    random: () => 0,
  });
  return { client, requests };
}

describe('GitHub ETag cache cannot be poisoned across URLs or methods', () => {
  it('treats a 304 for a URL it never cached as an error instead of serving another page', async () => {
    const page2 = `${PULLS}?state=open&per_page=100&page=2`;
    const { client, requests } = build({
      [`GET ${PULLS}?state=open&per_page=100`]: () =>
        json([pull(7, 'a'.repeat(40))], {
          headers: {
            etag: '"page-1"',
            link: `<https://api.github.com${page2}>; rel="next"`,
          },
        }),
      [`GET ${page2}`]: () => new Response(null, { status: 304 }),
    });
    await client.verifyIdentity();
    let caught: unknown;
    try {
      await client.listOpenPullRequests();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GitHubRequestError);
    expect((caught as GitHubRequestError).status).toBe(304);
    const pageTwo = requests.find((request) => request.search.includes('page=2'));
    expect(pageTwo?.headers['if-none-match']).toBeUndefined();
  });

  it('only revalidates the exact URL it cached and replaces the entry when the ETag changes', async () => {
    const listPath = `GET ${PULLS}?state=open&per_page=100`;
    const { client, requests } = build({
      [listPath]: (request, hit) => {
        if (hit === 1) return json([pull(7, 'a'.repeat(40))], { headers: { etag: '"v1"' } });
        if (hit === 2) {
          expect(request.headers['if-none-match']).toBe('"v1"');
          return new Response(null, { status: 304 });
        }
        expect(request.headers['if-none-match']).toBe('"v1"');
        // The head moved: GitHub answers 200 with a new body and ETag; the old body must go.
        return json([pull(7, 'b'.repeat(40))], { headers: { etag: '"v2"' } });
      },
    });
    await client.verifyIdentity();
    const first = await client.listOpenPullRequests();
    const second = await client.listOpenPullRequests();
    const third = await client.listOpenPullRequests();
    expect(second).toEqual(first);
    expect(third[0]?.headSha).toBe('b'.repeat(40));
    expect(third).not.toEqual(first);
    const fourthHit = requests.filter((request) => request.path === PULLS).length;
    expect(fourthHit).toBe(3);
  });

  it('never attaches or serves cache entries for check-run writes', async () => {
    let posts = 0;
    const { client, requests } = build({
      [`POST ${CHECK_RUNS}`]: () => {
        posts += 1;
        return json(
          {
            id: 500 + posts,
            name: 'Local CI / pr',
            head_sha: 'a'.repeat(40),
            status: 'in_progress',
            conclusion: null,
            external_id: `k${posts}`,
            app: { id: APP_ID },
          },
          { headers: { etag: '"write-etag"' } },
        );
      },
    });
    await client.verifyIdentity();
    const input = {
      name: 'Local CI / pr',
      headSha: 'a'.repeat(40),
      status: 'in_progress' as const,
      externalId: 'k1',
      output: { title: 'running', summary: 'started' },
    };
    const one = await client.createCheckRun(input);
    const two = await client.createCheckRun({ ...input, externalId: 'k2' });
    expect(posts).toBe(2);
    expect(one.id).not.toBe(two.id);
    for (const request of requests.filter((entry) => entry.method === 'POST')) {
      expect(request.headers['if-none-match']).toBeUndefined();
    }
  });

  it('does not let identity verification be answered from a cache', async () => {
    let appHits = 0;
    const { client, requests } = build({
      'GET /app': () => {
        appHits += 1;
        return json({ id: APP_ID, slug: 'nabatable-local-ci' }, { headers: { etag: '"app"' } });
      },
    });
    await client.verifyIdentity();
    await client.verifyIdentity();
    expect(appHits).toBe(2);
    for (const request of requests.filter((entry) => entry.path === '/app')) {
      expect(request.headers['if-none-match']).toBeUndefined();
    }
  });
});
