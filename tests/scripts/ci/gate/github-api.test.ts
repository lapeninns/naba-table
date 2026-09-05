import { describe, expect, it } from 'vitest';

import { GitHubApiError, createGitHubApi, type FetchLike } from '@/scripts/ci/gate/github-api';

import { HEAD_SHA, MERGE_SHA } from './helpers';

type Recorded = { url: string; init: RequestInit | undefined };

function fakeFetch(
  routes: Record<string, { status?: number; body: unknown }>,
  recorded: Recorded[] = [],
): FetchLike {
  return async (url, init) => {
    recorded.push({ url, init });
    const pathname = new URL(url).pathname + new URL(url).search;
    const match = Object.entries(routes).find(([prefix]) => pathname.startsWith(prefix));
    if (!match) return new Response('{"message":"secret detail"}', { status: 404 });
    const [, route] = match;
    return new Response(JSON.stringify(route.body), {
      status: route.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

describe('createGitHubApi', () => {
  it('sends the token only in the Authorization header with the pinned API version', async () => {
    const recorded: Recorded[] = [];
    const api = createGitHubApi({
      token: 'ghs_test',
      repository: 'lapeninns/nabatable',
      fetchImpl: fakeFetch(
        {
          '/repos/lapeninns/nabatable': {
            body: { id: 1, full_name: 'lapeninns/nabatable', default_branch: 'main' },
          },
        },
        recorded,
      ),
    });
    await api.getRepository();
    expect(recorded[0].url).toBe('https://api.github.com/repos/lapeninns/nabatable');
    const headers = recorded[0].init?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer ghs_test');
    expect(headers['x-github-api-version']).toBe('2022-11-28');
    expect(recorded[0].url).not.toContain('ghs_test');
  });

  it('refuses malformed repository names and missing tokens', () => {
    expect(() => createGitHubApi({ token: 't', repository: 'nope' })).toThrow('owner/repo');
    expect(() => createGitHubApi({ token: '', repository: 'a/b' })).toThrow('GITHUB_TOKEN');
  });

  it('maps pull requests and returns null on 404', async () => {
    const api = createGitHubApi({
      token: 't',
      repository: 'a/b',
      fetchImpl: fakeFetch({
        '/repos/a/b/pulls/42': {
          body: {
            number: 42,
            state: 'open',
            draft: false,
            head: { sha: HEAD_SHA, repo: { id: 5 } },
            base: { sha: 'b'.repeat(40), ref: 'main', repo: { id: 5 } },
            merge_commit_sha: MERGE_SHA,
          },
        },
      }),
    });
    expect(await api.getPullRequest(42)).toEqual({
      number: 42,
      state: 'open',
      draft: false,
      headSha: HEAD_SHA,
      headRepoId: 5,
      baseSha: 'b'.repeat(40),
      baseRef: 'main',
      baseRepoId: 5,
      mergeCommitSha: MERGE_SHA,
    });
    expect(await api.getPullRequest(43)).toBeNull();
  });

  it('paginates check runs and maps app, output and external id', async () => {
    const page = (count: number, offset: number) => ({
      check_runs: Array.from({ length: count }, (_, index) => ({
        id: offset + index,
        name: 'Local CI / pr',
        head_sha: HEAD_SHA,
        external_id: 'key',
        status: 'completed',
        conclusion: 'success',
        completed_at: '2026-09-05T11:00:00Z',
        app: { id: 4242, slug: 'nabatable-local-ci' },
        details_url: 'https://evidence.example/1',
        output: { text: '{}' },
      })),
    });
    const fetchImpl: FetchLike = async (url) => {
      const pageNumber = Number(new URL(url).searchParams.get('page'));
      return new Response(JSON.stringify(pageNumber === 1 ? page(100, 0) : page(1, 100)), {
        status: 200,
      });
    };
    const api = createGitHubApi({ token: 't', repository: 'a/b', fetchImpl });
    const runs = await api.listCheckRuns(HEAD_SHA, 'Local CI / pr');
    expect(runs).toHaveLength(101);
    expect(runs[0]).toEqual(
      expect.objectContaining({ appId: 4242, externalId: 'key', outputText: '{}' }),
    );
  });

  it('throws a GitHubApiError without echoing the response body on failures', async () => {
    const api = createGitHubApi({
      token: 't',
      repository: 'a/b',
      fetchImpl: fakeFetch({
        '/repos/a/b/actions/runs/1': { status: 500, body: { message: 'leak' } },
      }),
    });
    await expect(api.getWorkflowRun(1)).rejects.toMatchObject({
      name: 'GitHubApiError',
      status: 500,
    });
    await expect(api.getWorkflowRun(1)).rejects.not.toThrow('leak');
    await expect(api.getRepository()).rejects.toBeInstanceOf(GitHubApiError);
  });

  it('creates completed check runs with the expected payload', async () => {
    const recorded: Recorded[] = [];
    const api = createGitHubApi({
      token: 't',
      repository: 'a/b',
      fetchImpl: fakeFetch({ '/repos/a/b/check-runs': { body: { id: 77 } } }, recorded),
    });
    const created = await api.createCheckRun({
      name: 'Release gate',
      headSha: HEAD_SHA,
      externalId: 'key',
      conclusion: 'success',
      title: 't',
      summary: 's',
      text: 'body',
    });
    expect(created).toEqual({ id: 77 });
    const body = JSON.parse(String(recorded[0].init?.body)) as Record<string, unknown>;
    expect(body).toEqual(
      expect.objectContaining({
        name: 'Release gate',
        head_sha: HEAD_SHA,
        external_id: 'key',
        status: 'completed',
        conclusion: 'success',
      }),
    );
  });

  it('maps run artifacts, run created_at and commit committer dates', async () => {
    const recorded: Recorded[] = [];
    const api = createGitHubApi({
      token: 't',
      repository: 'a/b',
      fetchImpl: fakeFetch(
        {
          '/repos/a/b/actions/runs/5/artifacts': {
            body: {
              artifacts: [
                { id: 1, name: `hosted-fallback-evidence-${HEAD_SHA}-1`, expired: false },
                { id: 2, name: 'playwright-report', expired: true },
                { id: 3, name: 'no-expired-flag' },
              ],
            },
          },
          '/repos/a/b/actions/runs/5': {
            body: {
              id: 5,
              workflow_id: 333,
              head_sha: MERGE_SHA,
              event: 'workflow_dispatch',
              status: 'completed',
              conclusion: 'success',
              created_at: '2026-09-05T10:30:00Z',
              updated_at: '2026-09-05T11:00:00Z',
            },
          },
          [`/repos/a/b/commits/${HEAD_SHA}`]: {
            body: {
              sha: HEAD_SHA,
              parents: [{ sha: MERGE_SHA }],
              commit: { committer: { date: '2026-09-05T09:00:00Z' } },
            },
          },
          [`/repos/a/b/commits/${MERGE_SHA}`]: {
            body: { sha: MERGE_SHA, parents: [] },
          },
        },
        recorded,
      ),
    });
    expect(await api.listRunArtifacts(5)).toEqual([
      { id: 1, name: `hosted-fallback-evidence-${HEAD_SHA}-1`, expired: false },
      { id: 2, name: 'playwright-report', expired: true },
      { id: 3, name: 'no-expired-flag', expired: false },
    ]);
    expect(recorded[0].url).toContain('/repos/a/b/actions/runs/5/artifacts?per_page=100&page=1');
    expect(await api.getWorkflowRun(5)).toEqual(
      expect.objectContaining({ createdAt: '2026-09-05T10:30:00Z' }),
    );
    expect(await api.getCommit(HEAD_SHA)).toEqual({
      sha: HEAD_SHA,
      parents: [MERGE_SHA],
      committedAt: '2026-09-05T09:00:00Z',
    });
    expect(await api.getCommit(MERGE_SHA)).toEqual({
      sha: MERGE_SHA,
      parents: [],
      committedAt: null,
    });
  });

  it('maps approvals, deployments and statuses defensively', async () => {
    const api = createGitHubApi({
      token: 't',
      repository: 'a/b',
      fetchImpl: fakeFetch({
        '/repos/a/b/actions/runs/5/approvals': {
          body: [{ state: 'approved', environments: [{ name: 'CI fallback' }, { nope: 1 }] }],
        },
        '/repos/a/b/deployments/9/statuses': {
          body: [{ state: 'success', log_url: 'https://x/actions/runs/5' }],
        },
        '/repos/a/b/deployments': {
          body: [{ id: 9, environment: 'CI fallback', sha: HEAD_SHA, ref: 'main' }],
        },
        '/repos/a/b/compare/': { body: { status: 'ahead' } },
      }),
    });
    expect(await api.listRunApprovals(5)).toEqual([
      { state: 'approved', environments: ['CI fallback'] },
    ]);
    expect(await api.listDeployments('CI fallback')).toEqual([
      { id: 9, environment: 'CI fallback', sha: HEAD_SHA, ref: 'main' },
    ]);
    expect(await api.listDeploymentStatuses(9)).toEqual([
      { state: 'success', logUrl: 'https://x/actions/runs/5' },
    ]);
    expect(await api.compareCommits(HEAD_SHA, 'main')).toEqual({ status: 'ahead' });
  });
});
