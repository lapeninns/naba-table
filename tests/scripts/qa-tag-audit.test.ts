import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  auditQaTestTags,
  buildQaTagAuditSnapshot,
  compareQaTagAuditToBaseline,
  extractQaTestTitles,
  runQaTagAudit,
  type QaTagAuditSnapshot,
} from '@/scripts/qa/tag-audit';

/**
 * Behavioral pins for scripts/qa/tag-audit.ts (MS-foundation-qa-harness-self-tests).
 *
 * Fixture test files are assembled from string fragments (never literal test-call syntax),
 * so this suite's own source stays invisible to the repo-wide tag ratchet it is testing.
 */

const IT_FN = 'it';
const TEST_FN = 'test';
const UNKNOWN_TAG = '@' + 'wip-tag';

let fixtureRoot: string;

function fixtureTestLine(title: string, callee: string = IT_FN): string {
  return `${callee}(${JSON.stringify(title)}, () => {});`;
}

function writeFixture(name: string, lines: readonly string[]): string {
  const filePath = path.join(fixtureRoot, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  return filePath;
}

function baselinePath(): string {
  return path.join(fixtureRoot, 'baseline.json');
}

function readBaselineSnapshot(): QaTagAuditSnapshot {
  return JSON.parse(fs.readFileSync(baselinePath(), 'utf8')) as QaTagAuditSnapshot;
}

function currentComparisonFailures(): string {
  return compareQaTagAuditToBaseline(
    auditQaTestTags([fixtureRoot]),
    readBaselineSnapshot(),
  ).failures.join('\n');
}

beforeEach(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-tag-audit-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('extractQaTestTitles', () => {
  it('extracts titles, tags, and line numbers across call styles @contract @local-only', () => {
    const source = [
      fixtureTestLine('books a table @smoke @p1'),
      `${IT_FN}.skip(${JSON.stringify('holds the rota')}, () => {});`,
      `${TEST_FN}(\`checks in a guest @contract\`, () => {});`,
    ].join('\n');

    const titles = extractQaTestTitles(source, 'fixtures/sample.test.ts');

    expect(titles).toHaveLength(3);
    expect(titles[0]).toMatchObject({ line: 1, tags: ['@smoke', '@p1'] });
    expect(titles[1]).toMatchObject({ line: 2, tags: [], title: 'holds the rota' });
    expect(titles[2]).toMatchObject({
      file: 'fixtures/sample.test.ts',
      line: 3,
      tags: ['@contract'],
    });
  });

  it('ignores non-test call sites @contract @local-only', () => {
    const source = ['describe("suite", () => {});', 'limit("not a real title");'].join('\n');

    expect(extractQaTestTitles(source, 'fixtures/none.test.ts')).toHaveLength(0);
  });
});

describe('auditQaTestTags snapshots', () => {
  it('flags unknown tags as hard failures against any baseline @contract @local-only', () => {
    writeFixture('unknown.test.ts', [fixtureTestLine(`pins the rota ${UNKNOWN_TAG}`)]);

    const current = auditQaTestTags([fixtureRoot]);
    expect(current.unknownTags).toHaveLength(1);
    expect(current.unknownTags[0]).toMatchObject({ tag: UNKNOWN_TAG });

    const comparison = compareQaTagAuditToBaseline(
      current,
      buildQaTagAuditSnapshot([], [fixtureRoot]),
    );
    expect(comparison.passed).toBe(false);
    expect(comparison.failures.join('\n')).toContain(`unknown QA tag ${UNKNOWN_TAG}`);
  });

  it('without a baseline the CLI fails only on unknown tags @contract @local-only', () => {
    writeFixture('untagged-only.test.ts', [fixtureTestLine('renders the booking board')]);
    expect(runQaTagAudit(['--root', fixtureRoot])).toBe(0);

    writeFixture('unknown.test.ts', [fixtureTestLine(`pins the rota ${UNKNOWN_TAG}`)]);
    expect(runQaTagAudit(['--root', fixtureRoot])).toBe(1);
  });

  it('accepts a single test file as a scan root @contract @local-only', () => {
    const filePath = writeFixture('solo.test.ts', [fixtureTestLine('solo scan @smoke')]);

    const snapshot = auditQaTestTags([filePath]);

    expect(snapshot.totals).toMatchObject({ files: 1, tagged: 1, testTitles: 1, untagged: 0 });
  });
});

describe('runQaTagAudit baseline ratchet', () => {
  it('fails a file that adds untagged titles above its baseline @contract @local-only', () => {
    writeFixture('board.test.ts', [
      fixtureTestLine('renders the booking board'),
      fixtureTestLine('filters by service period @smoke'),
    ]);
    expect(
      runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath(), '--update-baseline']),
    ).toBe(0);

    writeFixture('board.test.ts', [
      fixtureTestLine('renders the booking board'),
      fixtureTestLine('drops a second untagged title'),
      fixtureTestLine('filters by service period @smoke'),
    ]);

    expect(runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath()])).toBe(1);
    const failures = currentComparisonFailures();
    expect(failures).toContain('above baseline 1');
    expect(failures).toContain('increased from 1 to 2');
  });

  it('passes at or below the per-file baseline @contract @local-only', () => {
    writeFixture('board.test.ts', [fixtureTestLine('renders the booking board')]);
    runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath(), '--update-baseline']);

    // Equal to baseline: unchanged file.
    expect(runQaTagAudit(['--root', fixtureRoot, `--baseline=${baselinePath()}`])).toBe(0);

    // Below baseline: the untagged title gains a tag.
    writeFixture('board.test.ts', [fixtureTestLine('renders the booking board @smoke')]);
    expect(runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath()])).toBe(0);
  });

  it('passes brand-new files whose titles are all tagged @contract @local-only', () => {
    writeFixture('board.test.ts', [fixtureTestLine('renders the booking board')]);
    runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath(), '--update-baseline']);

    writeFixture('fresh.test.ts', [
      fixtureTestLine('creates a booking @smoke @p1'),
      fixtureTestLine('cancels a booking @contract'),
    ]);

    expect(runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath()])).toBe(0);
  });

  it('fails brand-new files that ship untagged titles @contract @local-only', () => {
    writeFixture('board.test.ts', [fixtureTestLine('renders the booking board')]);
    runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath(), '--update-baseline']);

    writeFixture('fresh.test.ts', [fixtureTestLine('creates a booking with no tags')]);

    expect(runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath()])).toBe(1);
    const failures = currentComparisonFailures();
    expect(failures).toContain('fresh.test.ts');
    expect(failures).toContain('above baseline 0');
  });

  it('catches per-file regressions even when the total stays flat @contract @local-only', () => {
    writeFixture('alpha.test.ts', [fixtureTestLine('legacy untagged title')]);
    writeFixture('beta.test.ts', [fixtureTestLine('already tagged @smoke')]);
    runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath(), '--update-baseline']);

    // Move the single untagged title from alpha to beta: totals stay at 1.
    writeFixture('alpha.test.ts', [fixtureTestLine('legacy untagged title @smoke')]);
    writeFixture('beta.test.ts', [fixtureTestLine('newly untagged title')]);

    expect(runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath()])).toBe(1);
    const failures = currentComparisonFailures();
    expect(failures).toContain('beta.test.ts');
    expect(failures).not.toContain('alpha.test.ts');
  });

  it('updates the baseline snapshot file on demand @contract @local-only', () => {
    writeFixture('board.test.ts', [
      fixtureTestLine('renders the booking board'),
      fixtureTestLine('filters by service period @smoke'),
    ]);
    writeFixture(path.join('nested', 'deep.test.ts'), [
      fixtureTestLine('deep path scan @contract'),
    ]);
    writeFixture('helper.ts', [fixtureTestLine('helper is not a test file')]);

    expect(
      runQaTagAudit(['--root', fixtureRoot, '--baseline', baselinePath(), '--update-baseline']),
    ).toBe(0);

    const snapshot = readBaselineSnapshot();
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.totals).toMatchObject({ files: 2, tagged: 2, testTitles: 3, untagged: 1 });
    expect(snapshot.files.map((file) => file.file).join('\n')).toContain('nested/deep.test.ts');
  });

  it('rejects unknown options and baseline updates without a path @contract @local-only', () => {
    expect(() => runQaTagAudit(['--wat'])).toThrow('Unknown QA tag audit option "--wat"');
    expect(() => runQaTagAudit(['--root', fixtureRoot, '--update-baseline'])).toThrow(
      'requires --baseline',
    );
  });
});
