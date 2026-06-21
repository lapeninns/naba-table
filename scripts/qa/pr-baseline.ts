#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatQaCommand,
  selectPrBaselineCommands,
  type QaCommand,
  type QaFailureClass,
} from './changed-path-selector';

type CliOptions = {
  baseRef?: string;
  changedFiles: string[];
  headRef: string;
  listOnly: boolean;
};

type CommandResult = {
  command: QaCommand;
  failureClass: QaFailureClass | null;
  status: number;
};

function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    changedFiles: [],
    headRef: 'HEAD',
    listOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--list') {
      options.listOnly = true;
      continue;
    }
    if (arg === '--base-ref') {
      options.baseRef = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--head-ref') {
      options.headRef = argv[index + 1] ?? 'HEAD';
      index += 1;
      continue;
    }
    if (arg === '--changed-file') {
      const value = argv[index + 1];
      if (value) options.changedFiles.push(value);
      index += 1;
      continue;
    }
    if (arg === '--changed-files') {
      const value = argv[index + 1];
      if (value) {
        options.changedFiles.push(
          ...value
            .split(',')
            .map((file) => file.trim())
            .filter(Boolean),
        );
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown qa:pr-baseline option "${arg}".`);
  }

  return options;
}

function runGit(args: readonly string[]): string {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  }

  return result.stdout.trim();
}

function defaultBaseRef(): string {
  const githubBaseRef = process.env.GITHUB_BASE_REF?.trim();
  if (githubBaseRef) return `origin/${githubBaseRef}`;

  try {
    runGit(['rev-parse', '--verify', 'origin/main']);
    return 'origin/main';
  } catch {
    return 'HEAD~1';
  }
}

function resolveChangedFiles(options: CliOptions): string[] {
  if (options.changedFiles.length > 0) return options.changedFiles;

  const baseRef = options.baseRef ?? defaultBaseRef();
  const diffRange = `${baseRef}...${options.headRef}`;
  const output = runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', diffRange]);
  return output ? output.split('\n').filter(Boolean) : [];
}

export function classifyQaCommandFailure(command: QaCommand, output: string): QaFailureClass {
  if (
    /Environment validation failed|Environment safety checks failed|Missing .*env|ENOENT|command not found|Cannot find module|ERR_MODULE_NOT_FOUND|corepack|pnpm: not found/i.test(
      output,
    )
  ) {
    return 'missing-setup';
  }

  if (
    /Failed strict mode: \d+ remaining non-color shadcn migration finding|Luma compliance findings remain/i.test(
      output,
    )
  ) {
    return 'baseline-debt';
  }

  return command.defaultFailureClass;
}

function runQaCommand(command: QaCommand): CommandResult {
  console.log(`\n[qa:pr-baseline] ${command.id} (${command.phase})`);
  console.log(`[qa:pr-baseline] ${formatQaCommand(command)}`);

  const result = spawnSync('pnpm', command.args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  const status = result.status ?? 1;
  if (status === 0) {
    return { command, failureClass: null, status };
  }

  const output = `${stdout}\n${stderr}`;
  const failureClass = classifyQaCommandFailure(command, output);
  console.error(
    `[qa:pr-baseline] ${command.id} failed with status ${status}; classified as ${failureClass}.`,
  );
  return { command, failureClass, status };
}

export function runPrBaseline(argv: readonly string[] = process.argv.slice(2)): number {
  const options = parseArgs(argv);
  const changedFiles = resolveChangedFiles(options);
  const selection = selectPrBaselineCommands(changedFiles);

  console.log(`[qa:pr-baseline] changed files: ${selection.changedFiles.length}`);
  for (const file of selection.changedFiles) {
    console.log(`  - ${file}`);
  }

  console.log(`[qa:pr-baseline] selected checks: ${selection.commands.length}`);
  for (const command of selection.commands) {
    console.log(`  - ${command.id}: ${formatQaCommand(command)}`);
    console.log(`    ${command.reason}`);
  }

  for (const note of selection.notes) {
    console.warn(`[qa:pr-baseline] ${note.kind}: ${note.message}`);
    for (const file of note.files) {
      console.warn(`  - ${file}`);
    }
  }

  if (options.listOnly) {
    return 0;
  }

  const results = selection.commands.map(runQaCommand);
  const failures = results.filter((result) => result.status !== 0);
  if (failures.length === 0) {
    console.log('[qa:pr-baseline] all selected checks passed.');
    return 0;
  }

  console.error('\n[qa:pr-baseline] failed checks:');
  for (const failure of failures) {
    console.error(
      `  - ${failure.command.id}: ${formatQaCommand(failure.command)} (${failure.failureClass})`,
    );
  }

  return 1;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runPrBaseline();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
