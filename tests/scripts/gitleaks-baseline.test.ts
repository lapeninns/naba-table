import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  filterGitleaksFindings,
  parseGitleaksBaseline,
  parseGitleaksReport,
} from '../../scripts/security/gitleaks-baseline';

const commit = 'a'.repeat(40);
const original = Buffer.from('const fixture = "synthetic-review-value";\n');
const entry = {
  ruleId: 'generic-api-key',
  file: 'tests/fixture.ts',
  startLine: 1,
  endLine: 1,
  sourceSha256: createHash('sha256').update(original).digest('hex'),
  sourceCommit: 'b'.repeat(40),
  reviewedAt: '2026-09-05',
  reason: 'Existing synthetic fixture reviewed in the base revision.',
};
const finding = {
  RuleID: entry.ruleId,
  File: entry.file,
  StartLine: 1,
  EndLine: 1,
  Commit: commit,
  Entropy: 4.5,
  Secret: 'REDACTED',
  Match: 'REDACTED',
};
const manifest = () => parseGitleaksBaseline({ schemaVersion: 1, baselineReview: [entry] });

describe('content-bound Gitleaks baseline', () => {
  it('accepts only a reviewed rule, location, and exact scanned commit blob', () => {
    const read = vi.fn(() => original);
    const result = filterGitleaksFindings(parseGitleaksReport([finding]), manifest(), read);
    expect(result).toEqual({ baselined: 1, unmatched: [] });
    expect(read).toHaveBeenCalledWith(commit, entry.file);
  });

  it('blocks a replacement at the same location even with identical entropy', () => {
    const replacement = Buffer.from('const fixture = "new-secret-same-location";\n');
    expect(
      filterGitleaksFindings(parseGitleaksReport([finding]), manifest(), () => replacement)
        .unmatched,
    ).toHaveLength(1);
  });

  it('uses historical finding bytes instead of the current working file', () => {
    const historical = 'c'.repeat(40);
    const read = vi.fn((sha: string) =>
      sha === historical ? Buffer.from('changed historical value') : original,
    );
    const result = filterGitleaksFindings(
      parseGitleaksReport([{ ...finding, Commit: historical }]),
      manifest(),
      read,
    );
    expect(result.unmatched).toHaveLength(1);
    expect(read).toHaveBeenCalledWith(historical, entry.file);
  });

  it.each([{ RuleID: 'other-rule' }, { File: 'tests/other.ts' }, { StartLine: 2, EndLine: 2 }])(
    'never applies a file-wide or rule-wide exception: %j',
    (change) => {
      expect(
        filterGitleaksFindings(
          parseGitleaksReport([{ ...finding, ...change }]),
          manifest(),
          () => original,
        ).unmatched,
      ).toHaveLength(1);
    },
  );

  it('fails closed when a matched historical blob is unavailable', () => {
    expect(() =>
      filterGitleaksFindings(parseGitleaksReport([finding]), manifest(), () => {
        throw new Error('private-provider-error');
      }),
    ).toThrow('Gitleaks source blob unavailable');
  });

  it.each([
    null,
    {},
    [{ ...finding, Commit: '--malicious' }],
    [{ ...finding, File: '../outside' }],
    [{ ...finding, File: '/absolute' }],
    [{ ...finding, EndLine: 0 }],
    [{ ...finding, StartLine: 2 }],
  ])('rejects malformed or unsafe reports', (value) => {
    expect(() => parseGitleaksReport(value)).toThrow('Invalid Gitleaks report');
  });

  it.each([
    { ...entry, reason: '' },
    { ...entry, sourceSha256: 'wrong' },
    { ...entry, sourceCommit: 'wrong' },
    { ...entry, reviewedAt: 'not-a-date' },
    { ...entry, Secret: 'never-store-this' },
  ])('requires complete, secret-free review records', (record) => {
    expect(() => parseGitleaksBaseline({ schemaVersion: 1, baselineReview: [record] })).toThrow(
      'Invalid Gitleaks baseline',
    );
  });

  it('strips scanner payload fields from parsed findings', () => {
    expect(
      JSON.stringify(
        parseGitleaksReport([{ ...finding, Secret: 'private-value', Match: 'private-context' }]),
      ),
    ).not.toContain('private');
  });
});
