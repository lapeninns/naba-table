import { describe, expect, it } from 'vitest';

import {
  buildEvidenceDocument,
  evidenceBundleDigest,
  formatEvidenceDocument,
  tupleKey,
} from '@/scripts/ci/controller/github/evidence-document';
import { extractCiResultDocument, parseCiResult } from '@/scripts/ci/gate/ci-result';
import { tupleKey as gateTupleKey } from '@/scripts/ci/gate/tuple';

import { INSTALLATION_ID, completeResultFor } from './helpers';
import { DIGEST_1, DIGEST_2, mainRequest, prRequest } from '../contracts/fixtures';

describe('evidence document', () => {
  it('produces a document the release gate parses and binds to the same tuple key', () => {
    const tuple = prRequest();
    const result = completeResultFor(tuple, {
      evidenceDigests: { 'fast-static-gates': DIGEST_2, coverage: DIGEST_1 },
    });
    const built = buildEvidenceDocument({ tuple, result, installationId: INSTALLATION_ID });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const text = formatEvidenceDocument(built.document);
    const parsed = parseCiResult(extractCiResultDocument(text));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.result.source).toBe('local');
    expect(parsed.result.installationId).toBe(INSTALLATION_ID);
    expect(parsed.result.tuple).toEqual(tuple);
    expect(parsed.result.suites.map((suite) => suite.id)).toEqual(['fast-static-gates']);
    expect(parsed.result.evidence.bundleDigest).toBe(
      evidenceBundleDigest({ 'fast-static-gates': DIGEST_2, coverage: DIGEST_1 }),
    );
    expect(tupleKey(tuple)).toBe(gateTupleKey(tuple));
    expect(tupleKey(mainRequest())).toBe(gateTupleKey(mainRequest()));
  });

  it('fails closed when a suite has no evidence digest', () => {
    const tuple = prRequest();
    const result = completeResultFor(tuple, { evidenceDigests: { 'junit.xml': DIGEST_2 } });
    const built = buildEvidenceDocument({ tuple, result, installationId: INSTALLATION_ID });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.reason).toContain('fast-static-gates');
  });

  it('fails closed when a suite id would be rejected by the gate', () => {
    const tuple = prRequest();
    const result = completeResultFor(tuple, {
      timings: {
        startedAt: '2026-09-04T10:00:00.000Z',
        finishedAt: '2026-09-04T10:30:00.000Z',
        durationMs: 1_800_000,
        suites: [
          {
            suiteId: 'vitest:shard/1',
            outcome: 'passed',
            durationMs: 10,
            p95BudgetExceeded: false,
          },
        ],
      },
      evidenceDigests: { 'vitest:shard/1': DIGEST_2 },
    });
    const built = buildEvidenceDocument({ tuple, result, installationId: INSTALLATION_ID });
    expect(built.ok).toBe(false);
  });

  it('fails closed on attempt mismatch or an unconfigured installation', () => {
    const tuple = prRequest();
    const result = completeResultFor(tuple);
    expect(
      buildEvidenceDocument({ tuple: { ...tuple, attempt: 2 }, result, installationId: 1 }).ok,
    ).toBe(false);
    expect(buildEvidenceDocument({ tuple, result, installationId: 0 }).ok).toBe(false);
  });

  it('projects only inventoried suites, derives coverage from the executor coverage suite', () => {
    const tuple = prRequest();
    const timing = (suiteId: string, outcome: 'passed' | 'skipped' | 'failed') => ({
      suiteId,
      outcome,
      durationMs: 5,
      p95BudgetExceeded: false,
    });
    const result = completeResultFor(tuple, {
      timings: {
        startedAt: '2026-09-04T10:00:00.000Z',
        finishedAt: '2026-09-04T10:30:00.000Z',
        durationMs: 1_800_000,
        suites: [
          timing('prepare', 'passed'),
          timing('fast-static-gates', 'passed'),
          timing('shuffle-seed-20260715', 'skipped'),
          timing('coverage', 'passed'),
        ],
      },
      evidenceDigests: {
        prepare: DIGEST_2,
        'fast-static-gates': DIGEST_2,
        'shuffle-seed-20260715': DIGEST_2,
        coverage: DIGEST_1,
        'evidence-manifest': DIGEST_2,
      },
    });
    const built = buildEvidenceDocument({ tuple, result, installationId: INSTALLATION_ID });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.document.suites.map((suite) => [suite.id, suite.name, suite.status])).toEqual([
      ['fast-static-gates', 'Fast static gates', 'passed'],
      ['shuffle-seed-20260715', 'Shuffle seed 20260715', 'skipped'],
    ]);
    expect(built.document.coverage).toEqual({ status: 'passed', evidenceDigest: DIGEST_1 });
    const parsed = parseCiResult(extractCiResultDocument(formatEvidenceDocument(built.document)));
    expect(parsed.ok).toBe(true);
  });

  it('still fails closed when an executor-internal suite lacks a digest', () => {
    const tuple = prRequest();
    const result = completeResultFor(tuple, {
      timings: {
        startedAt: '2026-09-04T10:00:00.000Z',
        finishedAt: '2026-09-04T10:30:00.000Z',
        durationMs: 1_800_000,
        suites: [
          { suiteId: 'prepare', outcome: 'passed', durationMs: 1, p95BudgetExceeded: false },
          {
            suiteId: 'fast-static-gates',
            outcome: 'passed',
            durationMs: 1,
            p95BudgetExceeded: false,
          },
        ],
      },
      evidenceDigests: { 'fast-static-gates': DIGEST_2 },
    });
    const built = buildEvidenceDocument({ tuple, result, installationId: INSTALLATION_ID });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.reason).toContain('prepare');
  });

  it('marks coverage failed when the result has no coverage suite', () => {
    const tuple = prRequest();
    const built = buildEvidenceDocument({
      tuple,
      result: completeResultFor(tuple),
      installationId: INSTALLATION_ID,
    });
    expect(built.ok && built.document.coverage.status).toBe('failed');
  });

  it('bundle digest is order independent', () => {
    expect(evidenceBundleDigest({ a: DIGEST_1, b: DIGEST_2 })).toBe(
      evidenceBundleDigest({ b: DIGEST_2, a: DIGEST_1 }),
    );
  });
});
