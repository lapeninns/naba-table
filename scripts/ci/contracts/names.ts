import type { ProfileName } from './primitives';

/** Check-run names, workflow display names and GitHub identities shared by every workstream. */

export const LOCAL_CHECK_NAME_PREFIX = 'Local CI / ';

export function localCheckName(profile: ProfileName): `Local CI / ${ProfileName}` {
  return `${LOCAL_CHECK_NAME_PREFIX}${profile}` as `Local CI / ${ProfileName}`;
}

export const RELEASE_GATE_CHECK_NAME = 'Release gate' as const;

export const SHUFFLE_SEEDS = [20260715, 20260716, 20260717] as const;
export type ShuffleSeed = (typeof SHUFFLE_SEEDS)[number];

export function shuffleSeedCheckName(seed: ShuffleSeed): `Shuffle seed ${ShuffleSeed}` {
  return `Shuffle seed ${seed}`;
}

export const COMPATIBILITY_CHECK_NAMES = [
  'Full Vitest suite',
  'Fast static gates',
  'Coverage and performance evidence',
  'Browser smoke packs',
  'Primitive coverage',
  'Shuffle seed 20260715',
  'Shuffle seed 20260716',
  'Shuffle seed 20260717',
] as const;
export type CompatibilityCheckName = (typeof COMPATIBILITY_CHECK_NAMES)[number];

export const HOSTED_FALLBACK_WORKFLOW_NAME = 'Hosted profile fallback' as const;

export const GITHUB_ENVIRONMENTS = [
  'Staging',
  'Production',
  'CI fallback',
  'Monitoring',
  'Backup',
  'Recovery',
] as const;
export type GitHubEnvironment = (typeof GITHUB_ENVIRONMENTS)[number];

export const GITHUB_APPS = {
  localCi: {
    slug: 'nabatable-local-ci',
    host: 'mac-controller',
    permissions: {
      checks: 'write',
      metadata: 'read',
      contents: 'read',
      pull_requests: 'read',
      actions: 'read',
    },
  },
  dispatch: {
    slug: 'nabatable-ci-dispatch',
    host: 'cloudflare-worker',
    permissions: {
      actions: 'write',
      metadata: 'read',
      contents: 'read',
      pull_requests: 'read',
      checks: 'read',
    },
  },
} as const;

export const RUNTIME_ENV_CONTRACT = [
  'MONITORING_TOKEN',
  'NABATABLE_SOURCE_REVISION',
  'NABATABLE_BUILD_ID',
] as const;
