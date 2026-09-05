import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { PLACEHOLDER_PATTERN, RepositoryIdSchema, isPlaceholder } from './primitives';
import { assertWith, uniqueStrings, validateWith, type ValidationResult } from './validation';

export const TRUST_ROUTES = ['local', 'hosted', 'reject-fork'] as const;
export type TrustRoute = (typeof TRUST_ROUTES)[number];

export const TRUST_POLICY_PATH = 'config/ci/trust-policy.json';

const GitHubLoginSchema = z
  .string()
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?(?:\[bot\])?$/u, 'expected a GitHub login');

const BOT_LOGIN = /\[bot\]$/u;

/**
 * Only routes that never grant local execution are accepted for automation
 * and unknown actors: the schema itself rules out `local` there.
 */
export const TrustPolicySchema = z
  .strictObject({
    version: z.literal(1),
    trustedRepositoryId: z.union([
      z.string().regex(PLACEHOLDER_PATTERN),
      RepositoryIdSchema,
      z.string().regex(/^[1-9]\d*$/u, 'expected a numeric repository id'),
    ]),
    actorPolicy: z.strictObject({
      /** Humans explicitly allowed to have their same-repo work run on the Mac. */
      localActors: z.array(GitHubLoginSchema),
      automationIdentities: z.array(GitHubLoginSchema),
      automationRoute: z.literal('hosted'),
      unknownActorRoute: z.literal('hosted'),
    }),
    ignoredSignals: z.array(
      z.enum(['labels', 'branchNames', 'commitMessages', 'pullRequestTitles']),
    ),
  })
  .superRefine((policy, ctx) => {
    const { localActors, automationIdentities } = policy.actorPolicy;
    if (!uniqueStrings(localActors)) {
      ctx.addIssue({
        code: 'custom',
        path: ['actorPolicy', 'localActors'],
        message: 'duplicate local actors',
      });
    }
    const automation = new Set(automationIdentities);
    localActors.forEach((login, index) => {
      if (automation.has(login) || BOT_LOGIN.test(login)) {
        ctx.addIssue({
          code: 'custom',
          path: ['actorPolicy', 'localActors', index],
          message: `automation identity ${login} can never be routed locally`,
        });
      }
    });
  });
export type TrustPolicy = z.infer<typeof TrustPolicySchema>;

export const ACTOR_TYPES = ['User', 'Bot', 'Organization'] as const;

/**
 * Everything the classifier is allowed to look at. Labels, branch names and
 * titles are deliberately absent: they are attacker-controlled on a PR and
 * are stripped by the schema if a caller passes them anyway.
 */
export const TrustRequestSchema = z.object({
  baseRepositoryId: RepositoryIdSchema,
  headRepositoryId: RepositoryIdSchema,
  actor: z.object({
    login: GitHubLoginSchema,
    type: z.enum(ACTOR_TYPES),
  }),
  event: z.enum(['pull_request', 'push', 'schedule', 'workflow_dispatch']).optional(),
});
export type TrustRequest = z.infer<typeof TrustRequestSchema>;

export interface TrustDecision {
  readonly route: TrustRoute;
  readonly reason:
    | 'fork-head-repository'
    | 'repository-not-trusted'
    | 'trust-policy-unconfigured'
    | 'automation-identity'
    | 'actor-not-in-local-allowlist'
    | 'trusted-local-actor';
}

export function isTrustPolicyConfigured(policy: TrustPolicy): boolean {
  return !isPlaceholder(policy.trustedRepositoryId);
}

function trustedRepositoryId(policy: TrustPolicy): string | null {
  if (isPlaceholder(policy.trustedRepositoryId)) {
    return null;
  }
  return String(policy.trustedRepositoryId);
}

function isAutomation(policy: TrustPolicy, actor: TrustRequest['actor']): boolean {
  return (
    actor.type !== 'User' ||
    BOT_LOGIN.test(actor.login) ||
    policy.actorPolicy.automationIdentities.includes(actor.login)
  );
}

/**
 * Pure classification. It performs no I/O, so a fork is rejected before any
 * fetch of PR contents can happen. Order matters: fork check first, then
 * repository identity, then actor policy.
 */
export function classifyWithReason(request: TrustRequest, policy: TrustPolicy): TrustDecision {
  const parsed = assertWith(TrustRequestSchema, request, 'TrustRequest');
  if (parsed.headRepositoryId !== parsed.baseRepositoryId) {
    return { route: 'reject-fork', reason: 'fork-head-repository' };
  }
  const trusted = trustedRepositoryId(policy);
  if (trusted === null) {
    return { route: 'hosted', reason: 'trust-policy-unconfigured' };
  }
  if (String(parsed.baseRepositoryId) !== trusted) {
    return { route: 'reject-fork', reason: 'repository-not-trusted' };
  }
  if (isAutomation(policy, parsed.actor)) {
    return { route: policy.actorPolicy.automationRoute, reason: 'automation-identity' };
  }
  if (!policy.actorPolicy.localActors.includes(parsed.actor.login)) {
    return { route: policy.actorPolicy.unknownActorRoute, reason: 'actor-not-in-local-allowlist' };
  }
  return { route: 'local', reason: 'trusted-local-actor' };
}

export function classify(request: TrustRequest, policy: TrustPolicy): TrustRoute {
  return classifyWithReason(request, policy).route;
}

export type AdmissionResult<T> =
  | { readonly admitted: true; readonly decision: TrustDecision; readonly value: T }
  | { readonly admitted: false; readonly decision: TrustDecision };

/**
 * Runs `execute` (the first step that touches the network: fetching refs,
 * PR metadata, ...) only when the request is routed locally. Everything
 * else is returned without `execute` ever being invoked.
 */
export async function admitForLocalExecution<T>(
  request: TrustRequest,
  policy: TrustPolicy,
  execute: (request: TrustRequest) => Promise<T>,
): Promise<AdmissionResult<T>> {
  const decision = classifyWithReason(request, policy);
  if (decision.route !== 'local') {
    return { admitted: false, decision };
  }
  return { admitted: true, decision, value: await execute(request) };
}

export function validateTrustPolicy(input: unknown): ValidationResult<TrustPolicy> {
  return validateWith(TrustPolicySchema, input);
}

export function loadTrustPolicy(
  repositoryRoot: string = process.cwd(),
  relativePath: string = TRUST_POLICY_PATH,
): TrustPolicy {
  const raw = readFileSync(path.resolve(repositoryRoot, relativePath), 'utf8');
  return assertWith(TrustPolicySchema, JSON.parse(raw), `trust policy ${relativePath}`);
}
