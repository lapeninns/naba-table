import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ALLOWED_EXTENSIONS,
  assertAllowedRoot,
  harvestStagedArtefacts,
  stageArtefactsFromContainer,
} from '@/scripts/ci/evidence/collect';
import { evidenceObjectKey } from '@/scripts/ci/executor/r2/upload';

import {
  cleanupTempDirs,
  FakeRunner,
  makeTempDir,
  okResult,
  sha256Hex,
  when,
} from '../executor/helpers';

afterEach(cleanupTempDirs);

function stage(): { staging: string; evidence: string } {
  const root = makeTempDir();
  const staging = path.join(root, 'staging');
  const evidence = path.join(root, 'evidence');
  mkdirSync(path.join(staging, 'coverage', 'lcov-report'), { recursive: true });
  mkdirSync(path.join(staging, 'test-results', 'vitest'), { recursive: true });
  mkdirSync(path.join(staging, 'logs'), { recursive: true });
  writeFileSync(path.join(staging, 'coverage', 'coverage-summary.json'), '{"total":{}}');
  writeFileSync(path.join(staging, 'test-results', 'vitest', 'junit.xml'), '<testsuites/>');
  writeFileSync(path.join(staging, 'logs', 'lint.stdout.log'), 'ok\n');
  return { staging, evidence };
}

const roots = ['coverage', 'test-results', 'logs'];

describe('harvestStagedArtefacts', () => {
  it('records unsupported object names while retaining uploadable test evidence', () => {
    const { staging, evidence } = stage();
    writeFileSync(path.join(staging, 'test-results', '.last-run.json'), '{"status":"passed"}');
    writeFileSync(path.join(staging, 'test-results', 'a b.json'), '{}');
    const result = harvestStagedArtefacts({
      stagingDir: staging,
      evidenceDir: evidence,
      allowedRoots: roots,
    });
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        { path: 'test-results/.last-run.json', reason: 'object-key' },
        { path: 'test-results/a b.json', reason: 'object-key' },
      ]),
    );
    expect(result.files.some((file) => file.path === 'test-results/vitest/junit.xml')).toBe(true);
    for (const file of result.files) {
      expect(() =>
        evidenceObjectKey(
          {
            endpoint: 'https://example.com',
            bucket: 'evidence',
            keyPrefix: 'ci-evidence/ttl-14d',
            region: 'auto',
          },
          'ci-main-test-a1',
          file.path,
          new Date('2026-09-05T12:00:00Z'),
        ),
      ).not.toThrow();
    }
  });

  it('copies allowed files with deterministic digests and 0600 permissions', () => {
    const { staging, evidence } = stage();
    const first = harvestStagedArtefacts({
      stagingDir: staging,
      evidenceDir: evidence,
      allowedRoots: roots,
    });
    expect(first.rejected).toEqual([]);
    expect(first.files.map((file) => file.path)).toEqual([
      'coverage/coverage-summary.json',
      'logs/lint.stdout.log',
      'test-results/vitest/junit.xml',
    ]);
    expect(first.files[0].sha256).toBe(sha256Hex('{"total":{}}'));
    expect(first.files[0].kind).toBe('json');
    expect(first.totalBytes).toBe(first.files.reduce((sum, file) => sum + file.bytes, 0));
    expect(statSync(path.join(evidence, 'coverage', 'coverage-summary.json')).mode & 0o777).toBe(
      0o600,
    );

    const second = harvestStagedArtefacts({
      stagingDir: staging,
      evidenceDir: makeTempDir(),
      allowedRoots: roots,
    });
    expect(second.files).toEqual(first.files);
  });

  it('rejects symlinks (files and directories) without following them', () => {
    const { staging, evidence } = stage();
    const secret = path.join(makeTempDir(), 'secret.txt');
    writeFileSync(secret, 'host secret');
    symlinkSync(secret, path.join(staging, 'coverage', 'leak.txt'));
    symlinkSync(path.dirname(secret), path.join(staging, 'coverage', 'leakdir'));
    const result = harvestStagedArtefacts({
      stagingDir: staging,
      evidenceDir: evidence,
      allowedRoots: roots,
    });
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        { path: 'coverage/leak.txt', reason: 'symlink' },
        { path: 'coverage/leakdir', reason: 'symlink' },
      ]),
    );
    expect(result.files.some((file) => file.path.includes('leak'))).toBe(false);
  });

  it('rejects traversal in roots and ignores anything outside the allowed roots', () => {
    const { staging, evidence } = stage();
    mkdirSync(path.join(staging, 'node_modules'), { recursive: true });
    writeFileSync(path.join(staging, 'node_modules', 'x.json'), '{}');
    writeFileSync(path.join(staging, 'stray.log'), 'x');
    expect(() => assertAllowedRoot('../etc')).toThrow(/not a safe/u);
    expect(() => assertAllowedRoot('/etc')).toThrow(/not a safe/u);
    expect(() => assertAllowedRoot('coverage/../../x')).toThrow(/not a safe/u);
    expect(() =>
      harvestStagedArtefacts({
        stagingDir: staging,
        evidenceDir: evidence,
        allowedRoots: ['../outside'],
      }),
    ).toThrow(/not a safe/u);
    const result = harvestStagedArtefacts({
      stagingDir: staging,
      evidenceDir: evidence,
      allowedRoots: roots,
    });
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        { path: 'node_modules', reason: 'not-allowed-root' },
        { path: 'stray.log', reason: 'not-allowed-root' },
      ]),
    );
    expect(result.files.some((file) => file.path.startsWith('node_modules'))).toBe(false);
  });

  it('rejects disallowed extensions, executables and fake PNGs, and never executes anything', () => {
    const { staging, evidence } = stage();
    const script = path.join(staging, 'coverage', 'run.sh');
    writeFileSync(script, '#!/bin/sh\ntouch /tmp/executed\n');
    chmodSync(script, 0o755);
    writeFileSync(path.join(staging, 'coverage', 'module.js'), 'process.exit(1)');
    writeFileSync(path.join(staging, 'coverage', 'fake.png'), 'not a png');
    writeFileSync(
      path.join(staging, 'coverage', 'real.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
    );
    writeFileSync(path.join(staging, 'coverage', 'report.html'), '<script>alert(1)</script>');
    const result = harvestStagedArtefacts({
      stagingDir: staging,
      evidenceDir: evidence,
      allowedRoots: roots,
    });
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        { path: 'coverage/run.sh', reason: 'extension' },
        { path: 'coverage/module.js', reason: 'extension' },
        { path: 'coverage/fake.png', reason: 'extension' },
      ]),
    );
    const paths = result.files.map((file) => file.path);
    expect(paths).toContain('coverage/real.png');
    // HTML is kept only as inert text.
    expect(paths).toContain('coverage/report.html.txt');
    expect(paths).not.toContain('coverage/report.html');
    expect(readFileSync(path.join(evidence, 'coverage', 'report.html.txt'), 'utf8')).toBe(
      '<script>alert(1)</script>',
    );
    expect(statSync(path.join(evidence, 'coverage', 'real.png')).mode & 0o111).toBe(0);
    expect(ALLOWED_EXTENSIONS.has('.sh')).toBe(false);
    expect(ALLOWED_EXTENSIONS.has('.js')).toBe(false);
  });

  it('enforces per-file and total size caps', () => {
    const { staging, evidence } = stage();
    writeFileSync(path.join(staging, 'coverage', 'big.txt'), 'x'.repeat(2000));
    const result = harvestStagedArtefacts({
      stagingDir: staging,
      evidenceDir: evidence,
      allowedRoots: roots,
      policy: { perFileBytes: 1000, totalBytes: 20 },
    });
    expect(result.rejected).toEqual(
      expect.arrayContaining([{ path: 'coverage/big.txt', reason: 'per-file-size' }]),
    );
    expect(result.rejected.some((entry) => entry.reason === 'total-size')).toBe(true);
    expect(result.totalBytes).toBeLessThanOrEqual(20);
  });

  it('rejects special files', () => {
    const { staging, evidence } = stage();
    execFileSync('mkfifo', [path.join(staging, 'coverage', 'pipe.log')]);
    const result = harvestStagedArtefacts({
      stagingDir: staging,
      evidenceDir: evidence,
      allowedRoots: roots,
    });
    expect(result.rejected).toEqual(
      expect.arrayContaining([{ path: 'coverage/pipe.log', reason: 'special-file' }]),
    );
  });

  it('redacts secret-looking strings in text evidence and records it', () => {
    const { staging, evidence } = stage();
    writeFileSync(
      path.join(staging, 'logs', 'install.stderr.log'),
      'Authorization: Bearer abc.def.ghi\nGITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123\nuser guest@example.com\n',
    );
    const result = harvestStagedArtefacts({
      stagingDir: staging,
      evidenceDir: evidence,
      allowedRoots: roots,
    });
    const redacted = readFileSync(path.join(evidence, 'logs', 'install.stderr.log'), 'utf8');
    expect(redacted).not.toContain('abc.def.ghi');
    expect(redacted).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz0123');
    expect(redacted).not.toContain('guest@example.com');
    expect(redacted).toContain('[REDACTED]');
    expect(result.files.find((file) => file.path === 'logs/install.stderr.log')?.redacted).toBe(
      true,
    );
  });
});

describe('stageArtefactsFromContainer', () => {
  it('copies only allowed roots with docker cp on the CI context', async () => {
    const stagingDir = path.join(makeTempDir(), 'staging');
    const runner = new FakeRunner([
      when('docker', ['cp', 'ci-x-job:/workspace/test-results'], okResult({ exitCode: 1 })),
    ]);
    const staged = await stageArtefactsFromContainer(
      {
        docker: { context: 'nabatable-ci', protectedContexts: ['default'] },
        env: { PATH: '/usr/bin' },
        container: 'ci-x-job',
        allowedRoots: ['coverage', 'test-results'],
        stagingDir,
      },
      runner,
    );
    expect(staged).toEqual(['coverage']);
    expect(runner.calls.every((call) => call.env?.PATH === '/usr/bin')).toBe(true);
    expect(runner.rendered()).toEqual([
      `docker --context nabatable-ci cp ci-x-job:/workspace/coverage ${path.join(stagingDir, 'coverage')}`,
      `docker --context nabatable-ci cp ci-x-job:/workspace/test-results ${path.join(stagingDir, 'test-results')}`,
    ]);
    await expect(
      stageArtefactsFromContainer(
        {
          docker: { context: 'nabatable-ci', protectedContexts: [] },
          env: { PATH: '/usr/bin' },
          container: 'c',
          allowedRoots: ['../x'],
          stagingDir,
        },
        runner,
      ),
    ).rejects.toThrow(/not a safe/u);
  });
});
