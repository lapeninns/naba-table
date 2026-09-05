import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import {
  assertSucceeded,
  type CommandResult,
  type CommandRunner,
  type CommandSpec,
} from '../runner';
import type { CiRequest } from '../types';

/**
 * Credential-free git spool.
 *
 * The executor never reads the developer's checkout. It fetches exactly the
 * requested SHAs from the configured https remote into a bare spool repository
 * (no credential helpers, no global/system git config, no prompts), produces the
 * synthetic merge for PRs there, and emits a `git bundle` that is verified to
 * contain head/base/tested before anything leaves the host.
 */

export const SPOOL_GIT_IDENTITY = { name: 'nabatable-ci', email: 'ci@nabatable.invalid' } as const;
/** Fixed timestamps make the synthetic merge commit reproducible for a given head+base. */
export const SPOOL_MERGE_DATE = '1700000000 +0000';

export interface SpoolInput {
  readonly request: CiRequest;
  readonly spoolRoot: string;
  readonly remoteUrl: string;
  readonly jobId: string;
}

export type SpoolProtocol = 'https' | 'file';

export interface SpoolDeps {
  readonly runner: CommandRunner;
  /** PATH for locating git. Nothing else from the host environment is forwarded. */
  readonly pathEnv: string;
  /** Remote protocols git may use. Production is https only; tests add `file`. */
  readonly allowedProtocols?: readonly SpoolProtocol[];
  /** Host-only, repository-scoped installation token. Never supplied to guest commands. */
  readonly acquireFetchToken?: () => Promise<{
    readonly token: string;
    readonly release: () => Promise<void>;
  }>;
}

export interface SpoolBundle {
  readonly bundlePath: string;
  readonly spoolRepo: string;
  readonly heads: Readonly<Record<'head' | 'base' | 'tested', string>>;
  readonly syntheticMergeSha: string | null;
  /** Repository-relative paths changed by head relative to base; null when unknown. */
  readonly changedPaths: readonly string[] | null;
}

export const MAX_CHANGED_PATHS = 20_000;

export class SpoolMergeConflictError extends Error {
  constructor(readonly conflictingPaths: readonly string[]) {
    super(
      `synthetic merge has conflicts; refusing to test an unmergeable PR (${conflictingPaths.length} conflicting path(s))`,
    );
    this.name = 'SpoolMergeConflictError';
  }
}

export class SpoolShaMismatchError extends Error {
  constructor(
    message: string,
    readonly producedTestedSha: string | null,
  ) {
    super(message);
    this.name = 'SpoolShaMismatchError';
  }
}

export interface PlannedCommand {
  readonly purpose: string;
  readonly command: string;
  readonly args: readonly string[];
}

export function spoolPaths(input: SpoolInput): {
  spoolRepo: string;
  spoolHome: string;
  worktree: string;
  bundlePath: string;
} {
  const base = path.join(input.spoolRoot, String(input.request.repositoryId));
  return {
    spoolRepo: path.join(base, 'repo.git'),
    spoolHome: path.join(base, 'home'),
    worktree: path.join(base, 'worktrees', input.jobId),
    bundlePath: path.join(base, 'bundles', `${input.jobId}.bundle`),
  };
}

function gitHardening(protocols: readonly SpoolProtocol[]): readonly string[] {
  return [
    '-c',
    'credential.helper=',
    '-c',
    'protocol.allow=never',
    ...protocols.flatMap((protocol) => ['-c', `protocol.${protocol}.allow=always`]),
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'gc.auto=0',
  ];
}

/** Production hardening: https only. */
const GIT_HARDENING = gitHardening(['https']);

function hardeningFor(deps: SpoolDeps): readonly string[] {
  return gitHardening(deps.allowedProtocols ?? ['https']);
}

function gitEnv(deps: SpoolDeps, spoolHome: string): Readonly<Record<string, string>> {
  return {
    PATH: deps.pathEnv,
    HOME: spoolHome,
    XDG_CONFIG_HOME: path.join(spoolHome, '.config'),
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_ASKPASS: '/dev/null/askpass-disabled',
    SSH_ASKPASS: '/dev/null/askpass-disabled',
    GIT_SSH_COMMAND: 'false',
    GIT_AUTHOR_NAME: SPOOL_GIT_IDENTITY.name,
    GIT_AUTHOR_EMAIL: SPOOL_GIT_IDENTITY.email,
    GIT_COMMITTER_NAME: SPOOL_GIT_IDENTITY.name,
    GIT_COMMITTER_EMAIL: SPOOL_GIT_IDENTITY.email,
    GIT_AUTHOR_DATE: SPOOL_MERGE_DATE,
    GIT_COMMITTER_DATE: SPOOL_MERGE_DATE,
    LC_ALL: 'C',
  };
}

function refNames(jobId: string): Record<'head' | 'base' | 'tested', string> {
  return {
    head: `refs/ci/${jobId}/head`,
    base: `refs/ci/${jobId}/base`,
    tested: `refs/ci/${jobId}/tested`,
  };
}

function fetchArgs(
  repo: string,
  remoteUrl: string,
  shas: readonly string[],
  hardening: readonly string[] = GIT_HARDENING,
): string[] {
  return [
    ...hardening,
    '-C',
    repo,
    'fetch',
    '--no-tags',
    '--no-write-fetch-head',
    '--no-auto-gc',
    '--quiet',
    remoteUrl,
    ...shas,
  ];
}

async function fetchSource(
  deps: SpoolDeps,
  env: Readonly<Record<string, string>>,
  input: SpoolInput,
  shas: readonly string[],
  purpose: string,
  allowFailure = false,
): Promise<void> {
  const args = fetchArgs(spoolPaths(input).spoolRepo, input.remoteUrl, shas, hardeningFor(deps));
  if (!deps.acquireFetchToken) {
    await git(deps, env, args, purpose, { allowFailure });
    return;
  }
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/u.test(input.remoteUrl)) {
    throw new Error('authenticated source remote must be a canonical github.com repository URL');
  }
  const lease = await deps.acquireFetchToken();
  try {
    if (!/^[A-Za-z0-9_.-]+$/u.test(lease.token)) throw new Error('invalid source token');
    const header = `Authorization: Basic ${Buffer.from(`x-access-token:${lease.token}`).toString('base64')}`;
    // Environment-only Git configuration: no token in argv, persisted config,
    // FETCH_HEAD, bundle, or any local merge/inspection command. Redirects denied.
    await git(
      deps,
      {
        ...env,
        GIT_CONFIG_COUNT: '2',
        GIT_CONFIG_KEY_0: `http.${input.remoteUrl}.extraheader`,
        GIT_CONFIG_VALUE_0: header,
        GIT_CONFIG_KEY_1: 'http.followRedirects',
        GIT_CONFIG_VALUE_1: 'false',
      },
      args,
      purpose,
      { allowFailure },
    );
  } catch {
    // Git/transport diagnostics can reflect headers. Never expose their output.
    throw new Error('authenticated source fetch failed');
  } finally {
    await lease.release();
  }
}

/** Ordered happy-path plan used by `--dry-run`. Nothing here executes. */
export function planSpool(input: SpoolInput): readonly PlannedCommand[] {
  const { request } = input;
  const paths = spoolPaths(input);
  const refs = refNames(input.jobId);
  const isPr = request.profile === 'pr';
  const plan: PlannedCommand[] = [
    {
      purpose: 'init bare spool repository',
      command: 'git',
      args: ['init', '--bare', '--quiet', paths.spoolRepo],
    },
    {
      purpose: 'fetch exactly the requested SHAs (credential-free)',
      command: 'git',
      args: fetchArgs(paths.spoolRepo, input.remoteUrl, [request.headSha, request.baseSha]),
    },
  ];
  if (isPr) {
    plan.push(
      {
        purpose: 'best-effort fetch of the controller-provided synthetic merge SHA',
        command: 'git',
        args: fetchArgs(paths.spoolRepo, input.remoteUrl, [request.testedSha]),
      },
      {
        purpose: 'checkout base into a disposable worktree',
        command: 'git',
        args: [
          ...GIT_HARDENING,
          '-C',
          paths.spoolRepo,
          'worktree',
          'add',
          '--detach',
          paths.worktree,
          request.baseSha,
        ],
      },
      {
        purpose: 'produce the synthetic merge (refuses on conflict)',
        command: 'git',
        args: [
          ...GIT_HARDENING,
          '-C',
          paths.worktree,
          'merge',
          '--no-ff',
          '--no-edit',
          '-m',
          mergeMessage(request),
          request.headSha,
        ],
      },
      {
        purpose: 'remove the disposable worktree',
        command: 'git',
        args: [
          ...GIT_HARDENING,
          '-C',
          paths.spoolRepo,
          'worktree',
          'remove',
          '--force',
          paths.worktree,
        ],
      },
    );
  }
  plan.push(
    {
      purpose: 'pin job refs',
      command: 'git',
      args: [...GIT_HARDENING, '-C', paths.spoolRepo, 'update-ref', refs.head, request.headSha],
    },
    {
      purpose: 'create bundle from pinned refs',
      command: 'git',
      args: [
        ...GIT_HARDENING,
        '-C',
        paths.spoolRepo,
        'bundle',
        'create',
        paths.bundlePath,
        refs.head,
        refs.base,
        refs.tested,
      ],
    },
    {
      purpose: 'verify bundle integrity',
      command: 'git',
      args: ['bundle', 'verify', paths.bundlePath],
    },
    {
      purpose: 'verify bundle heads contain head/base/tested',
      command: 'git',
      args: ['bundle', 'list-heads', paths.bundlePath],
    },
  );
  return plan;
}

function mergeMessage(request: CiRequest): string {
  return `ci: synthetic merge of ${request.headSha} into ${request.baseSha} (pr #${request.prNumber ?? 0})`;
}

async function git(
  deps: SpoolDeps,
  env: Readonly<Record<string, string>>,
  args: readonly string[],
  purpose: string,
  options: { readonly allowFailure?: boolean; readonly timeoutMs?: number } = {},
): Promise<CommandResult> {
  const spec: CommandSpec = {
    command: 'git',
    args,
    env,
    purpose,
    timeoutMs: options.timeoutMs ?? 10 * 60_000,
  };
  const result = await deps.runner.run(spec);
  if (!options.allowFailure) {
    assertSucceeded(result, purpose);
  }
  return result;
}

async function isCommit(
  deps: SpoolDeps,
  env: Readonly<Record<string, string>>,
  repo: string,
  sha: string,
): Promise<boolean> {
  const result = await git(
    deps,
    env,
    [...GIT_HARDENING, '-C', repo, 'cat-file', '-t', sha],
    `inspect ${sha}`,
    {
      allowFailure: true,
    },
  );
  return result.exitCode === 0 && result.stdout.trim() === 'commit';
}

async function revParse(
  deps: SpoolDeps,
  env: Readonly<Record<string, string>>,
  repo: string,
  rev: string,
): Promise<string> {
  const result = await git(
    deps,
    env,
    [...GIT_HARDENING, '-C', repo, 'rev-parse', '--verify', rev],
    `rev-parse ${rev}`,
  );
  return result.stdout.trim();
}

async function produceSyntheticMerge(
  deps: SpoolDeps,
  env: Readonly<Record<string, string>>,
  input: SpoolInput,
): Promise<{ sha: string; tree: string }> {
  const { request } = input;
  const paths = spoolPaths(input);
  rmSync(paths.worktree, { recursive: true, force: true });
  await git(
    deps,
    env,
    [...GIT_HARDENING, '-C', paths.spoolRepo, 'worktree', 'prune'],
    'prune stale worktrees',
    { allowFailure: true },
  );
  await git(
    deps,
    env,
    [
      ...GIT_HARDENING,
      '-C',
      paths.spoolRepo,
      'worktree',
      'add',
      '--detach',
      paths.worktree,
      request.baseSha,
    ],
    'checkout base into worktree',
  );
  try {
    const merge = await git(
      deps,
      env,
      [
        ...GIT_HARDENING,
        '-C',
        paths.worktree,
        'merge',
        '--no-ff',
        '--no-edit',
        '-m',
        mergeMessage(request),
        request.headSha,
      ],
      'synthetic merge',
      { allowFailure: true },
    );
    if (merge.exitCode !== 0) {
      const conflicts = await git(
        deps,
        env,
        [...GIT_HARDENING, '-C', paths.worktree, 'diff', '--name-only', '--diff-filter=U'],
        'list merge conflicts',
        { allowFailure: true },
      );
      await git(
        deps,
        env,
        [...GIT_HARDENING, '-C', paths.worktree, 'merge', '--abort'],
        'abort merge',
        {
          allowFailure: true,
        },
      );
      const conflictingPaths = conflicts.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      throw new SpoolMergeConflictError(conflictingPaths);
    }
    const sha = await revParse(deps, env, paths.worktree, 'HEAD');
    const tree = await revParse(deps, env, paths.worktree, 'HEAD^{tree}');
    return { sha, tree };
  } finally {
    await git(
      deps,
      env,
      [...GIT_HARDENING, '-C', paths.spoolRepo, 'worktree', 'remove', '--force', paths.worktree],
      'remove worktree',
      { allowFailure: true },
    );
    rmSync(paths.worktree, { recursive: true, force: true });
  }
}

async function verifyTestedSha(
  deps: SpoolDeps,
  env: Readonly<Record<string, string>>,
  input: SpoolInput,
  produced: { sha: string; tree: string },
): Promise<void> {
  const { request } = input;
  const { spoolRepo } = spoolPaths(input);
  if (request.testedSha === produced.sha) return;
  if (!(await isCommit(deps, env, spoolRepo, request.testedSha))) {
    throw new SpoolShaMismatchError(
      `testedSha ${request.testedSha} is neither fetchable nor equal to the synthetic merge ${produced.sha}`,
      produced.sha,
    );
  }
  const parentList = await git(
    deps,
    env,
    [...GIT_HARDENING, '-C', spoolRepo, 'rev-list', '--parents', '-n', '1', request.testedSha],
    'list testedSha parents',
    { allowFailure: true },
  );
  const parents = new Set(parentList.stdout.trim().split(/\s+/u).slice(1));
  if (
    parentList.exitCode !== 0 ||
    !parents.has(request.baseSha) ||
    !parents.has(request.headSha) ||
    parents.size !== 2
  ) {
    throw new SpoolShaMismatchError(
      `testedSha ${request.testedSha} is not a merge of baseSha and headSha`,
      produced.sha,
    );
  }
  const tree = await revParse(deps, env, spoolRepo, `${request.testedSha}^{tree}`);
  if (tree !== produced.tree) {
    throw new SpoolShaMismatchError(
      `testedSha ${request.testedSha} tree differs from the locally produced synthetic merge`,
      produced.sha,
    );
  }
}

function parseListHeads(output: string): ReadonlyMap<string, string> {
  const heads = new Map<string, string>();
  for (const line of output.split('\n')) {
    const match = /^([0-9a-f]{40})\s+(\S+)$/u.exec(line.trim());
    if (match) heads.set(match[2], match[1]);
  }
  return heads;
}

export async function createSpoolBundle(input: SpoolInput, deps: SpoolDeps): Promise<SpoolBundle> {
  const { request } = input;
  const paths = spoolPaths(input);
  const refs = refNames(input.jobId);
  mkdirSync(paths.spoolHome, { recursive: true });
  mkdirSync(path.dirname(paths.bundlePath), { recursive: true });
  const env = gitEnv(deps, paths.spoolHome);

  if (!existsSync(path.join(paths.spoolRepo, 'HEAD'))) {
    mkdirSync(paths.spoolRepo, { recursive: true });
    await git(
      deps,
      env,
      ['init', '--bare', '--quiet', paths.spoolRepo],
      'init bare spool repository',
    );
  }

  await fetchSource(deps, env, input, [request.headSha, request.baseSha], 'fetch head and base');
  for (const [name, sha] of [
    ['headSha', request.headSha],
    ['baseSha', request.baseSha],
  ] as const) {
    if (!(await isCommit(deps, env, paths.spoolRepo, sha))) {
      throw new SpoolShaMismatchError(`${name} ${sha} was not obtained from the remote`, null);
    }
  }

  let syntheticMergeSha: string | null = null;
  if (request.profile === 'pr') {
    await fetchSource(
      deps,
      env,
      input,
      [request.testedSha],
      'fetch synthetic merge candidate',
      true,
    );
    const produced = await produceSyntheticMerge(deps, env, input);
    await verifyTestedSha(deps, env, input, produced);
    syntheticMergeSha = produced.sha;
  } else if (request.testedSha !== request.headSha) {
    throw new SpoolShaMismatchError('non-PR profiles require testedSha === headSha', null);
  }

  for (const [key, sha] of [
    [refs.head, request.headSha],
    [refs.base, request.baseSha],
    [refs.tested, request.testedSha],
  ] as const) {
    await git(
      deps,
      env,
      [...GIT_HARDENING, '-C', paths.spoolRepo, 'update-ref', key, sha],
      `pin ${key}`,
    );
  }

  try {
    rmSync(paths.bundlePath, { force: true });
    await git(
      deps,
      env,
      [
        ...GIT_HARDENING,
        '-C',
        paths.spoolRepo,
        'bundle',
        'create',
        '--quiet',
        paths.bundlePath,
        refs.head,
        refs.base,
        refs.tested,
      ],
      'create bundle',
    );
    await git(deps, env, ['bundle', 'verify', '--quiet', paths.bundlePath], 'verify bundle');
    const listed = await git(
      deps,
      env,
      ['bundle', 'list-heads', paths.bundlePath],
      'list bundle heads',
    );
    const heads = parseListHeads(listed.stdout);
    const expected: Array<[string, string]> = [
      [refs.head, request.headSha],
      [refs.base, request.baseSha],
      [refs.tested, request.testedSha],
    ];
    for (const [ref, sha] of expected) {
      if (heads.get(ref) !== sha) {
        throw new SpoolShaMismatchError(
          `bundle does not carry ${ref} at ${sha}`,
          syntheticMergeSha,
        );
      }
    }
  } finally {
    for (const ref of Object.values(refs)) {
      await git(
        deps,
        env,
        [...GIT_HARDENING, '-C', paths.spoolRepo, 'update-ref', '-d', ref],
        `unpin ${ref}`,
        {
          allowFailure: true,
        },
      );
    }
  }

  const changedPaths = await listChangedPaths(deps, env, paths.spoolRepo, request);

  return {
    bundlePath: paths.bundlePath,
    spoolRepo: paths.spoolRepo,
    heads: { head: request.headSha, base: request.baseSha, tested: request.testedSha },
    syntheticMergeSha,
    changedPaths,
  };
}

/**
 * Paths changed by head relative to base (merge-base for PRs), used to resolve
 * conditional suites. Any failure or an implausibly large change set yields
 * `null` ("unknown"), which the profile resolver treats as "run everything".
 */
async function listChangedPaths(
  deps: SpoolDeps,
  env: Readonly<Record<string, string>>,
  repo: string,
  request: CiRequest,
): Promise<readonly string[] | null> {
  const range =
    request.profile === 'pr'
      ? `${request.baseSha}...${request.headSha}`
      : `${request.baseSha}..${request.headSha}`;
  const result = await git(
    deps,
    env,
    [...GIT_HARDENING, '-C', repo, 'diff', '--name-only', '--no-renames', '-z', range],
    'list changed paths',
    { allowFailure: true, timeoutMs: 120_000 },
  );
  if (result.exitCode !== 0 || result.timedOut || result.stdoutTruncated) return null;
  const paths = result.stdout.split('\0').filter((entry) => entry.length > 0);
  if (paths.length > MAX_CHANGED_PATHS) return null;
  return paths.sort();
}
