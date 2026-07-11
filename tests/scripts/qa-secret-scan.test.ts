import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  allowsBuiltInOnlySecretScan,
  redactSecretSnippet,
  scanSecretText,
  type SecretFinding,
} from '@/scripts/qa/secret-scan';

/**
 * Behavioral pins for the deterministic built-in scanner in scripts/qa/secret-scan.ts —
 * the repo-local fallback path (SECRET_SCAN_ALLOW_BUILT_IN_ONLY), not gitleaks/trufflehog,
 * so this suite stays offline and deterministic.
 *
 * Fake secrets are assembled from fragments so this file never contains a contiguous
 * secret-shaped literal that the repo's own scan (or external scanners in CI) would flag.
 */

const FAKE_AWS_ACCESS_KEY = ['AK', 'IA', 'ABCDEFGH', 'IJKLMNOP'].join('');
const FAKE_OPENAI_KEY = ['sk', '-'].join('') + 'Zx9Qw8Er7Ty6Ui5Op4As3Df2Gh1J';
const FAKE_GITHUB_TOKEN = ['gh', 'p_'].join('') + 'A1b2C3d4'.repeat(5);
const FAKE_PRIVATE_KEY_HEADER = ['-----', 'BEGIN ', 'PRI', 'VATE KEY', '-----'].join('');
const FAKE_SERVICE_ROLE_ASSIGNMENT =
  ['SUPABASE', '_SERVICE', '_ROLE', '_KEY'].join('') +
  '=' +
  ['eyJ' + 'a'.repeat(16), 'eyJ' + 'b'.repeat(16), 'c'.repeat(16)].join('.');
const PLACEHOLDER_OPENAI_KEY = ['sk', '-'].join('') + 'mock-' + 'a'.repeat(24);

let fixtureRoot: string;

function writeFixtureFile(relativePath: string, content: string): void {
  const filePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function listFilesRecursively(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function scanFixtureDirectory(): SecretFinding[] {
  return listFilesRecursively(fixtureRoot)
    .sort()
    .flatMap((file) =>
      scanSecretText(fs.readFileSync(file, 'utf8'), path.relative(fixtureRoot, file)),
    );
}

beforeEach(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-secret-scan-'));
});

afterEach(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe('scanSecretText', () => {
  it('detects a planted AWS access key in a temp directory tree @contract @security @local-only', () => {
    writeFixtureFile(
      path.join('src', 'config.ts'),
      [
        "export const region = 'eu-west-2';",
        '',
        `const uploadKey = '${FAKE_AWS_ACCESS_KEY}';`,
      ].join('\n'),
    );

    const findings = scanFixtureDirectory();

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: path.join('src', 'config.ts'),
      line: 3,
      rule: 'aws-access-key',
    });
  });

  it('passes a clean directory tree @contract @security @local-only', () => {
    writeFixtureFile(
      path.join('lib', 'env.ts'),
      [
        'export const url = process.env.NEXT_PUBLIC_SUPABASE_URL;',
        "export const short = 'sk-short';",
        "export const host = 'http://localhost:54321';",
      ].join('\n'),
    );
    writeFixtureFile(path.join('docs', 'readme.md'), 'Rotate credentials via the ops runbook.');

    expect(scanFixtureDirectory()).toEqual([]);
  });

  it('detects multiple secret rules with line numbers @contract @security @local-only', () => {
    const source = [
      '# fixture credentials dump',
      FAKE_PRIVATE_KEY_HEADER,
      FAKE_SERVICE_ROLE_ASSIGNMENT,
      `token: ${FAKE_GITHUB_TOKEN}`,
      `key: ${FAKE_OPENAI_KEY}`,
    ].join('\n');

    const findings = scanSecretText(source, 'fixture.env');

    expect(findings).toHaveLength(4);
    expect(findings.map((finding) => [finding.rule, finding.line])).toEqual(
      expect.arrayContaining([
        ['private-key', 2],
        ['supabase-service-role-jwt', 3],
        ['github-token', 4],
        ['openai-api-key', 5],
      ]),
    );
  });

  it('skips placeholder-looking candidates while still catching real ones @contract @security @local-only', () => {
    const source = [
      `const sample = '${PLACEHOLDER_OPENAI_KEY}';`,
      `const real = '${FAKE_OPENAI_KEY}';`,
    ].join('\n');

    const findings = scanSecretText(source, 'fixture.ts');

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ line: 2, rule: 'openai-api-key' });
  });

  it('redacts detected values in reported snippets @contract @security @local-only', () => {
    const findings = scanSecretText(`const uploadKey = '${FAKE_AWS_ACCESS_KEY}';`, 'fixture.ts');

    expect(findings).toHaveLength(1);
    expect(findings[0].snippet).toContain('[redacted:aws-access-key]');
    expect(findings[0].snippet).not.toContain(FAKE_AWS_ACCESS_KEY);
  });
});

describe('redactSecretSnippet', () => {
  it('masks long token-like runs and truncates to 240 characters @contract @security @local-only', () => {
    const long = Array.from({ length: 30 }, (_, index) => `k${index}=${'x'.repeat(12)}`).join(' ');

    const snippet = redactSecretSnippet(long, 'github-token');

    expect(snippet).toHaveLength(240);
    expect(snippet).toContain('[redacted:github-token]');
    expect(snippet).not.toContain('xxxxxxxxxxxx');
  });
});

describe('allowsBuiltInOnlySecretScan', () => {
  it('parses SECRET_SCAN_ALLOW_BUILT_IN_ONLY strictly @contract @security @local-only', () => {
    for (const value of ['true', '1', 'yes', ' TRUE ']) {
      expect(allowsBuiltInOnlySecretScan({ SECRET_SCAN_ALLOW_BUILT_IN_ONLY: value })).toBe(true);
    }

    for (const value of ['false', '0', 'no', 'on', '']) {
      expect(allowsBuiltInOnlySecretScan({ SECRET_SCAN_ALLOW_BUILT_IN_ONLY: value })).toBe(false);
    }

    expect(allowsBuiltInOnlySecretScan({})).toBe(false);
  });

  it('reads process.env by default for the built-in-only override @contract @security @local-only', () => {
    vi.stubEnv('SECRET_SCAN_ALLOW_BUILT_IN_ONLY', 'yes');

    expect(allowsBuiltInOnlySecretScan()).toBe(true);
  });
});
