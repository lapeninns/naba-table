import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { extractCiResultDocument, parseCiResult } from '@/scripts/ci/gate/ci-result';
import {
  FallbackEvidenceMismatchError,
  PASSTHROUGH_ENV_KEYS,
  PRIVATE_HOME_DIRNAME,
  PRIVATE_TMP_DIRNAME,
  assertEvidenceBinding,
  bundleDigest,
  parseResolvedProfile,
  privateCommandDirs,
  publishFallbackCheck,
  runFallbackProfile,
  type CommandRunner,
  type ResolvedProfileInput,
} from '@/scripts/ci/gate/fallback-run';
import { tupleKey } from '@/scripts/ci/gate/tuple';
import { runProfileCli } from '@/scripts/ci/profiles/cli';

import { FALLBACK_RUN_ID, FALLBACK_RUN_URL, FakeGitHub, prTuple } from './helpers';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'fallback-run-'));
  temporaryDirectories.push(dir);
  return dir;
}

/** The real `pnpm ci:profile pr --json` output, produced in-process. */
function realPrProfile(): ResolvedProfileInput {
  const stdout: string[] = [];
  const code = runProfileCli(['pr', '--json'], {
    stdout: (line) => stdout.push(line),
    stderr: () => undefined,
    readFile: () => '',
  });
  expect(code).toBe(0);
  return parseResolvedProfile(JSON.parse(stdout.join('\n')));
}

type Call = { command: string; cwd: string; env: Record<string, string>; timeoutMs: number };

function recordingRunner(failing: Set<string> = new Set()): {
  runner: CommandRunner;
  calls: Call[];
} {
  const calls: Call[] = [];
  const runner: CommandRunner = (command, options) => {
    calls.push({ command, cwd: options.cwd, env: options.env, timeoutMs: options.timeoutMs });
    const failed = [...failing].some((needle) => command.includes(needle));
    return { status: failed ? 1 : 0, stdout: `ran ${command}`, stderr: '', timedOut: false };
  };
  return { runner, calls };
}

describe('parseResolvedProfile', () => {
  it('parses the real pr profile from scripts/ci/profiles', () => {
    const profile = realPrProfile();
    expect(profile.name).toBe('pr');
    expect(profile.policyVersion).toBe('2026-09-04.1');
    expect(profile.suites.map((suite) => suite.suiteId)).toContain('full-vitest-suite');
    expect(profile.commands.length).toBeGreaterThan(10);
  });

  it('refuses malformed documents and dangling suite references', () => {
    expect(() => parseResolvedProfile(null)).toThrow('must be an object');
    expect(() =>
      parseResolvedProfile({
        name: 'pr',
        policyVersion: 'x',
        suites: [],
        commands: [{ id: 'a', suiteId: 'ghost', run: 'true', timeoutMinutes: 1, effectiveEnv: {} }],
      }),
    ).toThrow('unknown suite ghost');
  });
});

describe('runFallbackProfile', () => {
  it('runs every included suite command in the candidate workdir with a sanitized env', async () => {
    const profile = realPrProfile();
    const { runner, calls } = recordingRunner();
    const outDir = tempDir();
    const workdir = tempDir();
    const outcome = await runFallbackProfile({
      profile,
      tuple: prTuple(),
      runId: FALLBACK_RUN_ID,
      workdir,
      outDir,
      runner,
      now: () => new Date('2026-09-05T10:00:00.000Z'),
      passthroughEnv: {
        PATH: '/usr/bin',
        HOME: '/home/runner',
        TMPDIR: '/home/runner/work/_temp',
        RUNNER_TEMP: '/home/runner/work/_temp',
        GITHUB_TOKEN: 'ghs_secret',
        SUPABASE_SERVICE_ROLE_KEY: 'real-key',
        AWS_SECRET_ACCESS_KEY: 'real',
      },
    });
    expect(outcome.passed).toBe(true);
    expect(calls.length).toBe(profile.commands.length);
    expect(calls.every((call) => call.cwd === workdir)).toBe(true);
    const privateDirs = privateCommandDirs(workdir);
    expect(privateDirs).toEqual({
      HOME: path.join(workdir, PRIVATE_HOME_DIRNAME),
      TMPDIR: path.join(workdir, PRIVATE_TMP_DIRNAME),
    });
    expect(existsSync(privateDirs.HOME)).toBe(true);
    expect(existsSync(privateDirs.TMPDIR)).toBe(true);
    for (const call of calls) {
      expect(call.env.GITHUB_TOKEN).toBeUndefined();
      expect(call.env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
      // The runner's HOME / RUNNER_TEMP (GITHUB_ENV, GITHUB_PATH live under it) never leak.
      expect(call.env.RUNNER_TEMP).toBeUndefined();
      expect(call.env.HOME).toBe(privateDirs.HOME);
      expect(call.env.TMPDIR).toBe(privateDirs.TMPDIR);
      expect(call.env.SUPABASE_SERVICE_ROLE_KEY).toBe('test-service-role-key');
      expect(call.env.PATH).toBe('/usr/bin');
      expect(call.env.CI).toBe('true');
      expect(call.timeoutMs).toBeGreaterThan(0);
    }
    const playwright = calls.find((call) => call.command.includes('playwright test'));
    expect(playwright?.env.QA_USE_MOCKS).toBe('1');

    const { result } = outcome;
    expect(result.source).toBe('hosted-fallback');
    expect(result.runId).toBe(FALLBACK_RUN_ID);
    expect(result.suites.map((suite) => suite.id)).toEqual(
      profile.suites.map((suite) => suite.suiteId),
    );
    expect(result.suites.every((suite) => suite.status === 'passed')).toBe(true);
    expect(result.coverage.status).toBe('passed');
    expect(result.evidence.bundleDigest).toBe(
      bundleDigest(
        Object.fromEntries(result.suites.map((suite) => [`${suite.id}.log`, suite.evidenceDigest])),
      ),
    );
    expect(existsSync(path.join(outDir, 'ci-result.json'))).toBe(true);
    const document = extractCiResultDocument(
      readFileSync(path.join(outDir, 'check-run.md'), 'utf8'),
    );
    expect(parseCiResult(document)).toEqual({ ok: true, result });
  });

  it('records suites excluded by the conditional rule as skipped without running them', async () => {
    const profile = realPrProfile();
    const excluded = profile.suites.map((suite) =>
      suite.suiteId.startsWith('shuffle-seed-') ? { ...suite, included: false } : suite,
    );
    const { runner, calls } = recordingRunner();
    const outcome = await runFallbackProfile({
      profile: { ...profile, suites: excluded },
      tuple: prTuple(),
      runId: FALLBACK_RUN_ID,
      workdir: tempDir(),
      outDir: tempDir(),
      runner,
      passthroughEnv: {},
    });
    expect(calls.some((call) => call.command.includes('test:stability'))).toBe(false);
    const shuffle = outcome.result.suites.filter((suite) => suite.id.startsWith('shuffle-seed-'));
    expect(shuffle).toHaveLength(3);
    expect(shuffle.every((suite) => suite.status === 'skipped')).toBe(true);
    expect(outcome.passed).toBe(true);
  });

  it('marks a suite failed on a failing command and skips its later commands', async () => {
    const profile = realPrProfile();
    const { runner, calls } = recordingRunner(new Set(['pnpm test:ci']));
    const outcome = await runFallbackProfile({
      profile,
      tuple: prTuple(),
      runId: FALLBACK_RUN_ID,
      workdir: tempDir(),
      outDir: tempDir(),
      runner,
      passthroughEnv: {},
    });
    expect(outcome.passed).toBe(false);
    const coverage = outcome.result.suites.find(
      (suite) => suite.id === 'coverage-and-performance-evidence',
    );
    expect(coverage?.status).toBe('failed');
    expect(outcome.result.coverage.status).toBe('failed');
    expect(calls.some((call) => call.command === 'pnpm test:ci:workspaces')).toBe(false);
    const log = readFileSync(outcome.logs['coverage-and-performance-evidence'], 'utf8');
    expect(log).toContain('not run (earlier command failed)');
  });

  it('refuses a profile that does not match the tuple', async () => {
    const profile = realPrProfile();
    await expect(
      runFallbackProfile({
        profile,
        tuple: prTuple({ profile: 'main', prNumber: undefined, testedSha: prTuple().headSha }),
        runId: 1,
        workdir: '/c',
        outDir: tempDir(),
        runner: recordingRunner().runner,
        passthroughEnv: {},
      }),
    ).rejects.toThrow('tuple requests "main"');
    await expect(
      runFallbackProfile({
        profile: { ...profile, policyVersion: '1999-01-01.1' },
        tuple: prTuple(),
        runId: 1,
        workdir: '/c',
        outDir: tempDir(),
        runner: recordingRunner().runner,
        passthroughEnv: {},
      }),
    ).rejects.toThrow('policy');
  });

  it('never passes credential-shaped keys or runner-state locations through', () => {
    for (const key of PASSTHROUGH_ENV_KEYS) {
      expect(key).not.toMatch(/TOKEN|SECRET|KEY|PASSWORD/);
    }
    const keys: readonly string[] = PASSTHROUGH_ENV_KEYS;
    expect(keys).not.toContain('HOME');
    expect(keys).not.toContain('TMPDIR');
    expect(keys).not.toContain('RUNNER_TEMP');
  });
});

describe('assertEvidenceBinding', () => {
  async function evidence() {
    return runFallbackProfile({
      profile: realPrProfile(),
      tuple: prTuple(),
      runId: FALLBACK_RUN_ID,
      workdir: tempDir(),
      outDir: tempDir(),
      runner: recordingRunner().runner,
      passthroughEnv: {},
    });
  }

  it('accepts evidence whose tuple and run id match the publish job', async () => {
    const { result } = await evidence();
    expect(() =>
      assertEvidenceBinding({
        result,
        expectedTuple: prTuple(),
        expectedRunId: FALLBACK_RUN_ID,
      }),
    ).not.toThrow();
  });

  it('refuses evidence for another tuple, another run or a non-fallback source', async () => {
    const { result } = await evidence();
    expect(() => assertEvidenceBinding({ result, expectedTuple: prTuple({ attempt: 2 }) })).toThrow(
      FallbackEvidenceMismatchError,
    );
    expect(() =>
      assertEvidenceBinding({
        result,
        expectedTuple: prTuple({ headSha: 'f'.repeat(40) }),
      }),
    ).toThrow(/differs from the workflow inputs/);
    expect(() =>
      assertEvidenceBinding({
        result,
        expectedTuple: prTuple(),
        expectedRunId: FALLBACK_RUN_ID + 1,
      }),
    ).toThrow(/names run 5001, this run is 5002/);
    expect(() =>
      assertEvidenceBinding({
        result: { ...result, source: 'local' },
        expectedTuple: prTuple(),
      }),
    ).toThrow(/not hosted-fallback/);
  });
});

describe('publishFallbackCheck', () => {
  it('publishes a check bound to the tuple key on the head commit', async () => {
    const profile = realPrProfile();
    const outcome = await runFallbackProfile({
      profile,
      tuple: prTuple(),
      runId: FALLBACK_RUN_ID,
      workdir: tempDir(),
      outDir: tempDir(),
      runner: recordingRunner().runner,
      passthroughEnv: {},
    });
    const api = new FakeGitHub();
    await publishFallbackCheck({
      api,
      result: outcome.result,
      checkNamePrefix: 'Hosted profile fallback / ',
      runUrl: FALLBACK_RUN_URL,
    });
    expect(api.state.created).toHaveLength(1);
    const created = api.state.created[0];
    expect(created.name).toBe('Hosted profile fallback / pr');
    expect(created.headSha).toBe(prTuple().headSha);
    expect(created.externalId).toBe(tupleKey(prTuple()));
    expect(created.conclusion).toBe('success');
    expect(created.detailsUrl).toBe(FALLBACK_RUN_URL);
    expect(parseCiResult(extractCiResultDocument(created.text)).ok).toBe(true);
  });

  it('publishes a failure when any suite failed', async () => {
    const outcome = await runFallbackProfile({
      profile: realPrProfile(),
      tuple: prTuple(),
      runId: FALLBACK_RUN_ID,
      workdir: tempDir(),
      outDir: tempDir(),
      runner: recordingRunner(new Set(['pnpm lint'])).runner,
      passthroughEnv: {},
    });
    const api = new FakeGitHub();
    await publishFallbackCheck({
      api,
      result: outcome.result,
      checkNamePrefix: 'Hosted profile fallback / ',
      runUrl: FALLBACK_RUN_URL,
    });
    expect(api.state.created[0].conclusion).toBe('failure');
    expect(api.state.created[0].summary).toContain('fast-static-gates');
  });

  it('publishes a failure when the profile job failed even if the evidence file claims a pass', async () => {
    const outcome = await runFallbackProfile({
      profile: realPrProfile(),
      tuple: prTuple(),
      runId: FALLBACK_RUN_ID,
      workdir: tempDir(),
      outDir: tempDir(),
      runner: recordingRunner().runner,
      passthroughEnv: {},
    });
    expect(outcome.passed).toBe(true);
    const api = new FakeGitHub();
    await publishFallbackCheck({
      api,
      result: outcome.result,
      checkNamePrefix: 'Hosted profile fallback / ',
      runUrl: FALLBACK_RUN_URL,
      profileJobResult: 'failure',
    });
    const created = api.state.created[0];
    expect(created.conclusion).toBe('failure');
    expect(created.title).toBe('Hosted fallback profile job failed');
    expect(created.summary).toContain('result "failure"');

    const succeeded = new FakeGitHub();
    await publishFallbackCheck({
      api: succeeded,
      result: outcome.result,
      checkNamePrefix: 'Hosted profile fallback / ',
      runUrl: FALLBACK_RUN_URL,
      profileJobResult: 'success',
    });
    expect(succeeded.state.created[0].conclusion).toBe('success');
  });
});
