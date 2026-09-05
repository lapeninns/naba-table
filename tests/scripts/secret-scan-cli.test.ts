import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const scannerPath = path.resolve('scripts/security/secret-scan.ts');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const reviewedBlob = 'reviewed synthetic fixture bytes';
const reportedFinding = {
  RuleID: 'test-rule',
  File: 'fixture.ts',
  StartLine: 1,
  EndLine: 1,
  Commit: 'a'.repeat(40),
  Secret: 'REDACTED',
  Match: 'REDACTED',
};

function runWithScanners(
  exitCode: number,
  options: {
    report?: string;
    missingReport?: boolean;
    reviewed?: boolean;
    blob?: string;
    trufflehogExit?: number;
  } = {},
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'secret-scan-cli-'));
  temporaryDirectories.push(directory);
  const bin = path.join(directory, 'bin');
  mkdirSync(bin);
  mkdirSync(path.join(directory, 'config', 'ci'), { recursive: true });
  writeFileSync(
    path.join(directory, 'config', 'ci', 'gitleaks-baseline.json'),
    JSON.stringify({
      schemaVersion: 1,
      baselineReview: options.reviewed
        ? [
            {
              ruleId: reportedFinding.RuleID,
              file: reportedFinding.File,
              startLine: 1,
              endLine: 1,
              sourceSha256: createHash('sha256').update(reviewedBlob).digest('hex'),
              sourceCommit: 'b'.repeat(40),
              reviewedAt: '2026-09-05',
              reason: 'Reviewed synthetic fixture.',
            },
          ]
        : [],
    }),
  );
  writeFileSync(
    path.join(directory, 'fixture-report.json'),
    options.report ?? JSON.stringify(exitCode === 0 ? [] : [reportedFinding]),
  );
  writeFileSync(path.join(directory, 'fixture-blob'), options.blob ?? reviewedBlob);
  // Model a hosted runner login profile that resets PATH to system directories.
  writeFileSync(
    path.join(bin, 'sh'),
    '#!/bin/sh\nif [ "$1" = "-lc" ]; then PATH=/usr/bin:/bin; export PATH; fi\nexec /bin/sh "$@"\n',
  );
  chmodSync(path.join(bin, 'sh'), 0o755);
  const sensitiveOutput = 'scanner-sensitive-output-must-stay-private';
  for (const name of ['gitleaks', 'trufflehog']) {
    const file = path.join(bin, name);
    const reportCommand =
      name === 'gitleaks' && !options.missingReport
        ? 'while [ "$#" -gt 0 ]; do if [ "$1" = "--report-path" ]; then shift; /bin/cp fixture-report.json "$1"; break; fi; shift; done\n'
        : '';
    const status = name === 'trufflehog' ? (options.trufflehogExit ?? exitCode) : exitCode;
    writeFileSync(
      file,
      `#!/bin/sh\n${reportCommand}echo '${sensitiveOutput}'\necho '${sensitiveOutput}' >&2\nexit ${status}\n`,
    );
    chmodSync(file, 0o755);
  }
  // The scan only needs a file inventory, so no repository or external tools are contacted.
  writeFileSync(
    path.join(bin, 'git'),
    '#!/bin/sh\nif [ "$1" = "show" ]; then /bin/cat fixture-blob; fi\nexit 0\n',
  );
  chmodSync(path.join(bin, 'git'), 0o755);
  const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), scannerPath], {
    cwd: directory,
    env: {
      PATH: `${bin}${path.delimiter}/usr/bin${path.delimiter}/bin`,
      HOME: directory,
      SECRET_SCAN_ALLOW_BUILT_IN_ONLY: 'false',
    },
    encoding: 'utf8',
    timeout: 15_000,
  });
  return { ...result, sensitiveOutput, output: `${result.stdout}${result.stderr}` };
}

describe('secret scanner CLI integration', () => {
  it('discovers scanners from the job PATH without a login shell resetting it', () => {
    const result = runWithScanners(0);
    expect(result.error).toBeUndefined();
    expect(result.status, result.output).toBe(0);
    expect(result.output).not.toContain('missing required external scanner');
  });

  it('allows a reviewed finding only when the scanned Git blob matches', () => {
    const result = runWithScanners(1, { reviewed: true, trufflehogExit: 0 });
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('1 content-bound reviewed finding');
    expect(result.output).not.toContain(result.sensitiveOutput);
  });

  it('fails when a previously reviewed file contains replacement bytes', () => {
    const result = runWithScanners(1, {
      reviewed: true,
      blob: 'replacement bytes',
      trufflehogExit: 0,
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('1 unreviewed finding');
  });

  it.each([
    { exit: 1, options: { report: '[]' } },
    { exit: 0, options: { report: '{}' } },
    { exit: 0, options: { report: 'private malformed report' } },
    { exit: 0, options: { missingReport: true } },
    { exit: 2, options: { report: '[]' } },
  ])('fails closed for scanner errors or invalid reports: %j', ({ exit, options }) => {
    const result = runWithScanners(exit, options);
    expect(result.status).toBe(1);
    expect(result.output).toContain('gitleaks scan or baseline validation failed');
    expect(result.output).not.toContain('private malformed report');
    expect(result.output).not.toContain(result.sensitiveOutput);
  });

  it('fails closed on scanner findings without printing their raw credential output', () => {
    const result = runWithScanners(1);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('2 external scanner(s) reported findings');
    expect(result.output).not.toContain(result.sensitiveOutput);
  });
});
