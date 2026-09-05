import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  parsePnpmLockfile,
  parseYamlSubset,
  splitPackageKey,
} from '@/scripts/release/pnpm-lock-parser';
import {
  buildSbom,
  deterministicSerialNumber,
  discoverWorkspaces,
  integrityToHash,
  purlFor,
} from '@/scripts/release/sbom';

const ROOT = process.cwd();

const FIXTURE_LOCKFILE = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      next:
        specifier: ^16.3.4
        version: 16.3.4(react@19.2.0)
      '@nabatable/shared':
        specifier: workspace:*
        version: link:packages/shared
    devDependencies:
      typescript:
        specifier: ^5.9.3
        version: 5.9.3

  cloudflare/sms-summary-gateway:
    devDependencies:
      wrangler:
        specifier: 4.111.0
        version: 4.111.0

  packages/shared: {}

packages:

  '@types/node@22.0.0':
    resolution: {integrity: sha512-AAAA}

  next@16.3.4:
    resolution: {integrity: sha512-c2hhNTEyLWZha2UtaGFzaA==}
    engines: {node: '>=20.9.0'}
    peerDependencies:
      react: ^19.0.0

  react@19.2.0:
    resolution: {integrity: sha512-cmVhY3QtZmFrZQ==}

  typescript@5.9.3:
    resolution: {integrity: sha512-dHNjLWZha2U=}
    hasBin: true

  wrangler@4.111.0:
    resolution: {integrity: sha512-d3JhbmdsZXItZmFrZQ==}
    hasBin: true

snapshots:

  '@types/node@22.0.0': {}

  next@16.3.4(react@19.2.0):
    dependencies:
      react: 19.2.0

  react@19.2.0: {}

  typescript@5.9.3: {}

  wrangler@4.111.0:
    optionalDependencies:
      '@types/node': 22.0.0
`;

describe('release:sbom', () => {
  it('parses the pnpm-lock YAML subset including flow mappings and quoted keys @release @contract', () => {
    const doc = parseYamlSubset(FIXTURE_LOCKFILE);
    expect(doc.lockfileVersion).toBe('9.0');
    const packages = doc.packages as Record<string, Record<string, unknown>>;
    expect(packages['next@16.3.4']?.resolution).toEqual({
      integrity: 'sha512-c2hhNTEyLWZha2UtaGFzaA==',
    });
    expect(packages['next@16.3.4']?.engines).toEqual({ node: '>=20.9.0' });
    const lock = parsePnpmLockfile(FIXTURE_LOCKFILE);
    expect(lock.importers.map((importer) => importer.path)).toEqual([
      '.',
      'cloudflare/sms-summary-gateway',
      'packages/shared',
    ]);
    expect(lock.packages.map((entry) => entry.key)).toHaveLength(5);
    expect(splitPackageKey('@types/node@22.0.0')).toEqual({
      name: '@types/node',
      version: '22.0.0',
    });
    expect(splitPackageKey('next@16.3.4(react@19.2.0)')).toEqual({
      name: 'next',
      version: '16.3.4',
    });
    expect(() => parsePnpmLockfile("lockfileVersion: '6.0'\n")).toThrow(/lockfileVersion/u);
  });

  it('produces a valid CycloneDX 1.5 document covering root, workspaces and libraries @release @contract', () => {
    const bom = buildSbom({
      lockfile: FIXTURE_LOCKFILE,
      root: { name: 'nabatable', version: '1.0.0' },
      workspaces: [
        {
          path: 'cloudflare/sms-summary-gateway',
          name: '@nabatable/sms-summary-gateway',
          version: '0.1.0',
        },
        { path: 'packages/shared', name: '@nabatable/shared', version: '0.0.1' },
      ],
    });
    expect(bom.bomFormat).toBe('CycloneDX');
    expect(bom.specVersion).toBe('1.5');
    expect(bom.version).toBe(1);
    expect(bom.serialNumber).toMatch(
      /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(bom.metadata.timestamp).toBeUndefined();
    expect(bom.metadata.component).toMatchObject({
      type: 'application',
      'bom-ref': 'workspace:.',
      name: 'nabatable',
    });

    const refs = bom.components.map((component) => component['bom-ref']);
    expect(refs).toContain('workspace:cloudflare/sms-summary-gateway');
    expect(refs).toContain('workspace:packages/shared');
    expect(refs).toContain('pkg:npm/next@16.3.4');
    expect(refs).toContain('pkg:npm/%40types/node@22.0.0');
    expect(new Set(refs).size).toBe(refs.length);

    const next = bom.components.find((component) => component['bom-ref'] === 'pkg:npm/next@16.3.4');
    expect(next).toMatchObject({
      type: 'library',
      name: 'next',
      version: '16.3.4',
      purl: 'pkg:npm/next@16.3.4',
    });
    expect(next?.hashes).toEqual([
      {
        alg: 'SHA-512',
        content: Buffer.from('c2hhNTEyLWZha2UtaGFzaA==', 'base64').toString('hex'),
      },
    ]);
    const typesNode = bom.components.find(
      (component) => component['bom-ref'] === 'pkg:npm/%40types/node@22.0.0',
    );
    expect(typesNode).toMatchObject({ group: '@types', name: 'node' });

    const rootDeps = bom.dependencies.find((entry) => entry.ref === 'workspace:.');
    expect(rootDeps?.dependsOn).toEqual([
      'pkg:npm/next@16.3.4',
      'pkg:npm/typescript@5.9.3',
      'workspace:packages/shared',
    ]);
    const workerDeps = bom.dependencies.find(
      (entry) => entry.ref === 'workspace:cloudflare/sms-summary-gateway',
    );
    expect(workerDeps?.dependsOn).toEqual(['pkg:npm/wrangler@4.111.0']);
    expect(
      bom.dependencies.find((entry) => entry.ref === 'pkg:npm/next@16.3.4')?.dependsOn,
    ).toEqual(['pkg:npm/react@19.2.0']);
    expect(
      bom.dependencies.find((entry) => entry.ref === 'pkg:npm/wrangler@4.111.0')?.dependsOn,
    ).toEqual(['pkg:npm/%40types/node@22.0.0']);
    for (const entry of bom.dependencies) {
      for (const dependency of entry.dependsOn) expect(refs).toContain(dependency);
    }
  });

  it('is deterministic without --timestamp and includes the timestamp only when asked @release', () => {
    const input = { lockfile: FIXTURE_LOCKFILE, root: { name: 'n', version: '1' }, workspaces: [] };
    expect(JSON.stringify(buildSbom(input))).toBe(JSON.stringify(buildSbom(input)));
    expect(deterministicSerialNumber('a')).toBe(deterministicSerialNumber('a'));
    expect(deterministicSerialNumber('a')).not.toBe(deterministicSerialNumber('b'));
    expect(buildSbom({ ...input, timestamp: '2026-09-05T00:00:00.000Z' }).metadata.timestamp).toBe(
      '2026-09-05T00:00:00.000Z',
    );
    expect(purlFor('@scope/name', '1.0.0')).toBe('pkg:npm/%40scope/name@1.0.0');
    expect(integrityToHash('md5-abc')).toEqual([]);
    expect(integrityToHash(null)).toEqual([]);
  });

  it('covers the repository lockfile and every Cloudflare workspace without network @release', () => {
    const lockfile = readFileSync(path.join(ROOT, 'pnpm-lock.yaml'), 'utf8');
    const lock = parsePnpmLockfile(lockfile);
    expect(lock.packages.length).toBeGreaterThan(200);
    const workspaces = discoverWorkspaces(ROOT, lockfile);
    const names = workspaces.map((workspace) => workspace.name);
    expect(names).toEqual(
      expect.arrayContaining([
        '@nabatable/booking-short-links',
        '@nabatable/email-queue-gateway',
        '@nabatable/sms-summary-gateway',
      ]),
    );
    const bom = buildSbom({ lockfile, root: { name: 'nabatable', version: '0.0.0' }, workspaces });
    const refs = new Set(bom.components.map((component) => component['bom-ref']));
    for (const workspace of workspaces) expect(refs.has(`workspace:${workspace.path}`)).toBe(true);
    expect([...refs].some((ref) => ref.startsWith('pkg:npm/wrangler@'))).toBe(true);
    expect([...refs].some((ref) => ref.startsWith('pkg:npm/next@'))).toBe(true);
    for (const entry of bom.dependencies) {
      for (const dependency of entry.dependsOn) expect(refs.has(dependency)).toBe(true);
    }
  });
});
