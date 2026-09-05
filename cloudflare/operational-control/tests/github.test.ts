import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createFakeFetcher, jsonResponse } from './helpers/fetch';
import {
  BASE_SHA,
  FALLBACK_WORKFLOW_ID,
  GATE_WORKFLOW_ID,
  HEAD_SHA,
  NOW_MS,
  REPOSITORY_ID,
  SCHEDULED_VALIDATION_WORKFLOW_ID,
} from './helpers/fixtures';
import {
  assertDispatchAllowed,
  createAppJwt,
  createGitHubClient,
  GitHubConfigurationError,
  GitHubDispatchPolicyError,
  GitHubReadbackError,
  GitHubTransportError,
  pemToPkcs8Der,
} from '../src/github';

import type { FetchCall } from './helpers/fetch';
import type { DispatchPolicy, GitHubClientOptions } from '../src/github';

const { privateKey: PKCS8_PEM, publicKey: PUBLIC_PEM } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const { privateKey: PKCS1_PEM } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const policy: DispatchPolicy = {
  allowedWorkflowIds: [GATE_WORKFLOW_ID, SCHEDULED_VALIDATION_WORKFLOW_ID],
  protectedRef: 'refs/heads/main',
};

const FULL_NAME = 'nabatable/nabatable';

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;
}

function githubApi(overrides: Partial<Record<string, (call: FetchCall) => Response>> = {}) {
  const routes: Record<string, (call: FetchCall) => Response> = {
    'POST /app/installations/555/access_tokens': () =>
      jsonResponse(
        { token: 'ghs_installation_token', expires_at: new Date(NOW_MS + 3_600_000).toISOString() },
        201,
      ),
    [`GET /repositories/${REPOSITORY_ID}`]: () =>
      jsonResponse({ id: Number(REPOSITORY_ID), full_name: FULL_NAME }),
    [`POST /repos/${FULL_NAME}/actions/workflows/${GATE_WORKFLOW_ID}/dispatches`]: () =>
      new Response(null, { status: 204 }),
    [`GET /repos/${FULL_NAME}/commits/${HEAD_SHA}/check-runs?per_page=100&filter=latest`]: () =>
      jsonResponse({
        check_runs: [
          {
            id: 9001,
            name: 'Local CI / pr',
            app: { id: 424242 },
            head_sha: HEAD_SHA,
            status: 'completed',
            conclusion: 'success',
            external_id: '{"tuple":true}',
          },
        ],
      }),
    [`GET /repos/${FULL_NAME}/pulls/42`]: () =>
      jsonResponse({
        number: 42,
        state: 'open',
        draft: false,
        head: { sha: HEAD_SHA },
        base: { sha: BASE_SHA, ref: 'main' },
      }),
    [`GET /repos/${FULL_NAME}/actions/runs?head_sha=${HEAD_SHA}&per_page=100`]: () =>
      jsonResponse({
        workflow_runs: [
          {
            id: 500,
            workflow_id: 7000,
            path: '.github/workflows/test-suite.yml',
            head_sha: HEAD_SHA,
            status: 'completed',
            conclusion: null,
            run_attempt: 2,
          },
        ],
      }),
    ...overrides,
  };
  return createFakeFetcher((call) => {
    const key = `${call.method} ${new URL(call.url).pathname}${new URL(call.url).search}`;
    const route = routes[key];
    if (!route) return jsonResponse({ message: `unrouted ${key}` }, 404);
    return route(call);
  });
}

function clientOptions(overrides: Partial<GitHubClientOptions> = {}): GitHubClientOptions {
  return {
    appId: '4242',
    privateKeyPem: PKCS8_PEM,
    installationId: '555',
    repositoryId: REPOSITORY_ID,
    dispatchPolicy: policy,
    now: () => NOW_MS,
    ...overrides,
  };
}

describe('GitHub App JWT', () => {
  it('signs an RS256 JWT verifiable with the public key and bounded lifetime', async () => {
    const jwt = await createAppJwt({ appId: '4242', privateKeyPem: PKCS8_PEM, nowMs: NOW_MS });
    const [header, payload, signature] = jwt.split('.');
    expect(decodeSegment(header ?? '')).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decodeSegment(payload ?? '')).toEqual({
      iss: '4242',
      iat: Math.floor(NOW_MS / 1000) - 60,
      exp: Math.floor(NOW_MS / 1000) + 9 * 60,
    });
    const verified = verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${payload}`),
      createPublicKey(PUBLIC_PEM),
      Buffer.from(signature ?? '', 'base64url'),
    );
    expect(verified).toBe(true);
  });

  it('accepts escaped newlines and rejects PKCS#1 or malformed keys', () => {
    expect(pemToPkcs8Der(PKCS8_PEM.replaceAll('\n', '\\n')).byteLength).toBeGreaterThan(1000);
    expect(() => pemToPkcs8Der(PKCS1_PEM)).toThrow(GitHubConfigurationError);
    expect(() => pemToPkcs8Der(PKCS1_PEM)).toThrow(/PKCS#1/u);
    expect(() =>
      pemToPkcs8Der('-----BEGIN PRIVATE KEY-----\nnot*base64\n-----END PRIVATE KEY-----'),
    ).toThrow(GitHubConfigurationError);
    expect(() => pemToPkcs8Der('garbage')).toThrow(GitHubConfigurationError);
  });
});

describe('dispatch policy', () => {
  it('permits only the fixed workflow ids on refs/heads/main', () => {
    expect(() =>
      assertDispatchAllowed(policy, {
        workflowId: GATE_WORKFLOW_ID,
        ref: 'refs/heads/main',
        inputs: { request: '{}' },
      }),
    ).not.toThrow();
    expect(() =>
      assertDispatchAllowed(policy, {
        workflowId: SCHEDULED_VALIDATION_WORKFLOW_ID,
        ref: 'refs/heads/main',
        inputs: {},
      }),
    ).not.toThrow();
  });

  it('refuses the fallback workflow, unknown ids, other refs and hostile inputs', () => {
    const attempts = [
      { workflowId: FALLBACK_WORKFLOW_ID, ref: 'refs/heads/main', inputs: {} },
      { workflowId: '9999', ref: 'refs/heads/main', inputs: {} },
      { workflowId: 'release-gate.yml', ref: 'refs/heads/main', inputs: {} },
      { workflowId: GATE_WORKFLOW_ID, ref: 'refs/heads/develop', inputs: {} },
      { workflowId: GATE_WORKFLOW_ID, ref: 'main', inputs: {} },
      { workflowId: GATE_WORKFLOW_ID, ref: 'refs/heads/main', inputs: { 'Bad-Key': 'x' } },
      { workflowId: GATE_WORKFLOW_ID, ref: 'refs/heads/main', inputs: { key: 'x'.repeat(4097) } },
      {
        workflowId: GATE_WORKFLOW_ID,
        ref: 'refs/heads/main',
        inputs: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, 'v'])),
      },
    ];
    for (const request of attempts) {
      expect(() => assertDispatchAllowed(policy, request)).toThrow(GitHubDispatchPolicyError);
    }
    const drifted: DispatchPolicy = { ...policy, protectedRef: 'refs/heads/develop' };
    expect(() =>
      assertDispatchAllowed(drifted, {
        workflowId: GATE_WORKFLOW_ID,
        ref: 'refs/heads/develop',
        inputs: {},
      }),
    ).toThrow(GitHubDispatchPolicyError);
  });
});

describe('GitHub client', () => {
  it('refuses to construct when credentials are missing, placeholders or malformed', () => {
    for (const overrides of [
      { appId: undefined },
      { appId: 'REPLACE_ME_APP_ID' },
      { appId: 'abc' },
      { installationId: '' },
      { privateKeyPem: 'REPLACE_ME_PRIVATE_KEY' },
      { repositoryId: '0' },
    ]) {
      expect(() => createGitHubClient(clientOptions(overrides))).toThrow(GitHubConfigurationError);
    }
  });

  it('exchanges an App JWT for a cached installation token and dispatches only allowed workflows', async () => {
    const api = githubApi();
    const client = createGitHubClient(clientOptions({ fetcher: api.fetcher }));
    await client.dispatchWorkflow({
      workflowId: GATE_WORKFLOW_ID,
      ref: 'refs/heads/main',
      inputs: { request: '{"profile":"pr"}' },
    });
    await client.dispatchWorkflow({
      workflowId: GATE_WORKFLOW_ID,
      ref: 'refs/heads/main',
      inputs: { request: '{"profile":"main"}' },
    });
    const paths = api.calls.map((call) => `${call.method} ${new URL(call.url).pathname}`);
    expect(paths).toEqual([
      'POST /app/installations/555/access_tokens',
      `GET /repositories/${REPOSITORY_ID}`,
      `POST /repos/${FULL_NAME}/actions/workflows/${GATE_WORKFLOW_ID}/dispatches`,
      `POST /repos/${FULL_NAME}/actions/workflows/${GATE_WORKFLOW_ID}/dispatches`,
    ]);
    const tokenCall = api.calls[0] as FetchCall;
    expect(tokenCall.headers.get('authorization')).toMatch(
      /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u,
    );
    const dispatchCall = api.calls[2] as FetchCall;
    expect(dispatchCall.headers.get('authorization')).toBe('Bearer ghs_installation_token');
    expect(dispatchCall.headers.get('x-github-api-version')).toBe('2022-11-28');
    expect(JSON.parse(dispatchCall.body ?? '')).toEqual({
      ref: 'refs/heads/main',
      inputs: { request: '{"profile":"pr"}' },
    });

    await expect(
      client.dispatchWorkflow({
        workflowId: FALLBACK_WORKFLOW_ID,
        ref: 'refs/heads/main',
        inputs: {},
      }),
    ).rejects.toBeInstanceOf(GitHubDispatchPolicyError);
    await expect(
      client.dispatchWorkflow({
        workflowId: GATE_WORKFLOW_ID,
        ref: 'refs/heads/feature',
        inputs: {},
      }),
    ).rejects.toBeInstanceOf(GitHubDispatchPolicyError);
    expect(api.calls).toHaveLength(4);
  });

  it('refuses to operate when the repository readback does not match REPOSITORY_ID', async () => {
    const api = githubApi({
      [`GET /repositories/${REPOSITORY_ID}`]: () => jsonResponse({ id: 1, full_name: FULL_NAME }),
    });
    const client = createGitHubClient(clientOptions({ fetcher: api.fetcher }));
    await expect(client.listCheckRunsForRef(HEAD_SHA)).rejects.toBeInstanceOf(GitHubReadbackError);
    expect(api.calls.map((call) => new URL(call.url).pathname)).not.toContain(
      `/repos/${FULL_NAME}/commits/${HEAD_SHA}/check-runs`,
    );
    const malformedName = githubApi({
      [`GET /repositories/${REPOSITORY_ID}`]: () =>
        jsonResponse({ id: Number(REPOSITORY_ID), full_name: 'not a repo' }),
    });
    await expect(
      createGitHubClient(clientOptions({ fetcher: malformedName.fetcher })).getPullRequest(42),
    ).rejects.toBeInstanceOf(GitHubReadbackError);
  });

  it('parses authoritative readbacks strictly', async () => {
    const api = githubApi();
    const client = createGitHubClient(clientOptions({ fetcher: api.fetcher }));
    await expect(client.listCheckRunsForRef(HEAD_SHA)).resolves.toEqual([
      {
        id: 9001,
        name: 'Local CI / pr',
        appId: 424242,
        headSha: HEAD_SHA,
        status: 'completed',
        conclusion: 'success',
        externalId: '{"tuple":true}',
      },
    ]);
    await expect(client.getPullRequest(42)).resolves.toEqual({
      number: 42,
      state: 'open',
      draft: false,
      headSha: HEAD_SHA,
      baseSha: BASE_SHA,
      baseRef: 'main',
    });
    await expect(client.listWorkflowRunsForSha(HEAD_SHA)).resolves.toEqual([
      {
        id: 500,
        workflowId: 7000,
        path: '.github/workflows/test-suite.yml',
        headSha: HEAD_SHA,
        status: 'completed',
        conclusion: null,
        runAttempt: 2,
      },
    ]);
    await expect(client.listCheckRunsForRef('not-a-sha')).rejects.toBeInstanceOf(
      GitHubReadbackError,
    );
    await expect(client.getPullRequest(-1)).rejects.toBeInstanceOf(GitHubReadbackError);
  });

  it('rejects malformed readback bodies instead of guessing', async () => {
    const cases: Record<string, (call: FetchCall) => Response> = {
      [`GET /repos/${FULL_NAME}/commits/${HEAD_SHA}/check-runs?per_page=100&filter=latest`]: () =>
        jsonResponse({ check_runs: [{ id: 'x' }] }),
      [`GET /repos/${FULL_NAME}/pulls/42`]: () => jsonResponse({ number: 42, state: 'merged' }),
      [`GET /repos/${FULL_NAME}/actions/runs?head_sha=${HEAD_SHA}&per_page=100`]: () =>
        jsonResponse({ workflow_runs: [{ id: 1, status: 'flying' }] }),
    };
    const api = githubApi(cases);
    const client = createGitHubClient(clientOptions({ fetcher: api.fetcher }));
    await expect(client.listCheckRunsForRef(HEAD_SHA)).rejects.toBeInstanceOf(GitHubReadbackError);
    await expect(client.getPullRequest(42)).rejects.toBeInstanceOf(GitHubReadbackError);
    await expect(client.listWorkflowRunsForSha(HEAD_SHA)).rejects.toBeInstanceOf(
      GitHubReadbackError,
    );
    const nonJson = githubApi({
      [`GET /repos/${FULL_NAME}/pulls/42`]: () => new Response('<html>', { status: 200 }),
    });
    await expect(
      createGitHubClient(clientOptions({ fetcher: nonJson.fetcher })).getPullRequest(42),
    ).rejects.toBeInstanceOf(GitHubReadbackError);
    const badToken = githubApi({
      'POST /app/installations/555/access_tokens': () => jsonResponse({ token: 1 }),
    });
    await expect(
      createGitHubClient(clientOptions({ fetcher: badToken.fetcher })).getPullRequest(42),
    ).rejects.toBeInstanceOf(GitHubReadbackError);
    const badExpiry = githubApi({
      'POST /app/installations/555/access_tokens': () =>
        jsonResponse({ token: 'ghs_x', expires_at: 'later' }),
    });
    await expect(
      createGitHubClient(clientOptions({ fetcher: badExpiry.fetcher })).getPullRequest(42),
    ).rejects.toBeInstanceOf(GitHubReadbackError);
  });

  it('classifies transport failures as retryable or terminal', async () => {
    const serverError = githubApi({
      [`GET /repos/${FULL_NAME}/pulls/42`]: () => jsonResponse({ message: 'boom' }, 503),
    });
    const retryable = await createGitHubClient(clientOptions({ fetcher: serverError.fetcher }))
      .getPullRequest(42)
      .catch((error: unknown) => error);
    expect(retryable).toBeInstanceOf(GitHubTransportError);
    expect((retryable as GitHubTransportError).retryable).toBe(true);
    expect((retryable as GitHubTransportError).status).toBe(503);

    const notFound = githubApi({
      [`GET /repos/${FULL_NAME}/pulls/42`]: () => jsonResponse({ message: 'nope' }, 404),
    });
    const terminal = await createGitHubClient(clientOptions({ fetcher: notFound.fetcher }))
      .getPullRequest(42)
      .catch((error: unknown) => error);
    expect(terminal).toBeInstanceOf(GitHubTransportError);
    expect((terminal as GitHubTransportError).retryable).toBe(false);

    const network = createFakeFetcher(() => {
      throw new TypeError('fetch failed');
    });
    const offline = await createGitHubClient(clientOptions({ fetcher: network.fetcher }))
      .getPullRequest(42)
      .catch((error: unknown) => error);
    expect(offline).toBeInstanceOf(GitHubTransportError);
    expect((offline as GitHubTransportError).retryable).toBe(true);
    expect((offline as GitHubTransportError).status).toBeNull();
    expect((offline as Error).message).not.toContain('ghs_');
  });

  it('refreshes the installation token once it nears expiry', async () => {
    let nowMs = NOW_MS;
    let issued = 0;
    const api = githubApi({
      'POST /app/installations/555/access_tokens': () => {
        issued += 1;
        return jsonResponse(
          { token: `ghs_${issued}`, expires_at: new Date(nowMs + 120_000).toISOString() },
          201,
        );
      },
    });
    const client = createGitHubClient(
      clientOptions({
        fetcher: api.fetcher,
        now: () => nowMs,
        apiBaseUrl: 'https://api.github.com/',
      }),
    );
    await client.getPullRequest(42);
    await client.getPullRequest(42);
    expect(issued).toBe(1);
    nowMs += 90_000;
    await client.getPullRequest(42);
    expect(issued).toBe(2);
  });
});
