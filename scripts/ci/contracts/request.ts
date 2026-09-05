import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  AttemptSchema,
  GitShaSchema,
  PolicyVersionSchema,
  PositiveIntSchema,
  ProfileNameSchema,
  RepositoryIdSchema,
  SemverSchema,
  Sha256DigestSchema,
} from './primitives';

/**
 * One unit of CI work. `imageDigest` must be a real digest: a request built
 * from an unconfigured profile is rejected here rather than executed.
 */
export const CiRequestSchema = z
  .strictObject({
    repositoryId: RepositoryIdSchema,
    profile: ProfileNameSchema,
    prNumber: PositiveIntSchema.optional(),
    headSha: GitShaSchema,
    baseSha: GitShaSchema,
    /** Synthetic merge SHA for PRs; the merged commit SHA for main/nightly. */
    testedSha: GitShaSchema,
    policyVersion: PolicyVersionSchema,
    imageDigest: Sha256DigestSchema,
    controllerVersion: SemverSchema,
    attempt: AttemptSchema,
  })
  .superRefine((request, ctx) => {
    if (request.profile === 'pr') {
      if (request.prNumber === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['prNumber'],
          message: 'pr profile requires prNumber',
        });
      }
      if (request.testedSha === request.headSha) {
        ctx.addIssue({
          code: 'custom',
          path: ['testedSha'],
          message: 'pr profile tests the synthetic merge commit, which differs from headSha',
        });
      }
    } else {
      if (request.prNumber !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['prNumber'],
          message: `${request.profile} profile must not carry a prNumber`,
        });
      }
      if (request.testedSha !== request.headSha) {
        ctx.addIssue({
          code: 'custom',
          path: ['testedSha'],
          message: `${request.profile} profile tests headSha itself`,
        });
      }
    }
  });
export type CiRequest = z.infer<typeof CiRequestSchema>;

export const DEDUP_KEY_VERSION = 'v1';
export const DEDUP_KEY_FIELDS = [
  'repositoryId',
  'profile',
  'headSha',
  'baseSha',
  'testedSha',
  'policyVersion',
  'imageDigest',
  'attempt',
] as const;

export type DedupKeyInput = Pick<CiRequest, (typeof DEDUP_KEY_FIELDS)[number]>;

export const DedupKeyInputSchema = z.object({
  repositoryId: RepositoryIdSchema,
  profile: ProfileNameSchema,
  headSha: GitShaSchema,
  baseSha: GitShaSchema,
  testedSha: GitShaSchema,
  policyVersion: PolicyVersionSchema,
  imageDigest: Sha256DigestSchema,
  attempt: AttemptSchema,
});

/** Canonical, order-independent material string. Exposed for debugging and tests. */
export function dedupKeyMaterial(input: DedupKeyInput): string {
  const parsed = DedupKeyInputSchema.parse(input);
  return DEDUP_KEY_FIELDS.map((field) => `${field}=${String(parsed[field])}`).join('\n');
}

/**
 * Stable identifier for "this exact tuple of work". Two requests with the same
 * key are the same job and must not run twice; any field change (including a
 * retry attempt) yields a different key.
 */
export function dedupKey(input: DedupKeyInput): string {
  const digest = createHash('sha256').update(dedupKeyMaterial(input), 'utf8').digest('hex');
  return `ci:${DEDUP_KEY_VERSION}:${digest}`;
}

export const DedupKeySchema = z
  .string()
  .regex(new RegExp(`^ci:${DEDUP_KEY_VERSION}:[0-9a-f]{64}$`, 'u'), 'expected a dedup key');
