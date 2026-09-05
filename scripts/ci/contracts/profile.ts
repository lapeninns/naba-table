import { z } from 'zod';

import { isCredentialLikeKey } from './credential-guard';
import { COMPATIBILITY_CHECK_NAMES } from './names';
import {
  IdentifierSchema,
  PolicyVersionSchema,
  PositiveIntSchema,
  ProfileNameSchema,
  RuntimeIdSchema,
  SemverSchema,
  Sha256DigestOrPlaceholderSchema,
  isPlaceholder,
} from './primitives';
import { uniqueStrings } from './validation';

export const CI_PROFILE_SCHEMA_VERSION = 1;

export const COMMAND_KINDS = ['static', 'db', 'vitest', 'browser', 'stability'] as const;
export type CommandKind = (typeof COMMAND_KINDS)[number];

export const RESOURCE_CLASSES = ['normal', 'dedicated'] as const;
export type ResourceClass = (typeof RESOURCE_CLASSES)[number];

const ENV_KEY = /^[A-Z][A-Z0-9_]*$/u;
const DUMMY_VALUE = /^test-[a-z0-9-]+$/u;

export const REQUIRED_SANITIZED_ENV: Readonly<Record<string, string>> = {
  APP_ENV: 'test',
  CI: 'true',
  QA_TARGET_ENV: 'ci-ephemeral',
  TZ: 'UTC',
};

function rejectRealLookingSecrets(env: Record<string, string>, ctx: z.RefinementCtx): void {
  for (const [key, value] of Object.entries(env)) {
    if (isCredentialLikeKey(key) && !DUMMY_VALUE.test(value)) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: 'credential-shaped env keys must use an obviously fake test-* value',
      });
    }
  }
}

const EnvRecordSchema = z.record(
  z.string().regex(ENV_KEY, 'environment keys must be UPPER_SNAKE_CASE'),
  z.string(),
);

/** Extra variables a single command layers on top of the profile env (e.g. QA_USE_MOCKS). */
export const SanitizedEnvOverlaySchema = EnvRecordSchema.superRefine(rejectRealLookingSecrets);

/**
 * Sanitized environment: fixed test values only. Any credential-shaped key
 * must carry an obviously fake `test-*` value so real secrets can never be
 * smuggled into a profile.
 */
export const SanitizedEnvSchema = EnvRecordSchema.superRefine((env, ctx) => {
  for (const [key, expected] of Object.entries(REQUIRED_SANITIZED_ENV)) {
    if (env[key] !== expected) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `sanitized env must set ${key}=${expected}`,
      });
    }
  }
  rejectRealLookingSecrets(env, ctx);
});

export const CiCommandSchema = z.strictObject({
  id: IdentifierSchema,
  /** Exact shell invocation executed from the repository root inside the job VM. */
  run: z.string().min(1),
  kind: z.enum(COMMAND_KINDS),
  /** Per-command hard limit; the supervisor kills the process group when exceeded. */
  timeoutMinutes: PositiveIntSchema,
  env: SanitizedEnvOverlaySchema.optional(),
});
export type CiCommand = z.infer<typeof CiCommandSchema>;

export const CiSuiteSchema = z
  .strictObject({
    id: IdentifierSchema,
    displayName: z.string().min(1),
    kind: z.enum(COMMAND_KINDS),
    commandIds: z.array(IdentifierSchema).min(1),
    /** Hosted compatibility check names this suite stands in for. */
    satisfies: z.array(z.enum(COMPATIBILITY_CHECK_NAMES)),
    /** 95th percentile wall-clock budget; exceeding it is a warning, not a failure. */
    p95BudgetMinutes: PositiveIntSchema,
    /** Hard limit; exceeding it fails the suite with `timed-out`. */
    hardLimitMinutes: PositiveIntSchema,
    resourceClass: z.enum(RESOURCE_CLASSES),
    /** True when a conditional rule decides whether the suite runs. */
    conditional: z.boolean(),
  })
  .superRefine((suite, ctx) => {
    if (suite.hardLimitMinutes < suite.p95BudgetMinutes) {
      ctx.addIssue({
        code: 'custom',
        path: ['hardLimitMinutes'],
        message: 'hard limit must be greater than or equal to the p95 budget',
      });
    }
    if (!uniqueStrings(suite.commandIds)) {
      ctx.addIssue({ code: 'custom', path: ['commandIds'], message: 'duplicate command ids' });
    }
    if (!uniqueStrings(suite.satisfies)) {
      ctx.addIssue({ code: 'custom', path: ['satisfies'], message: 'duplicate check names' });
    }
  });
export type CiSuite = z.infer<typeof CiSuiteSchema>;

export const ConditionalPredicateSchema = z.strictObject({
  type: z.literal('any-changed-path-matches'),
  /** GitHub Actions `paths` style globs (`**` spans directories, `*` stays in a segment). */
  patterns: z.array(z.string().min(1)).min(1),
});

/**
 * Conditional rules can only ever *skip* work when the predicate is known
 * to be false. Unknown inputs must run the suite (fail closed), which the
 * schema enforces by only accepting `whenUnknown: 'run'`.
 */
export const ConditionalRuleSchema = z.strictObject({
  id: IdentifierSchema,
  description: z.string().min(1),
  suiteIds: z.array(IdentifierSchema).min(1),
  predicate: ConditionalPredicateSchema,
  whenMatch: z.literal('run'),
  whenNoMatch: z.literal('skip'),
  whenUnknown: z.literal('run'),
});
export type ConditionalRule = z.infer<typeof ConditionalRuleSchema>;

export const CiRuntimeSchema = z
  .strictObject({
    activeRuntime: RuntimeIdSchema,
    candidateRuntime: RuntimeIdSchema,
    pnpm: SemverSchema,
    qualificationNote: z.string().min(1),
  })
  .refine((runtime) => runtime.activeRuntime !== runtime.candidateRuntime, {
    message: 'candidate runtime must differ from the active runtime',
    path: ['candidateRuntime'],
  });
export type CiRuntime = z.infer<typeof CiRuntimeSchema>;

export const CiImageSchema = z.strictObject({
  ubuntuDigest: Sha256DigestOrPlaceholderSchema,
  jobImageDigest: Sha256DigestOrPlaceholderSchema,
  playwrightVersion: SemverSchema,
});
export type CiImage = z.infer<typeof CiImageSchema>;

export function isImageConfigured(image: CiImage): boolean {
  return !isPlaceholder(image.ubuntuDigest) && !isPlaceholder(image.jobImageDigest);
}

export const CiLimitsSchema = z
  .strictObject({
    cpu: PositiveIntSchema,
    memoryGiB: PositiveIntSchema,
    pids: PositiveIntSchema,
    diskGiB: PositiveIntSchema,
    timeoutMinutes: PositiveIntSchema,
    vitestWorkers: PositiveIntSchema,
    playwrightWorkers: PositiveIntSchema,
  })
  .superRefine((limits, ctx) => {
    if (limits.vitestWorkers > limits.cpu) {
      ctx.addIssue({
        code: 'custom',
        path: ['vitestWorkers'],
        message: 'vitest workers cannot exceed the vCPU allocation',
      });
    }
    if (limits.playwrightWorkers > limits.cpu) {
      ctx.addIssue({
        code: 'custom',
        path: ['playwrightWorkers'],
        message: 'playwright workers cannot exceed the vCPU allocation',
      });
    }
  });
export type CiLimits = z.infer<typeof CiLimitsSchema>;

function checkSuiteReferences(
  profile: {
    commands: readonly CiCommand[];
    suites: readonly CiSuite[];
    limits: CiLimits;
  },
  ctx: z.RefinementCtx,
): void {
  const commands = new Map(profile.commands.map((command) => [command.id, command]));
  const referenced = new Set<string>();
  profile.suites.forEach((suite, suiteIndex) => {
    suite.commandIds.forEach((commandId, commandIndex) => {
      referenced.add(commandId);
      const command = commands.get(commandId);
      const path = ['suites', suiteIndex, 'commandIds', commandIndex];
      if (!command) {
        ctx.addIssue({ code: 'custom', path, message: `unknown command id ${commandId}` });
        return;
      }
      if (command.kind !== suite.kind) {
        ctx.addIssue({
          code: 'custom',
          path,
          message: `command ${commandId} kind ${command.kind} does not match suite kind ${suite.kind}`,
        });
      }
      if (command.timeoutMinutes > suite.hardLimitMinutes) {
        ctx.addIssue({
          code: 'custom',
          path,
          message: `command ${commandId} timeout exceeds the suite hard limit`,
        });
      }
    });
    if (suite.hardLimitMinutes > profile.limits.timeoutMinutes) {
      ctx.addIssue({
        code: 'custom',
        path: ['suites', suiteIndex, 'hardLimitMinutes'],
        message: 'suite hard limit exceeds the profile timeout',
      });
    }
  });
  for (const commandId of commands.keys()) {
    if (!referenced.has(commandId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['commands'],
        message: `command ${commandId} is not referenced by any suite`,
      });
    }
  }
}

function checkConditionalRules(
  profile: { suites: readonly CiSuite[]; conditionalRules: readonly ConditionalRule[] },
  ctx: z.RefinementCtx,
): void {
  const suiteIds = new Set(profile.suites.map((suite) => suite.id));
  const conditionalSuites = new Set(
    profile.suites.filter((suite) => suite.conditional).map((suite) => suite.id),
  );
  const ruled = new Set<string>();
  profile.conditionalRules.forEach((rule, ruleIndex) => {
    rule.suiteIds.forEach((suiteId, suiteIndex) => {
      ruled.add(suiteId);
      const path = ['conditionalRules', ruleIndex, 'suiteIds', suiteIndex];
      if (!suiteIds.has(suiteId)) {
        ctx.addIssue({ code: 'custom', path, message: `unknown suite id ${suiteId}` });
      } else if (!conditionalSuites.has(suiteId)) {
        ctx.addIssue({
          code: 'custom',
          path,
          message: `suite ${suiteId} is governed by a rule but is not marked conditional`,
        });
      }
    });
  });
  for (const suiteId of conditionalSuites) {
    if (!ruled.has(suiteId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['suites'],
        message: `suite ${suiteId} is conditional but no rule governs it`,
      });
    }
  }
}

export const CiProfileSchema = z
  .strictObject({
    version: z.literal(CI_PROFILE_SCHEMA_VERSION),
    name: ProfileNameSchema,
    policyVersion: PolicyVersionSchema,
    commands: z.array(CiCommandSchema).min(1),
    suites: z.array(CiSuiteSchema).min(1),
    conditionalRules: z.array(ConditionalRuleSchema),
    runtime: CiRuntimeSchema,
    image: CiImageSchema,
    limits: CiLimitsSchema,
    env: SanitizedEnvSchema,
  })
  .superRefine((profile, ctx) => {
    if (!uniqueStrings(profile.commands.map((command) => command.id))) {
      ctx.addIssue({ code: 'custom', path: ['commands'], message: 'duplicate command ids' });
    }
    if (!uniqueStrings(profile.suites.map((suite) => suite.id))) {
      ctx.addIssue({ code: 'custom', path: ['suites'], message: 'duplicate suite ids' });
    }
    if (!uniqueStrings(profile.conditionalRules.map((rule) => rule.id))) {
      ctx.addIssue({ code: 'custom', path: ['conditionalRules'], message: 'duplicate rule ids' });
    }
    checkSuiteReferences(profile, ctx);
    checkConditionalRules(profile, ctx);
  });
export type CiProfile = z.infer<typeof CiProfileSchema>;
