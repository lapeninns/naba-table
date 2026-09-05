import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { writeJsonEvidence } from '../deploy/evidence';
import {
  flagBoolean,
  flagString,
  parseFlags,
  spawnCommandRunner,
  type CommandRunner,
} from '../deploy/exec';

/**
 * Immutable compiled-revision metadata. Everything is content-addressed (no timestamps),
 * so two runs over the same tree, lockfile, migrations and build outputs produce
 * byte-identical manifests. Missing outputs are reported and fail the run unless
 * --allow-missing-outputs is set, because a manifest without its artifacts is not evidence.
 */
export const ACTIVE_RUNTIME = 'node22';
export const CANDIDATE_RUNTIME = 'node24';
export const RUNTIME_QUALIFICATION_NOTE =
  'Hosted workflows run Node 22; production Vercel runs Node 24. Node 24 becomes active once the CI profiles are qualified on it.';

export const DEFAULT_OUTPUTS: readonly string[] = [
  '.next/BUILD_ID',
  '.next/build-manifest.json',
  'cloudflare/booking-short-links/dist',
  'cloudflare/email-queue-gateway/dist',
  'cloudflare/sms-summary-gateway/dist',
  'cloudflare/operational-control/dist',
];

export const PROVIDER_PACKAGES: readonly string[] = [
  'next',
  'wrangler',
  'vercel',
  'supabase',
  '@playwright/test',
  'typescript',
];

export type BuildOutput = {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
};

export type ReleaseManifest = {
  readonly kind: 'release-manifest';
  readonly schemaVersion: 1;
  readonly sourceSha: string;
  readonly lockfileSha256: string;
  readonly migrationsTreeSha256: string;
  readonly migrationsCount: number;
  readonly buildManifest: readonly BuildOutput[];
  readonly missingOutputs: readonly string[];
  readonly providerVersions: Readonly<Record<string, string>>;
  readonly nodeVersion: string;
  readonly pnpmVersion: string;
  readonly policyVersion: string;
  readonly activeRuntime: typeof ACTIVE_RUNTIME;
  readonly candidateRuntime: typeof CANDIDATE_RUNTIME;
  readonly runtimeQualificationNote: string;
};

export function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function listFilesRecursively(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursively(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function toPosix(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

export function hashOutputs(
  rootDir: string,
  outputs: readonly string[],
): { buildManifest: BuildOutput[]; missingOutputs: string[] } {
  const buildManifest: BuildOutput[] = [];
  const missingOutputs: string[] = [];
  for (const output of outputs) {
    const absolute = path.resolve(rootDir, output);
    if (!existsSync(absolute)) {
      missingOutputs.push(output);
      continue;
    }
    const files = statSync(absolute).isDirectory() ? listFilesRecursively(absolute) : [absolute];
    for (const file of files) {
      buildManifest.push({
        path: toPosix(rootDir, file),
        sha256: sha256File(file),
        bytes: statSync(file).size,
      });
    }
  }
  buildManifest.sort((a, b) => a.path.localeCompare(b.path));
  return { buildManifest, missingOutputs: missingOutputs.sort() };
}

export function hashMigrationsTree(rootDir: string): { sha256: string; count: number } {
  const dir = path.join(rootDir, 'supabase', 'migrations');
  const files = existsSync(dir)
    ? listFilesRecursively(dir)
        .map((file) => toPosix(rootDir, file))
        .sort()
    : [];
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update('\0');
    hash.update(sha256File(path.join(rootDir, file)));
    hash.update('\n');
  }
  return { sha256: hash.digest('hex'), count: files.length };
}

export function readProviderVersions(
  rootDir: string,
  packages: readonly string[] = PROVIDER_PACKAGES,
): Record<string, string> {
  const rootPackage = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const versions: Record<string, string> = {};
  for (const name of [...packages].sort()) {
    const installed = path.join(rootDir, 'node_modules', name, 'package.json');
    if (existsSync(installed)) {
      const parsed = JSON.parse(readFileSync(installed, 'utf8')) as { version?: unknown };
      versions[name] = typeof parsed.version === 'string' ? parsed.version : 'unknown';
      continue;
    }
    const declared = rootPackage.devDependencies?.[name] ?? rootPackage.dependencies?.[name];
    versions[name] = declared ? `declared:${declared}` : 'unavailable';
  }
  return versions;
}

export function readPnpmVersion(rootDir: string): string {
  const parsed = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
    packageManager?: unknown;
  };
  const manager = typeof parsed.packageManager === 'string' ? parsed.packageManager : '';
  const match = /^pnpm@(\S+)$/u.exec(manager);
  return match?.[1] ?? 'unknown';
}

export type ManifestInput = {
  readonly rootDir: string;
  readonly sourceSha: string;
  readonly policyVersion: string;
  readonly outputs?: readonly string[];
  readonly nodeVersion?: string;
  readonly pnpmVersion?: string;
  readonly providerVersions?: Readonly<Record<string, string>>;
};

export function buildReleaseManifest(input: ManifestInput): ReleaseManifest {
  if (!/^[0-9a-f]{40}$/u.test(input.sourceSha))
    throw new Error('sourceSha must be a 40-hex git SHA.');
  if (!input.policyVersion.trim())
    throw new Error(
      'policyVersion is required (use --policy-version or NABATABLE_CI_POLICY_VERSION).',
    );
  const outputs = input.outputs ?? DEFAULT_OUTPUTS;
  const { buildManifest, missingOutputs } = hashOutputs(input.rootDir, outputs);
  const migrations = hashMigrationsTree(input.rootDir);
  return {
    kind: 'release-manifest',
    schemaVersion: 1,
    sourceSha: input.sourceSha,
    lockfileSha256: sha256File(path.join(input.rootDir, 'pnpm-lock.yaml')),
    migrationsTreeSha256: migrations.sha256,
    migrationsCount: migrations.count,
    buildManifest,
    missingOutputs,
    providerVersions: input.providerVersions ?? readProviderVersions(input.rootDir),
    nodeVersion: input.nodeVersion ?? process.versions.node,
    pnpmVersion: input.pnpmVersion ?? readPnpmVersion(input.rootDir),
    policyVersion: input.policyVersion,
    activeRuntime: ACTIVE_RUNTIME,
    candidateRuntime: CANDIDATE_RUNTIME,
    runtimeQualificationNote: RUNTIME_QUALIFICATION_NOTE,
  };
}

export function resolveSourceSha(
  rootDir: string,
  explicit: string | undefined,
  runner: CommandRunner = spawnCommandRunner,
): string {
  if (explicit) return explicit;
  const result = runner('git', ['rev-parse', 'HEAD'], { cwd: rootDir });
  if (result.status !== 0) throw new Error('Unable to resolve HEAD; pass --source-sha explicitly.');
  return result.stdout.trim();
}

export function main(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): number {
  const { flags } = parseFlags(argv);
  const rootDir = flagString(flags, 'root') ?? process.cwd();
  const outputsFlag = flagString(flags, 'outputs');
  const manifest = buildReleaseManifest({
    rootDir,
    sourceSha: resolveSourceSha(
      rootDir,
      flagString(flags, 'source-sha') ?? env.NABATABLE_SOURCE_REVISION,
    ),
    policyVersion: flagString(flags, 'policy-version') ?? env.NABATABLE_CI_POLICY_VERSION ?? '',
    outputs: outputsFlag
      ? outputsFlag
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : undefined,
  });
  const outPath =
    flagString(flags, 'out') ?? path.join(rootDir, 'test-results', 'release', 'manifest.json');
  writeJsonEvidence(outPath, manifest);
  process.stdout.write(
    `release manifest: ${manifest.buildManifest.length} outputs, ${manifest.migrationsCount} migrations -> ${outPath}\n`,
  );
  if (manifest.missingOutputs.length > 0 && !flagBoolean(flags, 'allow-missing-outputs')) {
    process.stderr.write(
      `missing build outputs: ${manifest.missingOutputs.join(', ')} (pass --allow-missing-outputs to accept)\n`,
    );
    return 1;
  }
  return 0;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'manifest.ts') {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
