import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const booleanStringOptional = booleanString.optional();

const normalizeOptionalUrl = (value: unknown) =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

const baseEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    NEXT_PUBLIC_DEFAULT_RESTAURANT_ID: z.string().uuid().optional(),
    NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG: z.string().optional(),
    NEXT_PUBLIC_RESERVE_V2: booleanStringOptional,
    NEXT_PUBLIC_ENABLE_TEST_UI: booleanStringOptional,
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
    LOYALTY_PILOT_RESTAURANT_IDS: z.string().optional(),
    ENABLE_TEST_API: booleanStringOptional,
    FEATURE_GUEST_LOOKUP_POLICY: booleanStringOptional,
    FEATURE_OPS_GUARD_V2: booleanStringOptional,
    FEATURE_BOOKING_PAST_TIME_BLOCKING: booleanStringOptional,
    FEATURE_BOOKING_VALIDATION_UNIFIED: booleanStringOptional,
    FEATURE_OPS_BOOKING_LIFECYCLE_V2: booleanStringOptional,
    FEATURE_ALLOCATIONS_DUAL_WRITE: booleanStringOptional,
    FEATURE_RPC_ASSIGN_ATOMIC: booleanStringOptional,
    FEATURE_ASSIGN_ATOMIC: booleanStringOptional,
    FEATURE_STATUS_TRIGGERS: booleanStringOptional,
    FEATURE_EDIT_SCHEDULE_PARITY: booleanStringOptional,
    FEATURE_SELECTOR_SCORING: booleanStringOptional,
    FEATURE_ADJACENCY_VALIDATION: booleanStringOptional,
    FEATURE_OPS_METRICS: booleanStringOptional,
    NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN: booleanStringOptional,
    BOOKING_PAST_TIME_GRACE_MINUTES: z.coerce.number().int().min(0).max(60).optional(),
    GUEST_LOOKUP_PEPPER: z.string().min(1).optional(),
    TEST_ROUTE_API_KEY: z.string().optional(),
    TEST_EMAIL_ACCESS_TOKEN: z.string().optional(),
    TEST_EMAIL_RATE_LIMIT: z.coerce.number().int().nonnegative().optional(),
    TEST_EMAIL_ALLOWED_ORIGINS: z.string().optional(),
    NEXT_PUBLIC_SITE_ANALYTICS_WRITE_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    SITE_URL: z.preprocess(normalizeOptionalUrl, z.string().url().optional()),
    BASE_URL: z.preprocess(normalizeOptionalUrl, z.string().url().optional()),
    ANALYZE: booleanStringOptional,
    PLAYWRIGHT_TEST_API_KEY: z.string().optional(),
    PLAYWRIGHT_TEST_EMAIL: z.string().optional(),
    PLAYWRIGHT_TEST_PASSWORD: z.string().optional(),
    PLAYWRIGHT_TEST_IFRAME: booleanString.optional(),
    PLAYWRIGHT_TEST_OFFLINE: booleanString.optional(),
    PLAYWRIGHT_TEST_AUTH_FLOW: z.enum(["legacy", "reserve-v2"]).optional(),
    PLAYWRIGHT_AUTH_EMAIL: z.string().email().optional(),
    PLAYWRIGHT_AUTH_NAME: z.string().optional(),
    PLAYWRIGHT_AUTH_PASSWORD: z.string().optional(),
    PLAYWRIGHT_AUTH_PHONE: z.string().optional(),
    PLAYWRIGHT_AUTH_REFRESH: z.string().optional(),
    PLAYWRIGHT_AUTH_TOKEN: z.string().optional(),
    ROUTE_COMPAT_WINDOW_DAYS: z.coerce.number().int().positive().optional(),
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    AVAILABILITY_CACHE_TTL_SECONDS: z.coerce.number().int().positive().optional(),
    ENABLE_AVAILABILITY_CACHE: booleanStringOptional,
  })
  .passthrough();

// In production we require public URLs to be present (they may be derived from VERCEL_URL
// upstream in lib/env.ts). Email (Resend) is conditionally required: if either
// RESEND_API_KEY or RESEND_FROM is provided, both must be set.
const productionEnvSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (!env.NEXT_PUBLIC_APP_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['NEXT_PUBLIC_APP_URL'],
      message: 'NEXT_PUBLIC_APP_URL must be set in production (or derivable).',
    });
  }

  if (!env.NEXT_PUBLIC_SITE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['NEXT_PUBLIC_SITE_URL'],
      message: 'NEXT_PUBLIC_SITE_URL must be set in production (or derivable).',
    });
  }

  const hasResendKey = typeof env.RESEND_API_KEY === 'string' && env.RESEND_API_KEY.length > 0;
  const hasResendFrom = typeof env.RESEND_FROM === 'string' && env.RESEND_FROM.length > 0;

  if (hasResendKey !== hasResendFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: hasResendKey ? ['RESEND_FROM'] : ['RESEND_API_KEY'],
      message: 'RESEND_API_KEY and RESEND_FROM must both be set together in production.',
    });
  }
});

const developmentEnvSchema = baseEnvSchema;
const testEnvSchema = baseEnvSchema;

export const envSchemas = {
  production: productionEnvSchema,
  development: developmentEnvSchema,
  test: testEnvSchema,
} as const;

export type Env = z.infer<typeof baseEnvSchema>;
