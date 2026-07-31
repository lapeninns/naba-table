import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const booleanStringOptional = booleanString.optional();

const normalizeOptionalUrl = (value: unknown) =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value;

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  z.string().url().optional(),
);

const appEnvSchema = z.enum(['development', 'staging', 'production', 'test']);

export const PUBLIC_ENV_SECRET_PATTERNS = [
  'SERVICE_ROLE',
  'SECRET',
  'TOKEN',
  'PASSWORD',
  'PRIVATE_KEY',
  'DATABASE_URL',
] as const;

export const PUBLIC_ENV_ALLOWLIST = new Set([
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_VERSION',
  'NEXT_PUBLIC_BOOKING_PENDING_GRACE_MINUTES',
  'NEXT_PUBLIC_DEFAULT_RESTAURANT_ID',
  'NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG',
  'NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG_FALLBACK',
  'NEXT_PUBLIC_FORCE_PASSWORD_SIGNIN',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_RESERVE_V2',
  'NEXT_PUBLIC_ROOT_DOMAIN',
  'NEXT_PUBLIC_SITE_ANALYTICS_WRITE_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
]);

export function findBlockedPublicEnvKeys(input: Record<string, string | undefined>): string[] {
  return Object.keys(input)
    .filter((key) => key.startsWith('NEXT_PUBLIC_'))
    .filter((key) => !PUBLIC_ENV_ALLOWLIST.has(key))
    .filter((key) => PUBLIC_ENV_SECRET_PATTERNS.some((pattern) => key.includes(pattern)))
    .sort();
}

const baseEnvSchema = z
  .object({
    APP_ENV: appEnvSchema.default('development'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    ALLOW_PROD_RESOURCES_IN_NONPROD: booleanStringOptional,
    ALLOW_MEMORY_RATE_LIMIT_IN_PROD: booleanStringOptional,
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    /** Supabase read-replica API URL (same project keys). Service-role server client only */
    SUPABASE_READ_REPLICA_URL: z.string().url().optional(),
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
    PLATFORM_REPLY_TO_EMAIL: z.string().email().optional(),
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
    TWILIO_WHATSAPP_SENDER: z
      .string()
      .regex(/^\+[1-9][0-9]{6,14}$/)
      .optional(),
    TWILIO_WHATSAPP_BOOKING_CONFIRMATION_CONTENT_SID: z.string().min(1).optional(),
    TWILIO_WHATSAPP_BOOKING_UPDATE_CONTENT_SID: z.string().min(1).optional(),
    TWILIO_WHATSAPP_BOOKING_CANCELLATION_CONTENT_SID: z.string().min(1).optional(),
    TWILIO_WHATSAPP_RESTAURANT_CANCELLATION_CONTENT_SID: z.string().min(1).optional(),
    TWILIO_WHATSAPP_REVIEW_REQUEST_CONTENT_SID: z.string().min(1).optional(),
    TWILIO_WHATSAPP_MANAGER_SUMMARY_CONTENT_SID: z.string().min(1).optional(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    TURNSTILE_EXPECTED_HOSTNAME: z.string().min(1).optional(),
    AUTH_AUDIT_HASH_SECRET: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(1).optional(),
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
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
    POSTHOG_CLI_API_KEY: z.string().min(1).optional(),
    POSTHOG_CLI_PROJECT_ID: z.string().min(1).optional(),
    POSTHOG_SOURCEMAP_UPLOAD: booleanStringOptional,
    ERROR_INSIGHT_RECEIVER_TOKEN: z.string().min(32).optional(),
    ERROR_INSIGHT_GITHUB_TOKEN: z.string().min(1).optional(),
    ERROR_INSIGHT_GITHUB_REPOSITORY: z
      .string()
      .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)
      .optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_BUSINESS_CLIENT_ID: optionalString,
    GOOGLE_BUSINESS_CLIENT_SECRET: optionalString,
    GOOGLE_BUSINESS_REDIRECT_URI: optionalUrl,
    GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY: optionalString,
    GOOGLE_BUSINESS_PROFILE_CLIENT_ID: optionalString,
    GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET: optionalString,
    GOOGLE_BUSINESS_PROFILE_REDIRECT_URI: optionalUrl,
    GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY: optionalString,
    GOOGLE_CLOUD_QUOTA_PROJECT: z.string().min(1).optional(),
    SITE_URL: z.preprocess(normalizeOptionalUrl, z.string().url().optional()),
    BASE_URL: z.preprocess(normalizeOptionalUrl, z.string().url().optional()),
    ANALYZE: booleanStringOptional,
    CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL: z.string().url().optional(),
    CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN: optionalString,
    BOOKING_SHORT_LINKS_BASE_URL: z.string().url().optional(),
    BOOKING_SHORT_LINKS_INTERNAL_URL: z.string().url().optional(),
    BOOKING_SHORT_LINKS_INTERNAL_TOKEN: z.string().min(1).optional(),
    DUAL_SYNC_FAILURE_WEBHOOK_URL: z.string().url().startsWith('https://').optional(),
    NABAPRESENCE_SERVICE_JWT_PUBLIC_KEY: optionalString,
    NABAPRESENCE_SERVICE_JWT_KEY_ID: optionalString,
    NABAPRESENCE_SERVICE_JWT_ISSUER: optionalString,
    ALLOCATIONS_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).optional(),
    // Strategic demand profiles no longer loaded from disk
    OPS_SUMMARY_CACHE_TTL_MS: z.coerce.number().int().min(0).max(600000).optional(),
    OPS_CHANGES_CACHE_TTL_MS: z.coerce.number().int().min(0).max(600000).optional(),
    OPS_RESTAURANT_META_CACHE_TTL_MS: z.coerce.number().int().min(0).max(3600000).optional(),
    OPS_CACHE_MAX_ENTRIES: z.coerce.number().int().min(1).max(500).optional(),
    DEBUG_CAPACITY_PROFILING: booleanStringOptional,
    STRATEGIC_SCARCITY_WEIGHT: z.coerce.number().min(0).max(1000).optional(),
    STRATEGIC_DEMAND_MULTIPLIER_OVERRIDE: z.coerce.number().min(0).max(10).optional(),
    STRATEGIC_FUTURE_CONFLICT_PENALTY: z.coerce.number().min(0).max(100000).optional(),
    STRATEGIC_DEMAND_PROFILE_PATH: z.string().optional(),
  })
  .passthrough();

const productionEnvSchema = baseEnvSchema
  .extend({
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM: z.string().email(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
    TURNSTILE_SECRET_KEY: z.string().min(1),
    AUTH_AUDIT_HASH_SECRET: z.string().min(1),
    CRON_SECRET: z.string().min(1),
  })
  .superRefine((env, ctx) => {
    const hasCloudflareGateway =
      Boolean(env.CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL) &&
      Boolean(env.CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN);
    if (!hasCloudflareGateway && env.ALLOW_MEMORY_RATE_LIMIT_IN_PROD !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL'],
        message:
          'Production rate limiting requires Cloudflare gateway credentials or ALLOW_MEMORY_RATE_LIMIT_IN_PROD=true.',
      });
    }

    const whatsappKeys = [
      'TWILIO_WHATSAPP_SENDER',
      'TWILIO_WHATSAPP_BOOKING_CONFIRMATION_CONTENT_SID',
      'TWILIO_WHATSAPP_BOOKING_UPDATE_CONTENT_SID',
      'TWILIO_WHATSAPP_BOOKING_CANCELLATION_CONTENT_SID',
      'TWILIO_WHATSAPP_RESTAURANT_CANCELLATION_CONTENT_SID',
      'TWILIO_WHATSAPP_REVIEW_REQUEST_CONTENT_SID',
    ] as const;
    if (whatsappKeys.some((key) => Boolean(env[key]))) {
      for (const key of whatsappKeys) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: 'Production WhatsApp configuration requires sender and all five event SIDs.',
          });
        }
      }
    }
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
