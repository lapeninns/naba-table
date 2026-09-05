import { z } from 'zod';

/**
 * Shared primitives for every CI contract. Everything here fails closed:
 * placeholders are recognised explicitly so that an unconfigured value can be
 * reported as "unconfigured" instead of being used by accident.
 */

export const PLACEHOLDER_PATTERN = /^REPLACE_ME_[A-Z0-9_]+$/u;

export function isPlaceholder(value: unknown): value is string {
  return typeof value === 'string' && PLACEHOLDER_PATTERN.test(value);
}

export const PROFILE_NAMES = ['pr', 'main', 'nightly'] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];
export const ProfileNameSchema = z.enum(PROFILE_NAMES);

export const RUNTIME_IDS = ['node22', 'node24'] as const;
export type RuntimeId = (typeof RUNTIME_IDS)[number];
export const RuntimeIdSchema = z.enum(RUNTIME_IDS);

/** Full 40-character lowercase git object id. Abbreviated or mixed-case SHAs are rejected. */
export const GitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$/u, 'expected a full lowercase 40-hex git SHA');

/** Content digest in the OCI / Docker `sha256:<64 hex>` format. */
export const Sha256DigestSchema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/u, 'expected sha256:<64 lowercase hex>');

/** Digest that may still be an obvious placeholder (profiles only, never requests). */
export const Sha256DigestOrPlaceholderSchema = z.union([
  Sha256DigestSchema,
  z.string().regex(PLACEHOLDER_PATTERN, 'expected sha256 digest or REPLACE_ME_* placeholder'),
]);

/** Positive integer GitHub repository id (databaseId). */
export const RepositoryIdSchema = z.number().int().positive();

/** Policy versions are date-stamped and monotonically bumped: `YYYY-MM-DD.N`. */
export const PolicyVersionSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}\.\d+$/u, 'expected policy version formatted YYYY-MM-DD.N');

export const SemverSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u,
    'expected a semantic version',
  );

export const IsoTimestampSchema = z.iso.datetime({ offset: true });

export const NonNegativeIntSchema = z.number().int().nonnegative();
export const PositiveIntSchema = z.number().int().positive();

/** Identifier used for suites, commands, rules: lower-case, machine friendly. */
export const IdentifierSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9:._/-]{0,127}$/u, 'expected a lower-case machine identifier');

export const MAX_ATTEMPTS = 5;
export const AttemptSchema = z.number().int().min(1).max(MAX_ATTEMPTS);

export const EMPTY_SHA = '0000000000000000000000000000000000000000';
