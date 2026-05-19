#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getQaArtifactDirs } from './artifacts';
import { sanitizeQaArtifactTree, type QaArtifactSanitizeSummary } from './artifact-sanitizer';
import { assertQaEnvironment } from './environment';
import { redactQaArtifact, redactQaText } from './redaction';

export type RcQaPhase =
  | 'a11y-visual'
  | 'artifact-safety'
  | 'build'
  | 'p0p1-api-security'
  | 'p0p1-browser'
  | 'performance'
  | 'privacy'
  | 'static'
  | 'worker';

export type RcQaFailureClass = 'baseline-debt' | 'missing-setup' | 'product-failure';
export type RcQaCommandStatus = 'failed' | 'passed' | 'skipped';

export type RcQaCommand = {
  command: string;
  id: string;
  phase: RcQaPhase;
  reason: string;
};

export type RcQaCommandResult = {
  command: string;
  failureClass: RcQaFailureClass | null;
  id: string;
  phase: RcQaPhase;
  reason: string;
  status: RcQaCommandStatus;
  statusCode: number | null;
  stderrPreview?: string;
  stdoutPreview?: string;
};

export type RcQaQuarantine = {
  id: string;
  path: string;
  reason: string;
};

export type RcQaSummary = {
  artifacts: {
    cleanupRegistryPath: string;
    runDir: string;
    sanitizer: Pick<
      QaArtifactSanitizeSummary,
      'redacted' | 'removed' | 'scanned' | 'skipped' | 'unchanged'
    >;
    summaryPath: string;
  };
  commands: RcQaCommandResult[];
  generatedAt: string;
  knownGaps: string[];
  qaRunId: string;
  quarantinedTests: RcQaQuarantine[];
  safeEnvironment: {
    targetClass: string;
    targetUrls: readonly string[];
  };
};

type RcQaOptions = {
  dryRun: boolean;
  listOnly: boolean;
  phases: Set<RcQaPhase>;
};

const OUTPUT_PREVIEW_CHARS = 4000;

export const RC_QA_COMMANDS: RcQaCommand[] = [
  {
    id: 'build',
    phase: 'build',
    command: 'pnpm run build',
    reason: 'Next app production build.',
  },
  {
    id: 'reserve_build',
    phase: 'build',
    command: 'pnpm run reserve:build',
    reason: 'Separate Vite reserve app production build.',
  },
  {
    id: 'lint',
    phase: 'static',
    command: 'pnpm run lint',
    reason: 'Repo lint and strict shadcn primitive gate.',
  },
  {
    id: 'typecheck',
    phase: 'static',
    command: 'pnpm run typecheck',
    reason: 'TypeScript project typecheck.',
  },
  {
    id: 'secret_scan',
    phase: 'static',
    command: 'pnpm run secret:scan',
    reason: 'Repository secret scanning.',
  },
  {
    id: 'tag_audit',
    phase: 'static',
    command: 'pnpm run guard:qa-tags',
    reason: 'QA test tag convention baseline ratchet.',
  },
  {
    id: 'p0p1_api_security',
    phase: 'p0p1-api-security',
    command: 'pnpm run qa:rc:p0p1-api',
    reason: 'P0/P1 API, tenant/security, and service-role coverage.',
  },
  {
    id: 'p0p1_browser',
    phase: 'p0p1-browser',
    command: 'pnpm run qa:rc:p0p1-browser',
    reason: 'P0 browser route/flow coverage.',
  },
  {
    id: 'worker_smoke',
    phase: 'worker',
    command: 'pnpm run qa:rc:workers',
    reason: 'Webhook, cron, queue, and worker smoke coverage.',
  },
  {
    id: 'a11y_visual',
    phase: 'a11y-visual',
    command: 'pnpm run qa:rc:a11y-visual',
    reason: 'UI guard inventory, axe, keyboard, and visual screenshots.',
  },
  {
    id: 'observability_privacy',
    phase: 'privacy',
    command: 'pnpm run qa:observability-privacy',
    reason: 'Observability, logging, analytics, and artifact privacy coverage.',
  },
  {
    id: 'performance',
    phase: 'performance',
    command: 'pnpm run qa:performance',
    reason: 'Selectable deterministic performance/load smoke.',
  },
  {
    id: 'artifact_safety',
    phase: 'artifact-safety',
    command: 'pnpm run qa:rc:artifact-safety',
    reason: 'QA_RUN_ID, artifact redaction, and cleanup registry coverage.',
  },
];

export const RC_QUARANTINED_TESTS: RcQaQuarantine[] = [];

export const RC_KNOWN_GAPS = [
  'Existing Luma semantic-token migration debt is pinned in config/qa/luma-baseline.json; strict guard fails on above-baseline exception drift.',
  'Existing untagged test-title debt is pinned in config/qa/tag-baseline.json; guard:qa-tags fails on unknown tags or increased untagged drift.',
  'Production and production-like Nabatable URLs are refused by the QA environment guard.',
];

function parseArgs(argv: readonly string[]): RcQaOptions {
  const phases = new Set<RcQaPhase>();
  let dryRun = false;
  let listOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--list') {
      listOnly = true;
      continue;
    }
    if (arg === '--phase') {
      const value = argv[index + 1] as RcQaPhase | undefined;
      if (!value || !RC_QA_COMMANDS.some((command) => command.phase === value)) {
        throw new Error(`Unknown qa:rc phase "${value ?? ''}".`);
      }
      phases.add(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown qa:rc option "${arg}".`);
  }

  return { dryRun, listOnly, phases };
}

function safeRcEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    QA_ALLOW_DESTRUCTIVE: process.env.QA_ALLOW_DESTRUCTIVE || 'local',
    QA_DRY_RUN: process.env.QA_DRY_RUN || '1',
    QA_EXTERNAL_MUTATION_MODE: process.env.QA_EXTERNAL_MUTATION_MODE || 'dry-run',
    QA_TARGET_ENV: process.env.QA_TARGET_ENV || 'local',
    QA_USE_MOCKS: process.env.QA_USE_MOCKS || '1',
  };
}

export function selectRcQaCommands(phases = new Set<RcQaPhase>()): RcQaCommand[] {
  if (phases.size === 0) return RC_QA_COMMANDS;
  return RC_QA_COMMANDS.filter((command) => phases.has(command.phase));
}

export function classifyRcQaFailure(output: string): RcQaFailureClass {
  if (
    /command not found|Cannot find module|ERR_MODULE_NOT_FOUND|ENOENT|gitleaks|trufflehog|Missing .*env|Environment validation failed|corepack|pnpm: not found/i.test(
      output,
    )
  ) {
    return 'missing-setup';
  }

  if (
    /Failed strict mode: \d+ remaining non-color shadcn migration finding|Luma compliance findings remain|Luma baseline ratchet exceeded|advisory migration finding/i.test(
      output,
    )
  ) {
    return 'baseline-debt';
  }

  return 'product-failure';
}

function preview(value: string): string | undefined {
  if (!value.trim()) return undefined;
  return redactQaText(value.slice(-OUTPUT_PREVIEW_CHARS));
}

function runCommand(command: RcQaCommand, env: NodeJS.ProcessEnv): RcQaCommandResult {
  console.log(`\n[qa:rc] ${command.id} (${command.phase})`);
  console.log(`[qa:rc] ${command.command}`);

  const result = spawnSync(command.command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  const statusCode = result.status ?? 1;
  if (statusCode === 0) {
    return {
      ...command,
      failureClass: null,
      status: 'passed',
      statusCode,
      stderrPreview: preview(stderr),
      stdoutPreview: preview(stdout),
    };
  }

  const failureClass = classifyRcQaFailure(`${stdout}\n${stderr}`);
  console.error(`[qa:rc] ${command.id} failed with status ${statusCode}; ${failureClass}.`);
  return {
    ...command,
    failureClass,
    status: 'failed',
    statusCode,
    stderrPreview: preview(stderr),
    stdoutPreview: preview(stdout),
  };
}

function skippedCommand(command: RcQaCommand): RcQaCommandResult {
  return {
    ...command,
    failureClass: null,
    status: 'skipped',
    statusCode: null,
  };
}

function readCleanupRegistry(pathname: string): unknown {
  if (!fs.existsSync(pathname)) return { records: [] };
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

export function assertNoPendingCleanupRecords(pathname: string): void {
  const registry = readCleanupRegistry(pathname) as {
    records?: Array<{ id?: unknown; status?: unknown; type?: unknown }>;
  };
  const pending = (registry.records ?? []).filter((record) => record.status === 'pending');
  if (pending.length > 0) {
    throw new Error(`RC cleanup verification found ${pending.length} pending QA record(s).`);
  }
}

function writeSummary(summary: RcQaSummary): void {
  fs.mkdirSync(path.dirname(summary.artifacts.summaryPath), { recursive: true });
  fs.writeFileSync(
    summary.artifacts.summaryPath,
    `${JSON.stringify(redactQaArtifact(summary), null, 2)}\n`,
    'utf8',
  );
}

function printList(commands: readonly RcQaCommand[]): void {
  console.log('[qa:rc] selected commands:');
  for (const command of commands) {
    console.log(`  - ${command.id} (${command.phase}): ${command.command}`);
    console.log(`    ${command.reason}`);
  }
  console.log(`[qa:rc] quarantined tests: ${RC_QUARANTINED_TESTS.length}`);
  for (const test of RC_QUARANTINED_TESTS) {
    console.log(`  - ${test.id}: ${test.path}`);
    console.log(`    ${test.reason}`);
  }
}

export function runRcQa(argv: readonly string[] = process.argv.slice(2)): number {
  const options = parseArgs(argv);
  const env = safeRcEnv();
  const guard = assertQaEnvironment({
    destructive: true,
    env,
    externalMutation: true,
  });
  const artifactDirs = getQaArtifactDirs({ env });
  const summaryPath = path.join(artifactDirs.runDir, 'rc-summary.json');
  const commands = selectRcQaCommands(options.phases);

  printList(commands);
  if (options.listOnly) return 0;

  fs.mkdirSync(artifactDirs.runDir, { recursive: true });

  const results = options.dryRun
    ? commands.map(skippedCommand)
    : commands.map((command) => runCommand(command, env));
  const sanitizer = sanitizeQaArtifactTree(artifactDirs.runDir);

  let cleanupFailure: RcQaCommandResult | null = null;
  if (!options.dryRun) {
    try {
      assertNoPendingCleanupRecords(artifactDirs.cleanupRegistryPath);
    } catch (error) {
      cleanupFailure = {
        command: `cleanup registry read ${artifactDirs.cleanupRegistryPath}`,
        failureClass: 'product-failure',
        id: 'cleanup_registry_janitor',
        phase: 'artifact-safety',
        reason: 'Created QA records must be cleaned up or reported by QA_RUN_ID.',
        status: 'failed',
        statusCode: 1,
        stderrPreview: error instanceof Error ? error.message : String(error),
      };
      results.push(cleanupFailure);
    }
  }

  const summary: RcQaSummary = {
    artifacts: {
      cleanupRegistryPath: artifactDirs.cleanupRegistryPath,
      runDir: artifactDirs.runDir,
      sanitizer: {
        redacted: sanitizer.redacted,
        removed: sanitizer.removed,
        scanned: sanitizer.scanned,
        skipped: sanitizer.skipped,
        unchanged: sanitizer.unchanged,
      },
      summaryPath,
    },
    commands: results,
    generatedAt: new Date().toISOString(),
    knownGaps: RC_KNOWN_GAPS,
    qaRunId: artifactDirs.runId,
    quarantinedTests: RC_QUARANTINED_TESTS,
    safeEnvironment: {
      targetClass: guard.targetClass,
      targetUrls: guard.targetUrls,
    },
  };

  writeSummary(summary);
  console.log(`[qa:rc] summary: ${summaryPath}`);

  const failures = results.filter((result) => result.status === 'failed');
  if (failures.length === 0) {
    console.log('[qa:rc] release candidate checks passed.');
    return 0;
  }

  console.error('[qa:rc] failed checks:');
  for (const failure of failures) {
    console.error(`  - ${failure.id}: ${failure.failureClass} (${failure.command})`);
  }
  return 1;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runRcQa();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
