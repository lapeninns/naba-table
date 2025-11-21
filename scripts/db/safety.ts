export type DbTargetEnv = 'development' | 'staging' | 'test' | 'production';

const NORMALIZED_ENV_MAP: Record<string, DbTargetEnv> = {
  prod: 'production',
  production: 'production',
  stage: 'staging',
  staging: 'staging',
  dev: 'development',
  development: 'development',
  test: 'test',
};

export type DbSafetyCheckInput = {
  appEnv?: string | null;
  targetEnv?: string | null;
  supabaseDbUrl?: string | null;
  productionSupabaseUrl?: string | null;
  allowProdOverride?: boolean;
};

export type DbSafetyCheckResult = {
  targetEnv: DbTargetEnv;
  allowed: boolean;
  reasons: string[];
};

export function normalizeTargetEnv(value?: string | null): DbTargetEnv {
  const normalized = (value ?? '').toLowerCase().trim();
  return NORMALIZED_ENV_MAP[normalized] ?? 'development';
}

export function evaluateDbTargetSafety(input: DbSafetyCheckInput): DbSafetyCheckResult {
  const targetEnv = normalizeTargetEnv(input.targetEnv ?? input.appEnv);
  const reasons: string[] = [];
  const allowProdOverride = Boolean(input.allowProdOverride);
  const supabaseUrl = input.supabaseDbUrl?.trim();

  if (!supabaseUrl) {
    reasons.push('SUPABASE_DB_URL is required for DB operations.');
  }

  if (targetEnv === 'production' && !allowProdOverride) {
    reasons.push('Production target detected. Set ALLOW_PROD_DB_WIPE=true explicitly to proceed.');
  }

  if (targetEnv !== 'production' && !allowProdOverride) {
    if (supabaseUrl && input.productionSupabaseUrl && supabaseUrl === input.productionSupabaseUrl) {
      reasons.push('SUPABASE_DB_URL matches PRODUCTION_SUPABASE_URL while target is non-production. Use a staging/local URL or set ALLOW_PROD_DB_WIPE=true to override (not recommended).');
    }
  }

  return {
    targetEnv,
    allowed: reasons.length === 0,
    reasons,
  };
}
