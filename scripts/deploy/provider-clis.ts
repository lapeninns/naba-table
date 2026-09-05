import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { isRecord } from './evidence';
import { parseFlags, spawnCommandRunner, type CommandRunner } from './exec';
import { PLACEHOLDER_PATTERN } from './validate-separation';

/**
 * Provider CLIs (vercel, supabase) are not npm dependencies of this workspace: the hosted
 * delivery workflow installs them at the exact versions pinned in provider-clis.json before
 * the deploy scripts run. Every script that spawns one of them calls `assertProviderCli`
 * first so a missing or drifted binary is refused with a clear message instead of an
 * ENOENT half-way through a delivery.
 */
export const PROVIDER_CLI_NAMES = ['vercel', 'supabase'] as const;
export type ProviderCli = (typeof PROVIDER_CLI_NAMES)[number];

export const PROVIDER_CLI_PINS_RELATIVE_PATH = 'scripts/deploy/provider-clis.json';
export const DEFAULT_PROVIDER_CLI_PINS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'provider-clis.json',
);

const EXACT_SEMVER = /^\d+\.\d+\.\d+$/u;
const SEMVER_TOKEN = /\b(\d+\.\d+\.\d+)\b/u;

export type ProviderCliPins = Readonly<Record<ProviderCli, string>>;

export class ProviderCliError extends Error {
  constructor(message: string) {
    super(`Refusing to continue: ${message}`);
    this.name = 'ProviderCliError';
  }
}

export function isProviderCli(value: string): value is ProviderCli {
  return (PROVIDER_CLI_NAMES as readonly string[]).includes(value);
}

export function parseProviderCliPins(raw: unknown): ProviderCliPins {
  if (!isRecord(raw)) {
    throw new ProviderCliError(`${PROVIDER_CLI_PINS_RELATIVE_PATH} must be a JSON object.`);
  }
  const pins: Partial<Record<ProviderCli, string>> = {};
  for (const name of PROVIDER_CLI_NAMES) {
    const entry = raw[name];
    const version = isRecord(entry) && typeof entry.version === 'string' ? entry.version : '';
    if (!version || PLACEHOLDER_PATTERN.test(version) || !EXACT_SEMVER.test(version)) {
      throw new ProviderCliError(
        `${PROVIDER_CLI_PINS_RELATIVE_PATH} must pin "${name}.version" to an exact semver version (got ${JSON.stringify(version)}).`,
      );
    }
    pins[name] = version;
  }
  return pins as ProviderCliPins;
}

export function loadProviderCliPins(
  pinsPath: string = DEFAULT_PROVIDER_CLI_PINS_PATH,
): ProviderCliPins {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(pinsPath, 'utf8')) as unknown;
  } catch (error) {
    throw new ProviderCliError(
      `${PROVIDER_CLI_PINS_RELATIVE_PATH} could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseProviderCliPins(raw);
}

export function parseCliVersion(output: string): string | null {
  return SEMVER_TOKEN.exec(output)?.[1] ?? null;
}

export type ProviderCliCheck = {
  readonly name: ProviderCli;
  readonly version: string;
};

/**
 * Runs `<cli> --version` and refuses unless the reported version equals the pin. A CLI that
 * is not on PATH surfaces as `CommandNotFoundError` from the runner.
 */
export function assertProviderCli(params: {
  readonly cli: ProviderCli;
  readonly runner?: CommandRunner;
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly pinsPath?: string;
}): ProviderCliCheck {
  const pins = loadProviderCliPins(params.pinsPath);
  const expected = pins[params.cli];
  const runner = params.runner ?? spawnCommandRunner;
  const result = runner(params.cli, ['--version'], { cwd: params.cwd, env: params.env });
  const output = `${result.stdout}\n${result.stderr}`;
  const reported = parseCliVersion(output);
  if (result.status !== 0 || !reported) {
    throw new ProviderCliError(
      `${params.cli} --version exited with status ${String(result.status)} without a version; install ${params.cli}@${expected} (see ${PROVIDER_CLI_PINS_RELATIVE_PATH}).`,
    );
  }
  if (reported !== expected) {
    throw new ProviderCliError(
      `${params.cli} ${reported} is installed but ${PROVIDER_CLI_PINS_RELATIVE_PATH} pins ${expected}; install the pinned version or change the pin in a reviewed change.`,
    );
  }
  return { name: params.cli, version: reported };
}

export function main(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): number {
  const { flags, positionals } = parseFlags(argv);
  const pins = loadProviderCliPins();
  const requested = positionals.length > 0 ? positionals : [...PROVIDER_CLI_NAMES];
  const names: ProviderCli[] = [];
  for (const name of requested) {
    if (!isProviderCli(name)) {
      throw new ProviderCliError(
        `unknown provider CLI "${name}"; expected one of ${PROVIDER_CLI_NAMES.join('|')}.`,
      );
    }
    names.push(name);
  }
  if (flags.has('print')) {
    for (const name of names) process.stdout.write(`${name}=${pins[name]}\n`);
    return 0;
  }
  for (const name of names) {
    const check = assertProviderCli({ cli: name, env });
    process.stdout.write(
      `${check.name} ${check.version} matches ${PROVIDER_CLI_PINS_RELATIVE_PATH}\n`,
    );
  }
  return 0;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'provider-clis.ts') {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
