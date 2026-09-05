import { describe, expect, it } from 'vitest';

import { DedupKeySchema, dedupKey, dedupKeyMaterial } from '@/scripts/ci/contracts/request';

import { DIGEST_2, SHA_B, prRequest } from './fixtures';

describe('dedupKey', () => {
  it('is deterministic and independent of property order and extra fields', () => {
    const base = prRequest();
    const reordered = {
      attempt: base.attempt,
      imageDigest: base.imageDigest,
      policyVersion: base.policyVersion,
      testedSha: base.testedSha,
      baseSha: base.baseSha,
      headSha: base.headSha,
      profile: base.profile,
      repositoryId: base.repositoryId,
      controllerVersion: '9.9.9',
      prNumber: 999,
    };
    expect(dedupKey(base)).toBe(dedupKey(reordered));
    expect(dedupKey(base)).toMatch(/^ci:v1:[0-9a-f]{64}$/u);
    expect(DedupKeySchema.safeParse(dedupKey(base)).success).toBe(true);
  });

  it('pins the canonical material so the key cannot silently change', () => {
    expect(dedupKeyMaterial(prRequest())).toBe(
      [
        'repositoryId=123456789',
        'profile=pr',
        `headSha=${'a'.repeat(40)}`,
        `baseSha=${'b'.repeat(40)}`,
        `testedSha=${'c'.repeat(40)}`,
        'policyVersion=2026-09-04.1',
        `imageDigest=sha256:${'1'.repeat(64)}`,
        'attempt=1',
      ].join('\n'),
    );
    expect(dedupKey(prRequest())).toBe(
      'ci:v1:4f25b75403b5e6c76d24b95e6b7ded6b248b8c10fac05cd184b8e828fdefd43a',
    );
  });

  it('changes when any tuple field changes', () => {
    const base = dedupKey(prRequest());
    expect(dedupKey(prRequest({ attempt: 2 }))).not.toBe(base);
    expect(dedupKey(prRequest({ imageDigest: DIGEST_2 }))).not.toBe(base);
    expect(dedupKey(prRequest({ policyVersion: '2026-09-04.2' }))).not.toBe(base);
    expect(dedupKey(prRequest({ headSha: SHA_B }))).not.toBe(base);
    expect(dedupKey(prRequest({ repositoryId: 1 }))).not.toBe(base);
  });

  it('refuses malformed material instead of hashing it', () => {
    expect(() => dedupKey(prRequest({ imageDigest: 'REPLACE_ME_IMAGE' }))).toThrow();
    expect(() => dedupKey(prRequest({ headSha: 'ABC' }))).toThrow();
  });
});
