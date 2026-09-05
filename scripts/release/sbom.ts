import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { writeJsonEvidence } from '../deploy/evidence';
import { flagBoolean, flagString, parseFlags } from '../deploy/exec';
import {
  parsePnpmLockfile,
  splitPackageKey,
  stripPeerSuffix,
  type ParsedLockfile,
} from './pnpm-lock-parser';

/**
 * CycloneDX 1.5 SBOM generated offline from pnpm-lock.yaml. Covers the root application,
 * every workspace importer and every locked package, with SHA-512 hashes from the lockfile
 * integrity fields. Output is deterministic for a given lockfile unless --timestamp is set.
 */
export type CycloneDxHash = {
  readonly alg: 'SHA-512' | 'SHA-256' | 'SHA-1';
  readonly content: string;
};

export type CycloneDxComponent = {
  readonly type: 'application' | 'library';
  readonly 'bom-ref': string;
  readonly name: string;
  readonly version: string;
  readonly purl?: string;
  readonly group?: string;
  readonly hashes?: readonly CycloneDxHash[];
  readonly properties?: readonly { readonly name: string; readonly value: string }[];
};

export type CycloneDxDependency = { readonly ref: string; readonly dependsOn: readonly string[] };

export type CycloneDxBom = {
  readonly bomFormat: 'CycloneDX';
  readonly specVersion: '1.5';
  readonly serialNumber: string;
  readonly version: number;
  readonly metadata: {
    readonly timestamp?: string;
    readonly tools: readonly {
      readonly vendor: string;
      readonly name: string;
      readonly version: string;
    }[];
    readonly component: CycloneDxComponent;
    readonly properties: readonly { readonly name: string; readonly value: string }[];
  };
  readonly components: readonly CycloneDxComponent[];
  readonly dependencies: readonly CycloneDxDependency[];
};

export type WorkspacePackage = {
  readonly path: string;
  readonly name: string;
  readonly version: string;
};

export type SbomInput = {
  readonly lockfile: string;
  readonly root: { readonly name: string; readonly version: string };
  readonly workspaces: readonly WorkspacePackage[];
  readonly timestamp?: string;
};

export function purlFor(name: string, version: string): string {
  const [scope, bare] = name.startsWith('@') ? name.slice(1).split('/', 2) : [null, name];
  const namePart = scope
    ? `%40${encodeURIComponent(scope)}/${encodeURIComponent(bare ?? '')}`
    : encodeURIComponent(name);
  return `pkg:npm/${namePart}@${encodeURIComponent(version)}`;
}

export function integrityToHash(integrity: string | null): CycloneDxHash[] {
  if (!integrity) return [];
  const [alg, base64] = integrity.split('-', 2);
  if (!alg || !base64) return [];
  const algorithm =
    alg === 'sha512' ? 'SHA-512' : alg === 'sha256' ? 'SHA-256' : alg === 'sha1' ? 'SHA-1' : null;
  if (!algorithm) return [];
  return [{ alg: algorithm, content: Buffer.from(base64, 'base64').toString('hex') }];
}

export function deterministicSerialNumber(lockfile: string): string {
  const hex = createHash('sha256').update(lockfile).digest('hex');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return `urn:uuid:${uuid}`;
}

function workspaceRef(workspacePath: string): string {
  return `workspace:${workspacePath}`;
}

function resolveDependencyRef(
  name: string,
  version: string,
  known: ReadonlySet<string>,
  workspaces: ReadonlyMap<string, string>,
): string | null {
  if (version.startsWith('link:')) {
    const target = path.posix.normalize(version.slice('link:'.length));
    const ref = workspaces.get(target);
    return ref ?? null;
  }
  const purl = purlFor(name, stripPeerSuffix(version));
  return known.has(purl) ? purl : null;
}

export function buildSbom(input: SbomInput): CycloneDxBom {
  const lock: ParsedLockfile = parsePnpmLockfile(input.lockfile);
  const rootRef = workspaceRef('.');
  const workspaceRefs = new Map<string, string>();
  workspaceRefs.set('.', rootRef);
  for (const workspace of input.workspaces)
    workspaceRefs.set(workspace.path, workspaceRef(workspace.path));

  const libraryComponents: CycloneDxComponent[] = lock.packages
    .map((entry) => {
      const purl = purlFor(entry.name, entry.version);
      const [group, bare] = entry.name.startsWith('@')
        ? entry.name.split('/', 2)
        : [undefined, entry.name];
      const hashes = integrityToHash(entry.integrity);
      return {
        type: 'library' as const,
        'bom-ref': purl,
        name: bare ?? entry.name,
        ...(group ? { group } : {}),
        version: entry.version,
        purl,
        ...(hashes.length > 0 ? { hashes } : {}),
      };
    })
    .sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref']));
  const known = new Set(libraryComponents.map((component) => component['bom-ref']));

  const workspaceComponents: CycloneDxComponent[] = input.workspaces
    .map((workspace) => ({
      type: 'application' as const,
      'bom-ref': workspaceRef(workspace.path),
      name: workspace.name,
      version: workspace.version,
      properties: [{ name: 'nabatable:workspace-path', value: workspace.path }],
    }))
    .sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref']));

  const dependencies: CycloneDxDependency[] = [];
  for (const importer of lock.importers) {
    const ref = workspaceRefs.get(importer.path);
    if (!ref) continue;
    const dependsOn = new Set<string>();
    for (const dep of [
      ...importer.dependencies,
      ...importer.devDependencies,
      ...importer.optionalDependencies,
    ]) {
      const resolved = resolveDependencyRef(dep.name, dep.version, known, workspaceRefs);
      if (resolved) dependsOn.add(resolved);
    }
    dependencies.push({ ref, dependsOn: [...dependsOn].sort() });
  }
  const snapshotDeps = new Map<string, Set<string>>();
  for (const snapshot of lock.snapshots) {
    const { name, version } = splitPackageKey(snapshot.packageKey);
    const purl = purlFor(name, version);
    if (!known.has(purl)) continue;
    const bucket = snapshotDeps.get(purl) ?? new Set<string>();
    for (const dep of [...snapshot.dependencies, ...snapshot.optionalDependencies]) {
      const resolved = resolveDependencyRef(dep.name, dep.version, known, workspaceRefs);
      if (resolved) bucket.add(resolved);
    }
    snapshotDeps.set(purl, bucket);
  }
  for (const [ref, dependsOn] of [...snapshotDeps.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    dependencies.push({ ref, dependsOn: [...dependsOn].sort() });
  }
  if (!dependencies.some((entry) => entry.ref === rootRef)) {
    dependencies.unshift({ ref: rootRef, dependsOn: [] });
  }

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: deterministicSerialNumber(input.lockfile),
    version: 1,
    metadata: {
      ...(input.timestamp ? { timestamp: input.timestamp } : {}),
      tools: [{ vendor: 'nabatable', name: 'release:sbom', version: '1' }],
      component: {
        type: 'application',
        'bom-ref': rootRef,
        name: input.root.name,
        version: input.root.version,
        properties: [{ name: 'nabatable:workspace-path', value: '.' }],
      },
      properties: [
        { name: 'nabatable:lockfile-version', value: lock.lockfileVersion },
        {
          name: 'nabatable:lockfile-sha256',
          value: createHash('sha256').update(input.lockfile).digest('hex'),
        },
      ],
    },
    components: [...workspaceComponents, ...libraryComponents],
    dependencies,
  };
}

function readPackageIdentity(dir: string): { name: string; version: string } {
  const parsed = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
    name?: unknown;
    version?: unknown;
  };
  return {
    name: typeof parsed.name === 'string' ? parsed.name : path.basename(dir),
    version: typeof parsed.version === 'string' ? parsed.version : '0.0.0',
  };
}

export function discoverWorkspaces(rootDir: string, lockfile: string): WorkspacePackage[] {
  const lock = parsePnpmLockfile(lockfile);
  return lock.importers
    .filter((importer) => importer.path !== '.')
    .filter((importer) => existsSync(path.join(rootDir, importer.path, 'package.json')))
    .map((importer) => ({
      path: importer.path,
      ...readPackageIdentity(path.join(rootDir, importer.path)),
    }));
}

export function main(argv: readonly string[]): number {
  const { flags } = parseFlags(argv);
  const rootDir = flagString(flags, 'root') ?? process.cwd();
  const lockfile = readFileSync(path.join(rootDir, 'pnpm-lock.yaml'), 'utf8');
  const bom = buildSbom({
    lockfile,
    root: readPackageIdentity(rootDir),
    workspaces: discoverWorkspaces(rootDir, lockfile),
    ...(flagBoolean(flags, 'timestamp') ? { timestamp: new Date().toISOString() } : {}),
  });
  const outPath =
    flagString(flags, 'out') ?? path.join(rootDir, 'test-results', 'release', 'sbom.cdx.json');
  writeJsonEvidence(outPath, bom);
  process.stdout.write(`sbom: ${bom.components.length} components -> ${outPath}\n`);
  return 0;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'sbom.ts') {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
