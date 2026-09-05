import { PRODUCTION_SUPABASE_PROJECT_REF } from './staging-hosts';

import type { DeployTarget } from './evidence';

/**
 * Deployment identity descriptor per target. Every value here is compared by
 * validate-separation so staging can never share a database, host or project with
 * production. REPLACE_ME_* values are placeholders that fail validation for their target.
 */
export type EnvironmentDescriptor = {
  readonly githubEnvironment: string;
  readonly publicUrl: string;
  readonly opsUrl: string;
  readonly supabaseProjectRef: string;
  readonly vercelProjectId: string;
  readonly vercelTargetFlag: readonly string[];
};

export const STAGING_SUPABASE_PROJECT_REF = 'ndxmivcrehsacuerwxtm';

export const ENVIRONMENTS: Readonly<Record<DeployTarget, EnvironmentDescriptor>> = {
  staging: {
    githubEnvironment: 'Staging',
    publicUrl: 'https://nabatable-staging.vercel.app',
    opsUrl: 'https://nabatable-staging-ops.vercel.app',
    supabaseProjectRef: STAGING_SUPABASE_PROJECT_REF,
    vercelProjectId: 'REPLACE_ME_STAGING_VERCEL_PROJECT_ID',
    // `--target=staging` deploys into the Vercel custom environment named "staging";
    // it never touches the production alias.
    vercelTargetFlag: ['--target=staging'],
  },
  production: {
    githubEnvironment: 'Production',
    publicUrl: 'https://nabatable.com',
    opsUrl: 'https://app.nabatable.com',
    supabaseProjectRef: PRODUCTION_SUPABASE_PROJECT_REF,
    vercelProjectId: 'REPLACE_ME_PRODUCTION_VERCEL_PROJECT_ID',
    vercelTargetFlag: ['--prod'],
  },
};

/** Process env keys whose values identify a deployment target and must not leak across. */
export const TARGET_IDENTITY_ENV_KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_DB_URL',
  'DATABASE_URL',
  'VERCEL_PROJECT_ID',
] as const;
