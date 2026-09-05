import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildReleaseManifest,
  hashMigrationsTree,
  hashOutputs,
  main,
  readPnpmVersion,
  resolveSourceSha,
} from '@/scripts/release/manifest';

const SHA = 'c'.repeat(40);

function scaffold(dir: string): void {
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      version: '1.2.3',
      packageManager: 'pnpm@10.34.5',
      devDependencies: { next: '^16.3.4' },
    }),
  );
  writeFileSync(
    path.join(dir, 'pnpm-lock.yaml'),
    "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies: {}\n",
  );
  mkdirSync(path.join(dir, 'supabase', 'migrations'), { recursive: true });
  writeFileSync(
    path.join(dir, 'supabase', 'migrations', '20260101000000_init.sql'),
    'create table t (id int);\n',
  );
  writeFileSync(
    path.join(dir, 'supabase', 'migrations', '20260102000000_next.sql'),
    'alter table t add c text;\n',
  );
  mkdirSync(path.join(dir, '.next'), { recursive: true });
  writeFileSync(path.join(dir, '.next', 'BUILD_ID'), 'build-abc\n');
  mkdirSync(path.join(dir, 'dist', 'nested'), { recursive: true });
  writeFileSync(path.join(dir, 'dist', 'index.js'), 'console.log(1);\n');
  writeFileSync(path.join(dir, 'dist', 'nested', 'chunk.js'), 'export {};\n');
}

describe('release:manifest', () => {
  const tempDirs: string[] = [];
  const tempDir = () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'release-manifest-'));
    tempDirs.push(dir);
    scaffold(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const build = (
    rootDir: string,
    overrides: Partial<Parameters<typeof buildReleaseManifest>[0]> = {},
  ) =>
    buildReleaseManifest({
      rootDir,
      sourceSha: SHA,
      policyVersion: '2026.09',
      outputs: ['.next/BUILD_ID', 'dist'],
      nodeVersion: '22.0.0',
      providerVersions: { next: '16.3.4' },
      ...overrides,
    });

  it('is deterministic for identical inputs and content-addressed @release @contract', () => {
    const dir = tempDir();
    const first = build(dir);
    const second = build(dir);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.kind).toBe('release-manifest');
    expect(first.sourceSha).toBe(SHA);
    expect(first.lockfileSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.migrationsCount).toBe(2);
    expect(first.buildManifest.map((entry) => entry.path)).toEqual([
      '.next/BUILD_ID',
      'dist/index.js',
      'dist/nested/chunk.js',
    ]);
    expect(first.missingOutputs).toEqual([]);
    expect(first.pnpmVersion).toBe('10.34.5');
    expect(first.nodeVersion).toBe('22.0.0');
    expect(first.activeRuntime).toBe('node22');
    expect(first.candidateRuntime).toBe('node24');
    expect(first.runtimeQualificationNote).toMatch(/Node 24/u);
    expect(JSON.stringify(first)).not.toMatch(/\d{4}-\d{2}-\d{2}T/u);
  });

  it('changes when an output, a migration or the lockfile changes @release', () => {
    const dir = tempDir();
    const baseline = build(dir);
    writeFileSync(path.join(dir, 'dist', 'index.js'), 'console.log(2);\n');
    const afterOutput = build(dir);
    expect(afterOutput.buildManifest[1]?.sha256).not.toBe(baseline.buildManifest[1]?.sha256);
    expect(afterOutput.migrationsTreeSha256).toBe(baseline.migrationsTreeSha256);

    writeFileSync(
      path.join(dir, 'supabase', 'migrations', '20260103000000_more.sql'),
      'select 1;\n',
    );
    const afterMigration = build(dir);
    expect(afterMigration.migrationsTreeSha256).not.toBe(baseline.migrationsTreeSha256);
    expect(afterMigration.migrationsCount).toBe(3);

    writeFileSync(path.join(dir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\nimporters: {}\n");
    expect(build(dir).lockfileSha256).not.toBe(baseline.lockfileSha256);
  });

  it('reports missing outputs and rejects malformed inputs @release', () => {
    const dir = tempDir();
    const manifest = build(dir, { outputs: ['.next/BUILD_ID', 'cloudflare/nope/dist'] });
    expect(manifest.missingOutputs).toEqual(['cloudflare/nope/dist']);
    expect(() => build(dir, { sourceSha: 'HEAD' })).toThrow(/40-hex/u);
    expect(() => build(dir, { policyVersion: ' ' })).toThrow(/policyVersion/u);
    expect(hashOutputs(dir, []).buildManifest).toEqual([]);
    expect(hashMigrationsTree(path.join(dir, 'nowhere'))).toEqual({
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/u) as unknown as string,
      count: 0,
    });
    expect(readPnpmVersion(dir)).toBe('10.34.5');
  });

  it('resolves the source SHA from an injected git runner only when not given @release', () => {
    expect(resolveSourceSha('/x', SHA, () => ({ status: 1, stdout: '', stderr: '' }))).toBe(SHA);
    expect(
      resolveSourceSha('/x', undefined, () => ({ status: 0, stdout: `${SHA}\n`, stderr: '' })),
    ).toBe(SHA);
    expect(() =>
      resolveSourceSha('/x', undefined, () => ({ status: 128, stdout: '', stderr: '' })),
    ).toThrow(/--source-sha/u);
  });

  it('main writes test-results/release/manifest.json and fails on missing outputs unless allowed @release', () => {
    const dir = tempDir();
    const out = path.join(dir, 'out', 'manifest.json');
    const okCode = main(
      [
        '--root',
        dir,
        '--source-sha',
        SHA,
        '--policy-version',
        '2026.09',
        '--outputs',
        '.next/BUILD_ID,dist',
        '--out',
        out,
      ],
      {},
    );
    expect(okCode).toBe(0);
    const written = JSON.parse(readFileSync(out, 'utf8')) as {
      buildManifest: unknown[];
      policyVersion: string;
    };
    expect(written.buildManifest).toHaveLength(3);
    expect(written.policyVersion).toBe('2026.09');

    const missingCode = main(
      [
        '--root',
        dir,
        '--source-sha',
        SHA,
        '--policy-version',
        '2026.09',
        '--outputs',
        'dist,missing/dir',
        '--out',
        out,
      ],
      {},
    );
    expect(missingCode).toBe(1);
    const allowedCode = main(
      [
        '--root',
        dir,
        '--source-sha',
        SHA,
        '--outputs',
        'dist,missing/dir',
        '--out',
        out,
        '--allow-missing-outputs',
      ],
      { NABATABLE_CI_POLICY_VERSION: '2026.09' },
    );
    expect(allowedCode).toBe(0);
    expect(() => main(['--root', dir, '--source-sha', SHA, '--out', out], {})).toThrow(
      /policyVersion/u,
    );
  });
});
