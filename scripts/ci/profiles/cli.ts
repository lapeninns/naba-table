import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROFILE_NAMES } from '../contracts/primitives';
import { resolveProfile, type ResolvedProfile } from './conditional';
import { getProfile, isProfileName } from './registry';

export const USAGE = `usage: pnpm ci:profile <${PROFILE_NAMES.join('|')}> [--json] [--changed-paths <file>]

Prints the resolved CI profile. --changed-paths takes a newline-separated list
of repository-relative paths; without it every conditional suite runs.`;

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_INPUT = 2;

export interface CliIo {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
  readonly readFile: (filePath: string) => string;
}

interface ParsedArgs {
  readonly profile: string;
  readonly json: boolean;
  readonly changedPathsFile: string | null;
}

function parseArgs(argv: readonly string[]): ParsedArgs | { readonly error: string } {
  let profile: string | null = null;
  let json = false;
  let changedPathsFile: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    if (arg === '--json') {
      json = true;
    } else if (arg === '--changed-paths') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        return { error: '--changed-paths requires a file path' };
      }
      changedPathsFile = value;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      return { error: '' };
    } else if (arg.startsWith('-')) {
      return { error: `unknown option ${arg}` };
    } else if (profile === null) {
      profile = arg;
    } else {
      return { error: `unexpected argument ${arg}` };
    }
  }
  if (profile === null) {
    return { error: 'missing profile name' };
  }
  return { profile, json, changedPathsFile };
}

export function parseChangedPaths(content: string): string[] {
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function formatText(resolved: ResolvedProfile): string[] {
  const { limits, image, runtime } = resolved;
  const lines = [
    `Profile: ${resolved.name} (policy ${resolved.policyVersion}, schema v${resolved.version})`,
    `Runtime: ${runtime.activeRuntime} active, ${runtime.candidateRuntime} candidate, pnpm ${runtime.pnpm}`,
    `Image: ${image.configured ? 'configured' : 'UNCONFIGURED'} (ubuntu ${image.ubuntuDigest}, job ${image.jobImageDigest}, playwright ${image.playwrightVersion})`,
    `Limits: ${limits.cpu} vCPU, ${limits.memoryGiB} GiB memory, ${limits.pids} pids, ${limits.diskGiB} GiB disk, ${limits.timeoutMinutes} min, vitest workers ${limits.vitestWorkers}, playwright workers ${limits.playwrightWorkers}`,
    `Changed paths: ${resolved.changedPathsProvided ? 'provided' : 'not provided (conditional suites run; fail closed)'}`,
    'Suites:',
  ];
  for (const suiteResolution of resolved.suites) {
    lines.push(
      `  [${suiteResolution.included ? 'run ' : 'skip'}] ${suiteResolution.suiteId} — ${suiteResolution.displayName} (${suiteResolution.reason})`,
    );
  }
  lines.push(`Commands (${resolved.commands.length}):`);
  resolved.commands.forEach((command, index) => {
    const overlay = command.env
      ? ` env ${Object.entries(command.env)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')}`
      : '';
    lines.push(
      `  ${index + 1}. [${command.suiteId}] ${command.run} (${command.timeoutMinutes}m${overlay})`,
    );
  });
  return lines;
}

export function runProfileCli(argv: readonly string[], io: CliIo): number {
  const parsed = parseArgs(argv);
  if ('error' in parsed) {
    if (parsed.error) {
      io.stderr(`error: ${parsed.error}`);
    }
    io.stderr(USAGE);
    return EXIT_USAGE;
  }
  if (!isProfileName(parsed.profile)) {
    io.stderr(
      `error: unknown profile "${parsed.profile}"; expected one of ${PROFILE_NAMES.join(', ')}`,
    );
    return EXIT_USAGE;
  }
  let changedPaths: string[] | null = null;
  if (parsed.changedPathsFile !== null) {
    try {
      changedPaths = parseChangedPaths(io.readFile(parsed.changedPathsFile));
    } catch (error) {
      io.stderr(
        `error: cannot read changed paths file ${parsed.changedPathsFile}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return EXIT_INPUT;
    }
  }
  const resolved = resolveProfile(getProfile(parsed.profile), changedPaths);
  if (parsed.json) {
    io.stdout(JSON.stringify(resolved, null, 2));
  } else {
    for (const line of formatText(resolved)) {
      io.stdout(line);
    }
  }
  return EXIT_OK;
}

const isDirectRun =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  process.exitCode = runProfileCli(process.argv.slice(2), {
    stdout: (line) => console.log(line),
    stderr: (line) => console.error(line),
    readFile: (filePath) => readFileSync(path.resolve(process.cwd(), filePath), 'utf8'),
  });
}
