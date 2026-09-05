import { describe, expect, it } from 'vitest';

import { parseCoverageSummary } from '@/scripts/ci/evidence/coverage';
import { buildTestInventory, parseJunit, uniqueTestIds } from '@/scripts/ci/evidence/junit';
import { isSensitiveKey, redactText } from '@/scripts/ci/evidence/redact';

import { COVERAGE_SUMMARY, FAILING_JUNIT_XML, JUNIT_XML } from '../executor/helpers';

describe('parseJunit', () => {
  it('reads test cases and their status without evaluating anything', () => {
    expect(parseJunit(JUNIT_XML)).toEqual([
      { id: 'tests/example.test.ts > adds numbers', status: 'passed' },
      { id: 'tests/example.test.ts > handles <tags>', status: 'passed' },
      { id: 'tests/example.test.ts > skips', status: 'skipped' },
      { id: 'tests/example.test.ts > still passes', status: 'passed' },
    ]);
    expect(parseJunit(FAILING_JUNIT_XML).map((testCase) => testCase.status)).toEqual([
      'failed',
      'error',
    ]);
  });

  it('degrades malformed XML to no cases', () => {
    expect(parseJunit('<testsuites><testcase name="x"')).toEqual([]);
    expect(parseJunit('not xml at all')).toEqual([]);
  });
});

describe('buildTestInventory', () => {
  it('counts, sorts and de-duplicates ids while keeping discovered = ids.length', () => {
    const inventory = buildTestInventory([
      { path: 'b/junit.xml', xml: FAILING_JUNIT_XML },
      { path: 'a/junit.xml', xml: JUNIT_XML },
      { path: 'c/junit.xml', xml: '<testcase name="dup"/><testcase name="dup"/>' },
    ]);
    expect(inventory.discovered).toBe(8);
    expect(inventory.passed).toBe(5);
    expect(inventory.failed).toBe(1);
    expect(inventory.errors).toBe(1);
    expect(inventory.skipped).toBe(1);
    expect(inventory.ids.length).toBe(8);
    expect(new Set(inventory.ids).size).toBe(8);
    expect(inventory.ids).toContain('c/junit.xml :: dup');
    expect(inventory.ids).toContain('c/junit.xml :: dup #2');
    expect(inventory.junitFiles).toEqual(['a/junit.xml', 'b/junit.xml', 'c/junit.xml']);
    expect(inventory.idsTruncated).toBe(false);
  });

  it('is deterministic regardless of input order', () => {
    const a = buildTestInventory([
      { path: 'a.xml', xml: JUNIT_XML },
      { path: 'b.xml', xml: FAILING_JUNIT_XML },
    ]);
    const b = buildTestInventory([
      { path: 'b.xml', xml: FAILING_JUNIT_XML },
      { path: 'a.xml', xml: JUNIT_XML },
    ]);
    expect(a).toEqual(b);
    expect(uniqueTestIds(['x', 'x', 'y', 'x'])).toEqual(['x', 'x #2', 'y', 'x #3']);
  });
});

describe('parseCoverageSummary', () => {
  it('reads the total percentages', () => {
    expect(parseCoverageSummary('coverage/coverage-summary.json', COVERAGE_SUMMARY)).toEqual({
      lines: 80,
      statements: 81,
      functions: 80,
      branches: 60,
      source: 'coverage/coverage-summary.json',
    });
  });

  it('returns null for missing metrics or invalid JSON instead of guessing', () => {
    expect(parseCoverageSummary('x', '{"total":{"lines":{"pct":1}}}')).toBeNull();
    expect(parseCoverageSummary('x', '{"total":{"lines":{"pct":"80"}}}')).toBeNull();
    expect(parseCoverageSummary('x', 'nope')).toBeNull();
    expect(parseCoverageSummary('x', '[]')).toBeNull();
  });
});

// Secret-shaped fixtures are assembled from fragments so this file never contains a
// contiguous literal that the repository's own secret scanner would flag.
const FAKE_GITHUB_TOKEN = ['ghp', '_'].join('') + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const FAKE_AWS_ACCESS_KEY = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
const FAKE_STRIPE_LIVE_KEY = ['sk_', 'live_'].join('') + 'ABCDEFGHIJKLMNOPQRSTUV';
const FAKE_PEM_BLOCK = [
  '-----BEGIN RSA ',
  'PRIVATE KEY-----',
  '\nabc\n',
  '-----END RSA PRIVATE KEY-----',
].join('');

describe('redactText', () => {
  it('redacts tokens, keys, PEM blocks, URL credentials and guest PII', () => {
    const input = [
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl',
      `GITHUB_TOKEN=${FAKE_GITHUB_TOKEN}`,
      `aws ${FAKE_AWS_ACCESS_KEY}`,
      `stripe ${FAKE_STRIPE_LIVE_KEY}`,
      'git clone https://user:pa55word@github.com/org/repo.git',
      'guest jane.doe@example.com called +44 20 7946 0958',
      '"apiKey": "super-secret-value"',
      FAKE_PEM_BLOCK,
    ].join('\n');
    const { text, redactions } = redactText(input);
    expect(redactions).toBeGreaterThanOrEqual(8);
    for (const secret of [
      'eyJhbGciOiJIUzI1NiJ9',
      FAKE_GITHUB_TOKEN,
      FAKE_AWS_ACCESS_KEY,
      FAKE_STRIPE_LIVE_KEY,
      'pa55word',
      'jane.doe@example.com',
      '7946 0958',
      'super-secret-value',
      'BEGIN RSA PRIVATE KEY',
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain('GITHUB_TOKEN=[REDACTED]');
    expect(text).toContain('"apiKey": "[REDACTED]');
    expect(text).toContain('https://[REDACTED]@github.com/org/repo.git');
  });

  it('leaves ordinary log lines alone', () => {
    const line = 'PASS tests/example.test.ts (12 tests) 340ms\nexit code 0';
    expect(redactText(line)).toEqual({ text: line, redactions: 0 });
    expect(isSensitiveKey('SUPABASE_SERVICE_ROLE_KEY')).toBe(true);
    expect(isSensitiveKey('TZ')).toBe(false);
  });
});
