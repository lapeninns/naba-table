import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const booleanStringOptional = booleanString.optional();

const normalizeOptionalUrl = (value: unknown) =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value;

const appEnvSchema = z.enum(['development', 'staging', 'production', 'test']);

const baseEnvSchema = z
  .object({
    APP_ENV: appEnvSchema.default('development'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    ALLOW_PROD_RESOURCES_IN_NONPROD: booleanStringOptional,
    ALLOW_MEMORY_RATE_LIMIT_IN_PROD: booleanStringOptional,
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    /** Supabase read-replica API URL (same project keys). Service-role server client only; see supabase/AGENTS.md */
    SUPABASE_READ_REPLICA_URL: z.string().url().optional(),
    /** When true with SUPABASE_READ_REPLICA_URL, `getServiceSupabaseClient` uses the replica URL (non-production targets only). */
    FEATURE_SERVICE_CLIENT_USE_READ_REPLICA: booleanStringOptional,
    /** Optional banner text shown at the top of the Ops app (e.g. "Preview: production read replica"). */
    OPS_ENV_BANNER: z.string().max(500).optional(),
    PRODUCTION_SUPABASE_URL: z.string().url().optional(),
    PRODUCTION_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    PRODUCTION_SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    PRODUCTION_BOOKING_API_BASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    NEXT_PUBLIC_DEFAULT_RESTAURANT_ID: z.string().uuid().optional(),
    NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG: z.string().optional(),
    NEXT_PUBLIC_RESERVE_V2: booleanStringOptional,
    NEXT_PUBLIC_BOOKING_PENDING_GRACE_MINUTES: z.coerce.number().int().min(0).max(120).optional(),
    NEXT_PUBLIC_APP_VERSION: z.string().optional(),
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: z.string().optional(),
    RESERVE_API_BASE_URL: z.string().min(1).optional(),
    RESERVE_API_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    RESERVE_ROUTER_BASE_PATH: z.string().optional(),
    RESERVE_BUILD_OUT_DIR: z.string().optional(),
    RESERVE_RESERVATION_DEFAULT_DURATION_MINUTES: z.coerce.number().int().positive().optional(),
    RESERVE_RESERVATION_INTERVAL_MINUTES: z.coerce.number().int().positive().optional(),
    RESERVE_RESERVATION_OPEN: z.string().optional(),
    RESERVE_RESERVATION_TIMEZONE: z.string().optional(),
    RESERVE_RESERVATION_UNAVAILABLE_TOOLTIP: z.string().optional(),
    BOOKING_DEFAULT_RESTAURANT_ID: z.string().uuid().optional(),
    NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG_FALLBACK: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM: z.string().email().optional(),
    RESEND_USE_MOCK: booleanStringOptional,
    RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
    TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
    TWILIO_API_KEY_SID: z.string().min(1).optional(),
    TWILIO_API_KEY_SECRET: z.string().min(1).optional(),
    TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
    TWILIO_MESSAGING_SERVICE_SID: z.string().min(1).optional(),
    TWILIO_SHORTEN_URLS: booleanStringOptional,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    TURNSTILE_EXPECTED_HOSTNAME: z.string().min(1).optional(),
    AUTH_AUDIT_HASH_SECRET: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(1).optional(),
    FEATURE_GUEST_LOOKUP_POLICY: booleanStringOptional,
    FEATURE_OPS_GUARD_V2: booleanStringOptional,
    FEATURE_BOOKING_PAST_TIME_BLOCKING: booleanStringOptional,
    FEATURE_BOOKING_VALIDATION_UNIFIED: booleanStringOptional,
    FEATURE_OPS_BOOKING_LIFECYCLE_V2: booleanStringOptional,
    FEATURE_ALLOCATIONS_DUAL_WRITE: booleanStringOptional,
    FEATURE_ALLOCATOR_MERGES_ENABLED: booleanStringOptional,
    FEATURE_ALLOCATOR_REQUIRE_ADJACENCY: booleanStringOptional,
    FEATURE_ALLOCATOR_K_MAX: z.coerce.number().int().min(1).max(5).optional(),
    // Adjacency requirement is now fixed (connected); mode/min-party flags removed
    FEATURE_MANUAL_ASSIGNMENT_MAX_SLACK: z.coerce.number().int().min(0).max(12).optional(),
    FEATURE_MANUAL_ASSIGNMENT_SESSION_ENABLED: booleanStringOptional,
    FEATURE_MANUAL_ASSIGNMENT_SNAPSHOT_VALIDATION: booleanStringOptional,
    FEATURE_HOLDS_ENABLED: booleanStringOptional,
    FEATURE_HOLDS_STRICT_CONFLICTS_ENABLED: booleanStringOptional,
    FEATURE_DB_STRICT_CONSTRAINTS: booleanStringOptional,
    // Holds TTL and rate limiting now fixed constants
    FEATURE_STATUS_TRIGGERS: booleanStringOptional,
    FEATURE_EDIT_SCHEDULE_PARITY: booleanStringOptional,
    FEATURE_SELECTOR_SCORING: booleanStringOptional,
    FEATURE_SELECTOR_LOOKAHEAD: booleanStringOptional,
    FEATURE_SELECTOR_LOOKAHEAD_WINDOW_MINUTES: z.coerce.number().int().min(5).max(480).optional(),
    FEATURE_SELECTOR_LOOKAHEAD_PENALTY_WEIGHT: z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .optional(),
    FEATURE_SELECTOR_LOOKAHEAD_BLOCK_THRESHOLD: z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .optional(),
    FEATURE_COMBINATION_PLANNER: booleanStringOptional,
    FEATURE_PLANNER_TIME_PRUNING_ENABLED: booleanStringOptional,
    // Adjacency graph is always treated as connected/undirected
    FEATURE_SELECTOR_MAX_PLANS_PER_SLACK: z.coerce.number().int().min(1).max(500).optional(),
    FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS: z.coerce
      .number()
      .int()
      .min(1)
      .max(5000)
      .optional(),
    FEATURE_SELECTOR_ENUMERATION_TIMEOUT_MS: z.coerce.number().int().min(50).max(10000).optional(),
    FEATURE_CONTEXT_QUERY_PADDING_MINUTES: z.coerce.number().int().min(0).max(240).optional(),
    FEATURE_ADJACENCY_VALIDATION: booleanStringOptional,
    FEATURE_ADJACENCY_QUERY_UNDIRECTED: booleanStringOptional,
    FEATURE_OPS_METRICS: booleanStringOptional,
    FEATURE_OPS_REJECTION_ANALYTICS: booleanStringOptional,
    FEATURE_EMAIL_QUEUE_ENABLED: booleanStringOptional,
    FEATURE_POLICY_REQUOTE_ENABLED: booleanStringOptional,
    // Allocator v2 is the only path; legacy/shadow flags removed
    FEATURE_ALLOCATOR_SERVICE_FAIL_HARD: booleanStringOptional,
    NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN: booleanStringOptional,
    NEXT_PUBLIC_FEATURE_MANUAL_SESSION_ENABLED: booleanStringOptional,
    BOOKING_PAST_TIME_GRACE_MINUTES: z.coerce.number().int().min(0).max(60).optional(),
    GUEST_LOOKUP_PEPPER: z.string().min(1).optional(),
    SESSION_RECOVERY_ACCESS_TOKEN_SECRET: z.string().min(1).optional(),
    SESSION_RECOVERY_ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(2_592_000)
      .optional(),
    NEXT_PUBLIC_SITE_ANALYTICS_WRITE_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_BUSINESS_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_BUSINESS_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_BUSINESS_REDIRECT_URI: z.string().url().optional(),
    GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY: z.string().min(1).optional(),
    GOOGLE_BUSINESS_PROFILE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_BUSINESS_PROFILE_REDIRECT_URI: z.string().url().optional(),
    GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY: z.string().min(1).optional(),
    GOOGLE_CLOUD_QUOTA_PROJECT: z.string().min(1).optional(),
    SITE_URL: z.preprocess(normalizeOptionalUrl, z.string().url().optional()),
    BASE_URL: z.preprocess(normalizeOptionalUrl, z.string().url().optional()),
    ANALYZE: booleanStringOptional,
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL: z.string().url().optional(),
    CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN: z.string().min(1).optional(),
    BOOKING_SHORT_LINKS_BASE_URL: z.string().url().optional(),
    BOOKING_SHORT_LINKS_INTERNAL_URL: z.string().url().optional(),
    BOOKING_SHORT_LINKS_INTERNAL_TOKEN: z.string().min(1).optional(),
    ALLOCATIONS_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).optional(),
    // Strategic demand profiles no longer loaded from disk
    OPS_SUMMARY_CACHE_TTL_MS: z.coerce.number().int().min(0).max(600000).optional(),
    OPS_CHANGES_CACHE_TTL_MS: z.coerce.number().int().min(0).max(600000).optional(),
    OPS_RESTAURANT_META_CACHE_TTL_MS: z.coerce.number().int().min(0).max(3600000).optional(),
    OPS_CACHE_MAX_ENTRIES: z.coerce.number().int().min(1).max(500).optional(),
    // Auto-assignment feature: run allocator after booking creation and suppress initial pending email
    FEATURE_AUTO_ASSIGN_ON_BOOKING: booleanStringOptional,
    FEATURE_AUTO_ASSIGN_MAX_RETRIES: z.coerce.number().int().min(0).max(10).optional(),
    FEATURE_AUTO_ASSIGN_RETRY_DELAYS_MS: z.string().optional(),
    FEATURE_AUTO_ASSIGN_START_CUTOFF_MINUTES: z.coerce.number().int().min(0).max(240).optional(),
    FEATURE_AUTO_ASSIGN_CREATED_EMAIL_DEFER_MINUTES: z.coerce
      .number()
      .int()
      .min(0)
      .max(120)
      .optional(),
    // Auto-assign retry policy unified; v2 flag removed
    FEATURE_INLINE_AUTO_ASSIGN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).optional(),
    DEBUG_CAPACITY_PROFILING: booleanStringOptional,
    STRATEGIC_SCARCITY_WEIGHT: z.coerce.number().min(0).max(1000).optional(),
    STRATEGIC_DEMAND_MULTIPLIER_OVERRIDE: z.coerce.number().min(0).max(10).optional(),
    STRATEGIC_FUTURE_CONFLICT_PENALTY: z.coerce.number().min(0).max(100000).optional(),
    STRATEGIC_DEMAND_PROFILE_PATH: z.string().optional(),
  })
  .passthrough();

const productionEnvSchema = baseEnvSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM: z.string().email(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  AUTH_AUDIT_HASH_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

const developmentEnvSchema = baseEnvSchema;
const testEnvSchema = baseEnvSchema;

export const envSchemas = {
  production: productionEnvSchema,
  development: developmentEnvSchema,
  test: testEnvSchema,
} as const;

export type EnvSchemaTarget = keyof typeof envSchemas;

export function resolveEnvSchemaTarget(
  input: Partial<Record<'NODE_ENV' | 'APP_ENV' | 'VERCEL_ENV', string | undefined>>,
): EnvSchemaTarget {
  const nodeEnv = input.NODE_ENV ?? 'development';
  if (nodeEnv === 'test') {
    return 'test';
  }

  const appEnv = input.APP_ENV ?? 'development';
  const vercelEnv = input.VERCEL_ENV;
  const treatAsProdTarget = appEnv === 'production' || vercelEnv === 'production';

  return treatAsProdTarget ? 'production' : 'development';
}

export type Env = z.infer<typeof baseEnvSchema>;
