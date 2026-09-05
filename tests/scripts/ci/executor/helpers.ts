import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { POLICY_VERSION } from '@/scripts/ci/profiles/catalog';

import type { CommandResult, CommandRunner, CommandSpec } from '@/scripts/ci/executor/runner';
import type { CiRequest } from '@/scripts/ci/executor/types';

export const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const SHA_HEAD = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
export const SHA_BASE = 'b2c3d4e5f60718293a4b5c6d7e8f9012345678a1';
export const SHA_TESTED = 'c3d4e5f60718293a4b5c6d7e8f9012345678a1b2';
export const IMAGE_DIGEST = `sha256:${'1'.repeat(64)}`;
export const BASE_IMAGE_CONTENT = 'nabatable-ci-base-image-fixture';
export const BASE_IMAGE_DIGEST = `sha256:${createHash('sha256').update(BASE_IMAGE_CONTENT).digest('hex')}`;
export const REPOSITORY_ID = 424242;

export function prRequest(overrides: Partial<Record<keyof CiRequest, unknown>> = {}): CiRequest {
  return {
    repositoryId: REPOSITORY_ID,
    profile: 'pr',
    prNumber: 17,
    headSha: SHA_HEAD,
    baseSha: SHA_BASE,
    testedSha: SHA_TESTED,
    policyVersion: POLICY_VERSION,
    imageDigest: IMAGE_DIGEST,
    controllerVersion: '1.0.0',
    attempt: 1,
    ...overrides,
  } as CiRequest;
}

export function mainRequest(overrides: Partial<Record<keyof CiRequest, unknown>> = {}): CiRequest {
  return {
    repositoryId: REPOSITORY_ID,
    profile: 'main',
    headSha: SHA_HEAD,
    baseSha: SHA_BASE,
    testedSha: SHA_HEAD,
    policyVersion: POLICY_VERSION,
    imageDigest: IMAGE_DIGEST,
    controllerVersion: '1.0.0',
    attempt: 1,
    ...overrides,
  } as CiRequest;
}

export function okResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    exitCode: 0,
    signal: null,
    stdout: '',
    stderr: '',
    timedOut: false,
    durationMs: 1,
    stdoutTruncated: false,
    stderrTruncated: false,
    ...overrides,
  };
}

export type RuleHandler = (spec: CommandSpec) => CommandResult | Promise<CommandResult>;

/** Mirrors the real runner: captured output is also delivered through the stream callbacks. */
function emit(spec: CommandSpec, result: CommandResult): CommandResult {
  if (result.stdout) spec.onStdout?.(Buffer.from(result.stdout));
  if (result.stderr) spec.onStderr?.(Buffer.from(result.stderr));
  return result;
}

export interface RunnerRule {
  readonly match: (spec: CommandSpec) => boolean;
  readonly respond: RuleHandler;
  /** When true the rule is consumed after its first match. */
  readonly once?: boolean;
}

/** True when `spec.args` contains every token (in order, not necessarily adjacent). */
export function argsContain(spec: CommandSpec, ...tokens: readonly string[]): boolean {
  let index = 0;
  for (const token of tokens) {
    const found = spec.args.indexOf(token, index);
    if (found === -1) return false;
    index = found + 1;
  }
  return true;
}

export function when(
  command: string,
  tokens: readonly string[],
  respond: RuleHandler | CommandResult,
  once = false,
): RunnerRule {
  return {
    match: (spec) => spec.command === command && argsContain(spec, ...tokens),
    respond: typeof respond === 'function' ? respond : () => respond,
    once,
  };
}

/**
 * Scripted command runner. Rules are consulted in order; the first match wins.
 * Unmatched commands succeed with empty output unless `strict` is set, in which
 * case they fail so a test never passes on an unscripted interaction.
 */
export class FakeRunner implements CommandRunner {
  readonly calls: CommandSpec[] = [];
  private readonly rules: RunnerRule[];

  constructor(
    rules: readonly RunnerRule[] = [],
    private readonly strict = false,
  ) {
    this.rules = [...rules];
  }

  addRule(rule: RunnerRule): void {
    this.rules.unshift(rule);
  }

  async run(spec: CommandSpec): Promise<CommandResult> {
    this.calls.push(spec);
    for (let index = 0; index < this.rules.length; index += 1) {
      const rule = this.rules[index];
      if (rule.match(spec)) {
        if (rule.once) this.rules.splice(index, 1);
        return emit(spec, await rule.respond(spec));
      }
    }
    if (this.strict) {
      return okResult({
        exitCode: 1,
        stderr: `unscripted command: ${spec.command} ${spec.args.join(' ')}`,
      });
    }
    return okResult();
  }

  rendered(): string[] {
    return this.calls.map((call) => `${call.command} ${call.args.join(' ')}`);
  }

  find(command: string, ...tokens: readonly string[]): CommandSpec[] {
    return this.calls.filter((call) => call.command === command && argsContain(call, ...tokens));
  }
}

const temporaryDirectories: string[] = [];

export function makeTempDir(prefix = 'nabatable-ci-executor-'): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(dir);
  return dir;
}

export function cleanupTempDirs(): void {
  for (const dir of temporaryDirectories.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface ExecutorEnvFixture {
  readonly env: Record<string, string>;
  readonly root: string;
  readonly spoolRoot: string;
  readonly jobRoot: string;
  readonly baseImagePath: string;
}

/** Fully configured executor environment pointing at a fresh temp directory. */
export function configuredEnv(overrides: Record<string, string> = {}): ExecutorEnvFixture {
  const root = makeTempDir();
  const spoolRoot = path.join(root, 'spool');
  const jobRoot = path.join(root, 'jobs');
  const baseImagePath = path.join(root, 'base.img');
  mkdirSync(spoolRoot, { recursive: true });
  mkdirSync(jobRoot, { recursive: true });
  writeFileSync(baseImagePath, BASE_IMAGE_CONTENT);
  const env: Record<string, string> = {
    PATH: '/usr/bin:/bin',
    HOME: path.join(root, 'home'),
    LIMA_HOME: path.join('/tmp', path.basename(root), 'home', '.lima'),
    NABATABLE_CI_REPOSITORY_ID: String(REPOSITORY_ID),
    NABATABLE_CI_SOURCE_REMOTE_URL: 'https://github.com/example/nabatable.git',
    NABATABLE_CI_SPOOL_ROOT: spoolRoot,
    NABATABLE_CI_JOB_ROOT: jobRoot,
    NABATABLE_CI_BASE_IMAGE_PATH: baseImagePath,
    NABATABLE_CI_BASE_IMAGE_DIGEST: BASE_IMAGE_DIGEST,
    NABATABLE_CI_JOB_IMAGE: `nabatable/ci-job@${IMAGE_DIGEST}`,
    NABATABLE_CI_R2_ENDPOINT: 'https://example-account.r2.cloudflarestorage.com',
    NABATABLE_CI_R2_BUCKET: 'nabatable-ci-evidence',
    NABATABLE_CI_R2_ACCESS_KEY_ID: 'AKIDEXAMPLE0000000000',
    NABATABLE_CI_R2_SECRET_ACCESS_KEY: 'secret-example-value-0000000000',
    ...overrides,
  };
  return { env, root, spoolRoot, jobRoot, baseImagePath };
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export const JUNIT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="vitest tests" tests="4" failures="0" errors="0" time="1.2">
  <testsuite name="tests/example.test.ts" tests="4" failures="0" errors="0" skipped="1">
    <testcase classname="tests/example.test.ts" name="adds numbers" time="0.01"/>
    <testcase classname="tests/example.test.ts" name="handles &lt;tags&gt;" time="0.01"></testcase>
    <testcase classname="tests/example.test.ts" name="skips" time="0"><skipped/></testcase>
    <testcase classname="tests/example.test.ts" name="still passes" time="0.01"/>
  </testsuite>
</testsuites>
`;

export const FAILING_JUNIT_XML = `<testsuites>
  <testsuite name="tests/fail.test.ts">
    <testcase classname="tests/fail.test.ts" name="breaks"><failure message="boom">stack</failure></testcase>
    <testcase classname="tests/fail.test.ts" name="errors"><error message="bad">stack</error></testcase>
  </testsuite>
</testsuites>`;

export const COVERAGE_SUMMARY = JSON.stringify({
  total: {
    lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
    statements: { total: 100, covered: 81, skipped: 0, pct: 81 },
    functions: { total: 50, covered: 40, skipped: 0, pct: 80 },
    branches: { total: 40, covered: 24, skipped: 0, pct: 60 },
  },
});
