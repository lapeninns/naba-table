import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { buildInfrastructureFailureResult, canonicalJson } from '../evidence/result';
import { ExecutorUnconfiguredError } from './config';
import { LimaImageDigestError } from './lima/instance';
import { ProfileResolutionError } from './profiles';
import { CiRequestError } from './request';
import { executeRequest, ExecutorFailure, ExecutorRefusalError, renderDryRunPlan } from './run';
import { SpawnCommandRunner } from './runner';
import { SpoolMergeConflictError, SpoolShaMismatchError } from './spool/bundle';
import type { StopSignal } from './types';

export const HELP = `Nabatable local CI executor

Usage: pnpm ci:executor (--request <json|@file> | --request-file <path>)
                        [--control-file <path>] [--result-file <path>]
                        [--dry-run] [--json] [--repo-root <dir>]

Runs exactly one CI request tuple in a disposable Lima VM:
  spool (credential-free git bundle) -> lima (cold clone, digest-verified)
  -> docker (hardened, non-root, no host mounts) -> supervisor (ordered suites,
  hard timeouts, controller stop signals) -> evidence (bounded, redacted,
  digested) -> r2 (SigV4 PUT+HEAD).

--request-file accepts the controller envelope { request, mode, allocation }.
--control-file is polled at suite boundaries for {"stop":"continue|preempt|cancel"};
  defaults to $NABATABLE_CI_CONTROL_FILE when the controller runs the executor.
--result-file receives the contract CiResult (also on infrastructure failure).
A bare --request tuple is wrapped with the admitted { mode, allocation } read from
$NABATABLE_CI_ALLOCATION_FILE when that file is present (controller side-channel).
--dry-run prints the full plan and executes nothing.
Exit codes: 0 passed, 1 profile did not pass, 2 unconfigured or infrastructure
failure, 3 invalid request, 4 refused (unmergeable PR, SHA/image/policy mismatch).
`;

export interface CliArgs {
  readonly request: unknown;
  readonly dryRun: boolean;
  readonly json: boolean;
  readonly repoRoot: string;
  readonly help: boolean;
  readonly controlFile: string | null;
  readonly resultFile: string | null;
}

/** Controller side-channel files (see scripts/ci/controller/runner.ts). */
export const CONTROL_FILE_ENV = 'NABATABLE_CI_CONTROL_FILE';
export const ALLOCATION_FILE_ENV = 'NABATABLE_CI_ALLOCATION_FILE';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads `{ mode, allocation }` written by the controller. Malformed content is
 * an error (the controller wrote it; a broken file must not silently widen the
 * allocation), a missing file means "no allocation".
 */
export function readAllocationFile(allocationFile: string): {
  readonly mode: unknown;
  readonly allocation: unknown;
} | null {
  if (!existsSync(allocationFile)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(allocationFile, 'utf8'));
  } catch {
    throw new CiRequestError(`${ALLOCATION_FILE_ENV} is not valid JSON`, ['invalid-allocation']);
  }
  if (!isRecord(parsed)) {
    throw new CiRequestError(`${ALLOCATION_FILE_ENV} must contain an object`, [
      'invalid-allocation',
    ]);
  }
  return { mode: parsed.mode ?? null, allocation: parsed.allocation ?? null };
}

export function parseArgs(
  argv: readonly string[],
  cwd: string,
  env: Readonly<Record<string, string | undefined>> = {},
): CliArgs {
  let rawRequest: string | undefined;
  let requestFile: string | undefined;
  let controlFile: string | null = null;
  let resultFile: string | null = null;
  let dryRun = false;
  let json = false;
  let help = false;
  let repoRoot = cwd;
  const takeValue = (index: number, flag: string): string => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new CiRequestError(`${flag} requires a value`, ['missing-value']);
    }
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--request') {
      rawRequest = takeValue(index, arg);
      index += 1;
    } else if (arg.startsWith('--request=')) {
      rawRequest = arg.slice('--request='.length);
    } else if (arg === '--request-file') {
      requestFile = path.resolve(cwd, takeValue(index, arg));
      index += 1;
    } else if (arg === '--control-file') {
      controlFile = path.resolve(cwd, takeValue(index, arg));
      index += 1;
    } else if (arg === '--result-file') {
      resultFile = path.resolve(cwd, takeValue(index, arg));
      index += 1;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--repo-root') {
      repoRoot = path.resolve(cwd, takeValue(index, arg));
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else {
      throw new CiRequestError(`unknown argument "${arg}"`, ['unknown-argument']);
    }
  }
  if (help) {
    return { request: undefined, dryRun, json, repoRoot, help, controlFile, resultFile };
  }
  if (rawRequest === undefined && requestFile === undefined) {
    throw new CiRequestError('--request or --request-file is required', ['missing-request']);
  }
  if (rawRequest !== undefined && requestFile !== undefined) {
    throw new CiRequestError('--request and --request-file are mutually exclusive', [
      'conflicting-request',
    ]);
  }
  let source: string;
  if (requestFile !== undefined) {
    source = readFileSync(requestFile, 'utf8');
  } else if (rawRequest !== undefined && rawRequest.startsWith('@')) {
    source = readFileSync(path.resolve(cwd, rawRequest.slice(1)), 'utf8');
  } else {
    source = rawRequest ?? '';
  }
  let request: unknown;
  try {
    request = JSON.parse(source);
  } catch {
    throw new CiRequestError('request must be valid JSON', ['invalid-json']);
  }
  if (controlFile === null && env[CONTROL_FILE_ENV]) {
    controlFile = path.resolve(cwd, env[CONTROL_FILE_ENV]);
  }
  const allocationPath = env[ALLOCATION_FILE_ENV];
  if (allocationPath && isRecord(request) && !('request' in request)) {
    const admitted = readAllocationFile(path.resolve(cwd, allocationPath));
    if (admitted !== null) {
      request = { request, mode: admitted.mode, allocation: admitted.allocation };
    }
  }
  return { request, dryRun, json, repoRoot, help, controlFile, resultFile };
}

/** Reads `{"stop": ...}` from the control file; anything unreadable means "continue". */
export function readStopSignal(controlFile: string | null): StopSignal {
  if (controlFile === null) return 'continue';
  try {
    const parsed: unknown = JSON.parse(readFileSync(controlFile, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null) {
      const stop = (parsed as Record<string, unknown>).stop;
      if (stop === 'preempt' || stop === 'cancel') return stop;
    }
  } catch {
    return 'continue';
  }
  return 'continue';
}

function writeResultFile(resultFile: string | null, document: unknown): void {
  if (resultFile === null) return;
  mkdirSync(path.dirname(resultFile), { recursive: true });
  writeFileSync(resultFile, `${canonicalJson(document)}\n`, { mode: 0o600 });
}

async function main(): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2), process.cwd(), process.env);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n\n${HELP}`);
    return 3;
  }
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!existsSync(path.join(args.repoRoot, 'package.json'))) {
    process.stderr.write(`repo root ${args.repoRoot} does not contain package.json\n`);
    return 2;
  }

  if (args.dryRun) {
    process.stdout.write(
      renderDryRunPlan({
        rawRequest: args.request,
        deps: { env: process.env, repoRoot: args.repoRoot },
      }),
    );
    return 0;
  }

  try {
    const run = await executeRequest(args.request, {
      runner: new SpawnCommandRunner(),
      fetch: (url, init) => fetch(url, init),
      env: process.env,
      repoRoot: args.repoRoot,
      log: (line) => process.stderr.write(`${line}\n`),
      stopSignal: () => readStopSignal(args.controlFile),
    });
    writeResultFile(args.resultFile, run.built.result);
    const { result, report } = run.built;
    if (args.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(
        `job ${run.jobId}: outcome=${report.outcome} (${result.supervisorOutcome}) tests=${result.testInventory.counts.discovered} ` +
          `failed=${result.testInventory.counts.failed} evidence=${report.evidence.files.length} uploaded=${run.uploaded.length} ` +
          `digest=${report.reportDigest}${report.reason ? ` reason=${report.reason}` : ''}\n`,
      );
    }
    if (run.destroy.failures.length > 0) {
      process.stderr.write(`cleanup failures: ${run.destroy.failures.join('; ')}\n`);
    }
    return result.supervisorOutcome === 'passed' ? 0 : 1;
  } catch (error) {
    if (error instanceof CiRequestError) {
      process.stderr.write(`invalid request: ${error.message}\n`);
      return 3;
    }
    if (error instanceof ExecutorRefusalError || error instanceof ProfileResolutionError) {
      process.stderr.write(`refused: ${error.message}\n`);
      return 4;
    }
    if (error instanceof ExecutorUnconfiguredError) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    if (error instanceof ExecutorFailure) {
      const cause = error.cause;
      const now = new Date();
      try {
        writeResultFile(
          args.resultFile,
          buildInfrastructureFailureResult({
            request: error.request,
            profile: error.profile,
            startedAt: error.startedAt,
            finishedAt: now,
            reason: error.message,
          }),
        );
      } catch (writeError) {
        process.stderr.write(`could not write failure result: ${(writeError as Error).message}\n`);
      }
      if (cause instanceof SpoolMergeConflictError || cause instanceof SpoolShaMismatchError) {
        process.stderr.write(`refused: ${cause.message}\n`);
        return 4;
      }
      if (cause instanceof LimaImageDigestError) {
        process.stderr.write(`refused: ${cause.message}\n`);
        return 4;
      }
      process.stderr.write(`executor failed: ${error.message}\n`);
      return 2;
    }
    process.stderr.write(`executor failed: ${(error as Error).message}\n`);
    return 2;
  }
}

if (process.env.NABATABLE_CI_EXECUTOR_NO_MAIN !== '1') {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`executor crashed: ${(error as Error).message}\n`);
      process.exitCode = 2;
    },
  );
}
