import { describe, expect, it } from 'vitest';

import {
  buildEvidenceDocument,
  formatEvidenceDocument,
  tupleKey as controllerTupleKey,
} from '@/scripts/ci/controller/github/evidence-document';
import {
  extractCiResultDocument,
  formatCiResultDocument,
  parseCiResult,
} from '@/scripts/ci/gate/ci-result';
import { compatibilityChecksForProfile, loadPolicy, parsePolicy } from '@/scripts/ci/gate/policy';
import { parseCiRequestTuple, tupleKey, tuplesEqual } from '@/scripts/ci/gate/tuple';

import {
  HEAD_SHA,
  IMAGE_DIGEST,
  INSTALLATION_ID,
  MERGE_SHA,
  OTHER_DIGEST,
  configuredPolicyRaw,
  localResult,
  mainTuple,
  prTuple,
  repositoryRoot,
} from './helpers';

describe('CI request tuple', () => {
  it('accepts canonical decimal strings for numeric workflow inputs', () => {
    const parsed = parseCiRequestTuple({ ...prTuple(), repositoryId: '123456789', attempt: '3' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.tuple.repositoryId).toBe(123456789);
    expect(parsed.tuple.attempt).toBe(3);
  });

  it('refuses pr tuples without prNumber and main tuples with one', () => {
    const pr = parseCiRequestTuple({ ...prTuple(), prNumber: undefined });
    const main = parseCiRequestTuple({ ...mainTuple(), prNumber: 7 });
    expect(pr).toEqual({ ok: false, errors: ['pr profile requires prNumber'] });
    expect(main).toEqual({ ok: false, errors: ['main profile must not carry prNumber'] });
  });

  it('refuses malformed digests, SHAs and versions', () => {
    const parsed = parseCiRequestTuple({
      ...prTuple(),
      imageDigest: 'REPLACE_ME_CI_JOB_IMAGE_DIGEST',
      headSha: HEAD_SHA.toUpperCase(),
      controllerVersion: '',
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toHaveLength(3);
  });

  it('derives one stable key per tuple and attempt', () => {
    expect(tupleKey(prTuple())).toBe(tupleKey(prTuple()));
    expect(tupleKey(prTuple())).not.toBe(tupleKey(prTuple({ attempt: 2 })));
    expect(tuplesEqual(prTuple(), prTuple({ imageDigest: OTHER_DIGEST }))).toBe(false);
  });

  it('matches the tuple key the controller publishes as external_id', () => {
    expect(controllerTupleKey(prTuple())).toBe(tupleKey(prTuple()));
  });
});

describe('CI policy', () => {
  it('pins provisioned identities and refuses an unqualified job image', () => {
    const resolution = loadPolicy(repositoryRoot);
    expect(resolution.errors).toEqual([]);
    expect(resolution.unconfigured).toEqual(['allowedImageDigests[0]']);
    expect(resolution.policy.repositoryId).toBe(1105219228);
    expect(resolution.policy.localCi.appId).toBe(4840724);
    expect(resolution.policy.localCi.installationId).toBe(159278975);
    expect(resolution.policy.dispatch.appId).toBe(4841783);
    expect(resolution.policy.freshnessHours).toEqual({ merge: null, 'main-deploy': 6 });
    expect(resolution.policy.runtime.activeRuntime).toBe('node22');
    expect(resolution.policy.runtime.candidateRuntime).toBe('node24');
  });

  it('is fully configured once identifiers are filled in', () => {
    const resolution = parsePolicy(configuredPolicyRaw());
    expect(resolution.errors).toEqual([]);
    expect(resolution.unconfigured).toEqual([]);
    expect(resolution.policy.allowedImageDigests).toEqual([IMAGE_DIGEST]);
  });

  it('rejects unbounded deploy freshness, unknown suites and node24 activation', () => {
    const raw = configuredPolicyRaw();
    raw.freshnessHours = { merge: null, 'main-deploy': null };
    (raw.profiles as Record<string, { requiredSuites: string[] }>).pr.requiredSuites.push('ghost');
    (raw.runtime as Record<string, unknown>).activeRuntime = 'node24';
    const resolution = parsePolicy(raw);
    expect(resolution.errors).toEqual(
      expect.arrayContaining([
        'freshnessHours.main-deploy must be bounded (null disables freshness)',
        'profiles.pr references unknown suite "ghost"',
        'runtime.activeRuntime must remain node22 until node24 is qualified',
      ]),
    );
  });

  it('rejects a suite that is both required and conditional', () => {
    const raw = configuredPolicyRaw();
    (raw.profiles as Record<string, { conditionalSuites: string[] }>).main.conditionalSuites.push(
      'full-vitest-suite',
    );
    expect(parsePolicy(raw).errors).toContain(
      'profiles.main: suite "full-vitest-suite" is both required and conditional',
    );
  });

  it('maps compatibility checks per profile, marking conditional ones', () => {
    const { policy } = parsePolicy(configuredPolicyRaw());
    const pr = compatibilityChecksForProfile(policy, 'pr');
    expect(pr.find((entry) => entry.checkName === 'Primitive coverage')).toEqual({
      checkName: 'Primitive coverage',
      suiteId: 'fast-static-gates',
      conditional: false,
    });
    expect(pr.find((entry) => entry.checkName === 'Shuffle seed 20260716')?.conditional).toBe(true);
    const main = compatibilityChecksForProfile(policy, 'main');
    expect(main.every((entry) => !entry.conditional)).toBe(true);
  });

  it('reports a non-object policy as invalid', () => {
    expect(parsePolicy(null).errors).toEqual(['policy must be a JSON object']);
    expect(loadPolicy(repositoryRoot, 'config/ci/does-not-exist.json').errors[0]).toContain(
      'cannot read',
    );
  });
});

describe('CI result document', () => {
  it('round-trips through the fenced check-run text', () => {
    const result = localResult();
    const extracted = extractCiResultDocument(formatCiResultDocument(result));
    const parsed = parseCiResult(extracted);
    expect(parsed).toEqual({ ok: true, result });
  });

  it('parses the document the local controller builds', () => {
    const built = buildEvidenceDocument({
      tuple: prTuple(),
      installationId: INSTALLATION_ID,
      result: {
        version: 1,
        dedupKey: `ci:v1:${'0'.repeat(64)}`,
        supervisorOutcome: 'passed',
        testInventory: {
          discoveredIds: ['tests/a.test.ts::passes'],
          counts: { discovered: 1, passed: 1, failed: 0, skipped: 0, todo: 0 },
        },
        coverage: { lines: 90, branches: 80, functions: 90, statements: 90 },
        runtime: { activeRuntime: 'node22', nodeVersion: '22.23.1', pnpmVersion: '10.34.5' },
        timings: {
          startedAt: '2026-09-05T10:00:00.000Z',
          finishedAt: '2026-09-05T11:00:00.000Z',
          durationMs: 3_600_000,
          suites: [
            {
              suiteId: 'fast-static-gates',
              outcome: 'passed',
              durationMs: 60_000,
              p95BudgetExceeded: false,
            },
            {
              suiteId: 'shuffle-seed-20260715',
              outcome: 'skipped',
              durationMs: 0,
              p95BudgetExceeded: false,
            },
          ],
        },
        evidenceDigests: {
          'fast-static-gates': IMAGE_DIGEST,
          'shuffle-seed-20260715': OTHER_DIGEST,
        },
        attempt: 1,
      },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const parsed = parseCiResult(extractCiResultDocument(formatEvidenceDocument(built.document)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.result.source).toBe('local');
    expect(parsed.result.installationId).toBe(INSTALLATION_ID);
    expect(parsed.result.suites.map((suite) => suite.status)).toEqual(['passed', 'skipped']);
    expect(parsed.result.tuple.testedSha).toBe(MERGE_SHA);
  });

  it('refuses local evidence without an installation and fallback evidence without a run', () => {
    const local = localResult();
    delete local.installationId;
    expect(parseCiResult(local)).toEqual({
      ok: false,
      errors: ['installationId must be a positive integer for local evidence'],
    });
    const fallback = { ...localResult(), source: 'hosted-fallback' };
    delete fallback.installationId;
    expect(parseCiResult(fallback)).toEqual({
      ok: false,
      errors: ['runId must be a positive integer for hosted-fallback evidence'],
    });
  });

  it('refuses duplicate suites, non-https evidence locations and bad timestamps', () => {
    const result = localResult();
    const parsed = parseCiResult({
      ...result,
      suites: [...result.suites, result.suites[0]],
      evidence: { bundleDigest: result.evidence.bundleDigest, location: 'http://plain.example' },
      completedAt: 'yesterday',
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual([
      'suite "fast-static-gates" is listed more than once',
      'evidence.location must be an https URL when present',
      'completedAt must be an ISO timestamp',
    ]);
  });

  it('returns null for text without a JSON document', () => {
    expect(extractCiResultDocument('no evidence here')).toBeNull();
    expect(extractCiResultDocument(null)).toBeNull();
  });
});
