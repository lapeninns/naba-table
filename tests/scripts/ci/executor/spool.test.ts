import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { SpawnCommandRunner } from '@/scripts/ci/executor/runner';
import {
  createSpoolBundle,
  planSpool,
  SpoolMergeConflictError,
  SpoolShaMismatchError,
  spoolPaths,
} from '@/scripts/ci/executor/spool/bundle';
import { POLICY_VERSION } from '@/scripts/ci/profiles/catalog';

import {
  cleanupTempDirs,
  FakeRunner,
  IMAGE_DIGEST,
  mainRequest,
  makeTempDir,
  okResult,
  prRequest,
  REPOSITORY_ID,
  SHA_BASE,
  SHA_HEAD,
  when,
} from './helpers';

import type { CiRequest } from '@/scripts/ci/executor/types';

afterEach(cleanupTempDirs);

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
};

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();
}

interface Origin {
  readonly url: string;
  readonly base: string;
  readonly head: string;
  readonly conflictingHead: string;
  readonly work: string;
}

/** A tiny origin repo: base <- head (clean) and base <- conflictingHead (conflicts on the same line). */
function makeOrigin(): Origin {
  const root = makeTempDir('nabatable-spool-origin-');
  const work = path.join(root, 'work');
  mkdirSync(work);
  git(work, 'init', '--quiet', '--initial-branch=main');
  writeFileSync(path.join(work, 'README.md'), 'base\n');
  writeFileSync(path.join(work, 'shared.txt'), 'line\n');
  git(work, 'add', '.');
  git(work, 'commit', '--quiet', '-m', 'base');
  const base = git(work, 'rev-parse', 'HEAD');

  git(work, 'checkout', '--quiet', '-b', 'feature');
  mkdirSync(path.join(work, 'tests'), { recursive: true });
  writeFileSync(path.join(work, 'tests', 'new.test.ts'), 'test\n');
  git(work, 'add', '.');
  git(work, 'commit', '--quiet', '-m', 'head');
  const head = git(work, 'rev-parse', 'HEAD');

  git(work, 'checkout', '--quiet', base);
  writeFileSync(path.join(work, 'shared.txt'), 'base change\n');
  git(work, 'commit', '--quiet', '-am', 'base moves on');
  const movedBase = git(work, 'rev-parse', 'HEAD');
  git(work, 'checkout', '--quiet', '-b', 'conflict', base);
  writeFileSync(path.join(work, 'shared.txt'), 'head change\n');
  git(work, 'commit', '--quiet', '-am', 'conflicting head');
  const conflictingHead = git(work, 'rev-parse', 'HEAD');

  const bare = path.join(root, 'origin.git');
  git(root, 'clone', '--quiet', '--bare', work, bare);
  return { url: `file://${bare}`, base: movedBase, head, conflictingHead, work };
}

function requestFor(origin: Origin, testedSha: string, head = origin.head): CiRequest {
  return prRequest({ headSha: head, baseSha: origin.base, testedSha });
}

describe('createSpoolBundle (real git)', () => {
  const runner = new SpawnCommandRunner();
  const deps = {
    runner,
    pathEnv: process.env.PATH ?? '/usr/bin:/bin',
    allowedProtocols: ['https', 'file'] as const,
  };

  it('produces the synthetic merge and a bundle that carries head, base and tested', async () => {
    const origin = makeOrigin();
    const spoolRoot = makeTempDir('nabatable-spool-root-');
    // First pass: learn the deterministic synthetic merge SHA by asking for an
    // unknown testedSha; the refusal reports what was produced.
    const probe = requestFor(origin, 'f'.repeat(40));
    let produced: string | null = null;
    try {
      await createSpoolBundle(
        { request: probe, spoolRoot, remoteUrl: origin.url, jobId: 'ci-probe' },
        deps,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(SpoolShaMismatchError);
      produced = (error as SpoolShaMismatchError).producedTestedSha;
    }
    expect(produced).toMatch(/^[0-9a-f]{40}$/u);

    const request = requestFor(origin, produced as string);
    const bundle = await createSpoolBundle(
      { request, spoolRoot, remoteUrl: origin.url, jobId: 'ci-pr-000000000000-a1' },
      deps,
    );
    expect(bundle.syntheticMergeSha).toBe(produced);
    expect(existsSync(bundle.bundlePath)).toBe(true);
    const heads = execFileSync('git', ['bundle', 'list-heads', bundle.bundlePath], {
      encoding: 'utf8',
    });
    expect(heads).toContain(`${origin.head} refs/ci/ci-pr-000000000000-a1/head`);
    expect(heads).toContain(`${origin.base} refs/ci/ci-pr-000000000000-a1/base`);
    expect(heads).toContain(`${produced} refs/ci/ci-pr-000000000000-a1/tested`);
    expect(bundle.changedPaths).toEqual(['tests/new.test.ts']);

    // The merge commit has exactly the two expected parents and a fixed identity.
    const spool = spoolPaths({ request, spoolRoot, remoteUrl: origin.url, jobId: 'x' }).spoolRepo;
    const parents = git(spool, 'rev-list', '--parents', '-n', '1', produced as string).split(' ');
    expect(new Set(parents.slice(1))).toEqual(new Set([origin.base, origin.head]));
    expect(git(spool, 'log', '-1', '--format=%an <%ae>', produced as string)).toBe(
      'nabatable-ci <ci@nabatable.invalid>',
    );
    // No worktree or job refs survive.
    expect(git(spool, 'for-each-ref', 'refs/ci/')).toBe('');
  });

  it('refuses an unmergeable PR instead of testing it', async () => {
    const origin = makeOrigin();
    const spoolRoot = makeTempDir('nabatable-spool-root-');
    const request = requestFor(origin, 'f'.repeat(40), origin.conflictingHead);
    await expect(
      createSpoolBundle({ request, spoolRoot, remoteUrl: origin.url, jobId: 'ci-conflict' }, deps),
    ).rejects.toBeInstanceOf(SpoolMergeConflictError);
    const spool = spoolPaths({ request, spoolRoot, remoteUrl: origin.url, jobId: 'x' }).spoolRepo;
    expect(
      git(spool, 'worktree', 'list', '--porcelain')
        .split('\n')
        .filter((l) => l.startsWith('worktree')).length,
    ).toBe(1);
    expect(
      existsSync(path.join(spoolRoot, String(REPOSITORY_ID), 'worktrees', 'ci-conflict')),
    ).toBe(false);
  });

  it('refuses a testedSha that is not the synthetic merge of head and base', async () => {
    const origin = makeOrigin();
    const spoolRoot = makeTempDir('nabatable-spool-root-');
    // origin.conflictingHead exists in the remote but is not a merge of base+head.
    const request = requestFor(origin, origin.conflictingHead);
    await expect(
      createSpoolBundle({ request, spoolRoot, remoteUrl: origin.url, jobId: 'ci-bad' }, deps),
    ).rejects.toThrow(/not a merge of baseSha and headSha/u);
  });

  it('refuses SHAs the remote does not have', async () => {
    const origin = makeOrigin();
    const spoolRoot = makeTempDir('nabatable-spool-root-');
    const request = mainRequest({
      headSha: 'd'.repeat(40),
      baseSha: origin.base,
      testedSha: 'd'.repeat(40),
    });
    await expect(
      createSpoolBundle({ request, spoolRoot, remoteUrl: origin.url, jobId: 'ci-missing' }, deps),
    ).rejects.toThrow();
  });

  it('bundles main-profile requests without a merge and lists changed paths', async () => {
    const origin = makeOrigin();
    const spoolRoot = makeTempDir('nabatable-spool-root-');
    const request = mainRequest({
      headSha: origin.head,
      baseSha: origin.base,
      testedSha: origin.head,
    });
    const bundle = await createSpoolBundle(
      { request, spoolRoot, remoteUrl: origin.url, jobId: 'ci-main-000000000000-a1' },
      deps,
    );
    expect(bundle.syntheticMergeSha).toBeNull();
    expect(bundle.changedPaths).toEqual(['shared.txt', 'tests/new.test.ts']);
  });

  it('refuses file:// remotes unless the protocol is explicitly allowed', async () => {
    const origin = makeOrigin();
    const spoolRoot = makeTempDir('nabatable-spool-root-');
    const request = mainRequest({
      headSha: origin.head,
      baseSha: origin.base,
      testedSha: origin.head,
    });
    await expect(
      createSpoolBundle(
        { request, spoolRoot, remoteUrl: origin.url, jobId: 'ci-https-only' },
        { runner, pathEnv: deps.pathEnv },
      ),
    ).rejects.toThrow(/fetch head and base/u);
  });
});

describe('createSpoolBundle (scripted git)', () => {
  it('never forwards host credentials or config to git', async () => {
    const spoolRoot = makeTempDir('nabatable-spool-root-');
    const request = mainRequest();
    const runner = new FakeRunner([
      when('git', ['cat-file', '-t'], okResult({ stdout: 'commit\n' })),
      when(
        'git',
        ['bundle', 'list-heads'],
        okResult({
          stdout: [
            `${SHA_HEAD} refs/ci/job/head`,
            `${SHA_BASE} refs/ci/job/base`,
            `${SHA_HEAD} refs/ci/job/tested`,
          ].join('\n'),
        }),
      ),
    ]);
    await createSpoolBundle(
      { request, spoolRoot, remoteUrl: 'https://github.com/example/repo.git', jobId: 'job' },
      { runner, pathEnv: '/usr/bin' },
    );
    for (const call of runner.calls) {
      expect(call.command).toBe('git');
      expect(call.env).toMatchObject({
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_SSH_COMMAND: 'false',
      });
      expect(Object.keys(call.env ?? {})).not.toContain('GITHUB_TOKEN');
      expect(call.env?.HOME).toBe(path.join(spoolRoot, String(REPOSITORY_ID), 'home'));
    }
    const fetches = runner.find('git', 'fetch');
    expect(fetches.length).toBe(1);
    expect(fetches[0].args).toContain('protocol.allow=never');
    expect(fetches[0].args).toContain('protocol.https.allow=always');
    expect(fetches[0].args).not.toContain('protocol.file.allow=always');
    expect(fetches[0].args).toContain('credential.helper=');
  });

  it('refuses when the produced bundle does not carry the requested SHAs', async () => {
    const spoolRoot = makeTempDir('nabatable-spool-root-');
    const runner = new FakeRunner([
      when('git', ['cat-file', '-t'], okResult({ stdout: 'commit\n' })),
      when(
        'git',
        ['bundle', 'list-heads'],
        okResult({ stdout: `${'9'.repeat(40)} refs/ci/job/head\n` }),
      ),
    ]);
    await expect(
      createSpoolBundle(
        { request: mainRequest(), spoolRoot, remoteUrl: 'https://example.com/r.git', jobId: 'job' },
        { runner, pathEnv: '/usr/bin' },
      ),
    ).rejects.toBeInstanceOf(SpoolShaMismatchError);
    // Job refs are unpinned even after the failure.
    expect(runner.find('git', 'update-ref', '-d').length).toBe(3);
  });
});

describe('planSpool', () => {
  it('plans the pr flow with a merge and the main flow without one', () => {
    const base = { spoolRoot: '/spool', remoteUrl: 'https://example.com/r.git', jobId: 'job' };
    const pr = planSpool({ ...base, request: prRequest() }).map((step) => step.purpose);
    expect(pr).toContain('produce the synthetic merge (refuses on conflict)');
    expect(pr[pr.length - 1]).toBe('verify bundle heads contain head/base/tested');
    const main = planSpool({ ...base, request: mainRequest() }).map((step) => step.purpose);
    expect(main).not.toContain('produce the synthetic merge (refuses on conflict)');
    expect(POLICY_VERSION).toBe(mainRequest().policyVersion);
    expect(IMAGE_DIGEST).toMatch(/^sha256:/u);
  });
});
