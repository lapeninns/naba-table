import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateCodeqlPolicy,
  extractCodeqlFindings,
  findSarifFiles,
  parseCodeqlPolicy,
} from '@/scripts/ci/gate/codeql-policy';

import { repositoryRoot } from './helpers';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function sampleSarif(results: Array<Record<string, unknown>>): unknown {
  return {
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'CodeQL',
            rules: [
              { id: 'js/sql-injection', defaultConfiguration: { level: 'error' } },
              { id: 'js/unused-local-variable', defaultConfiguration: { level: 'note' } },
            ],
          },
          extensions: [{ rules: [{ id: 'js/xss', defaultConfiguration: { level: 'error' } }] }],
        },
        results,
      },
    ],
  };
}

const location = (uri: string, line: number) => ({
  locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: line } } }],
});

describe('codeql findings policy', () => {
  it('parses the committed policy and requires error level to fail', () => {
    const policy = parseCodeqlPolicy(
      JSON.parse(readFileSync(path.join(repositoryRoot, 'config/ci/codeql-policy.json'), 'utf8')),
    );
    expect(policy.failOnLevels).toContain('error');
    expect(() => parseCodeqlPolicy({ failOnLevels: ['warning'] })).toThrow('must include "error"');
    expect(() => parseCodeqlPolicy([])).toThrow('must be an object');
  });

  it('fails on a new error-level result and reports warnings without blocking', () => {
    const findings = extractCodeqlFindings(
      sampleSarif([
        {
          ruleId: 'js/sql-injection',
          message: { text: 'Query built from user input' },
          partialFingerprints: { primaryLocationLineHash: 'abc123:1' },
          ...location('server/db.ts', 12),
        },
        { ruleId: 'js/xss', message: { text: 'Reflected' }, ...location('src/page.tsx', 40) },
        {
          ruleId: 'js/unused-local-variable',
          level: 'warning',
          message: { text: 'Unused' },
          ...location('lib/x.ts', 1),
        },
      ]),
    );
    expect(findings.map((finding) => finding.level)).toEqual(['error', 'error', 'warning']);
    expect(findings[0].fingerprint).toBe('js/sql-injection|abc123:1');
    expect(findings[1].fingerprint).toBe('js/xss|src/page.tsx:40');

    const policy = parseCodeqlPolicy({ failOnLevels: ['error'] });
    const report = evaluateCodeqlPolicy(findings, policy);
    expect(report.ok).toBe(false);
    expect(report.failing.map((finding) => finding.ruleId)).toEqual(['js/sql-injection', 'js/xss']);
    expect(report.warnings).toHaveLength(1);
  });

  it('passes when every error is baselined or its rule ignored', () => {
    const findings = extractCodeqlFindings(
      sampleSarif([
        {
          ruleId: 'js/sql-injection',
          partialFingerprints: { primaryLocationLineHash: 'abc123:1' },
          ...location('server/db.ts', 12),
        },
        { ruleId: 'js/xss', ...location('src/page.tsx', 40) },
      ]),
    );
    const report = evaluateCodeqlPolicy(
      findings,
      parseCodeqlPolicy({
        failOnLevels: ['error'],
        baselineFingerprints: ['js/sql-injection|abc123:1'],
        ignoredRuleIds: ['js/xss'],
      }),
    );
    expect(report.ok).toBe(true);
    expect(report.baselined).toHaveLength(1);
    expect(report.totalResults).toBe(2);
  });

  it('uses the rule default level when a result carries none', () => {
    const findings = extractCodeqlFindings(
      sampleSarif([{ ruleId: 'js/unused-local-variable', ...location('lib/x.ts', 3) }]),
    );
    expect(findings[0].level).toBe('note');
    expect(evaluateCodeqlPolicy(findings, parseCodeqlPolicy({ failOnLevels: ['error'] })).ok).toBe(
      true,
    );
  });

  it('rejects documents without runs', () => {
    expect(() => extractCodeqlFindings({})).toThrow('must contain runs');
  });

  it('finds SARIF files recursively and the CLI refuses an empty directory', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'codeql-policy-'));
    temporaryDirectories.push(dir);
    mkdirSync(path.join(dir, 'nested'));
    writeFileSync(path.join(dir, 'nested', 'a.sarif'), JSON.stringify(sampleSarif([])));
    writeFileSync(path.join(dir, 'ignore.txt'), 'x');
    expect(findSarifFiles(dir)).toEqual([path.join(dir, 'nested', 'a.sarif')]);

    const empty = mkdtempSync(path.join(tmpdir(), 'codeql-empty-'));
    temporaryDirectories.push(empty);
    const result = spawnSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/ci/gate/codeql-policy.ts', '--sarif', empty],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refusing to pass without evidence');
  }, 60_000);
});
