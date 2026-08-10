import { envSchemas, resolveEnvSchemaTarget, type Env } from '@/config/env.schema';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

const DEFAULT_RESEND_DOMAIN = 'notifications.nabatable.com';
const DEFAULT_RESEND_FROM = `no-reply@${DEFAULT_RESEND_DOMAIN}`;

let cachedEnv: Env | null = null;

function parseEnv(): Env {
  const hasTemplatePlaceholder = (value: string) => /\$\{[^}]+\}/.test(value);

  const resolveVercelUrlTemplate = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed.includes('${VERCEL_URL}')) return trimmed;

    const vercelUrl = process.env.VERCEL_URL?.trim();
    if (!vercelUrl || hasTemplatePlaceholder(vercelUrl)) return null;

    return trimmed.replaceAll('${VERCEL_URL}', vercelUrl);
  };

  const sanitizePublicUrlEnv = (key: 'NEXT_PUBLIC_APP_URL' | 'NEXT_PUBLIC_SITE_URL') => {
    const value = process.env[key];
    if (typeof value !== 'string') return;

    const resolved = resolveVercelUrlTemplate(value);
    if (resolved) {
      process.env[key] = resolved;
    } else {
      delete process.env[key];
    }
  };

  const sanitizeUrlEnv = (key: 'BASE_URL' | 'SITE_URL') => {
    const value = process.env[key];
    if (typeof value === 'string') {
      const resolved = resolveVercelUrlTemplate(value);
      const normalized = resolved?.trim() ?? '';
      if (
        normalized.length === 0 ||
        normalized === '/' ||
        normalized.toLowerCase() === 'undefined'
      ) {
        delete process.env[key];
      } else {
        process.env[key] = normalized;
      }
    }
  };

  sanitizePublicUrlEnv('NEXT_PUBLIC_APP_URL');
  sanitizePublicUrlEnv('NEXT_PUBLIC_SITE_URL');
  sanitizeUrlEnv('BASE_URL');
  sanitizeUrlEnv('SITE_URL');

  const normalizeResendFrom = () => {
    const value = process.env.RESEND_FROM;
    if (!value || value.trim().length === 0) {
      process.env.RESEND_FROM = DEFAULT_RESEND_FROM;
      return;
    }

    const trimmed = value.trim();

    if (!trimmed.includes('@') && trimmed === DEFAULT_RESEND_DOMAIN) {
      process.env.RESEND_FROM = DEFAULT_RESEND_FROM;
    }
  };

  normalizeResendFrom();

  if (!process.env.BASE_URL) {
    const fallback =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? getCanonicalSiteUrl();
    process.env.BASE_URL = fallback;
  }

  if (cachedEnv) {
    return cachedEnv;
  }

  const schemaTarget = resolveEnvSchemaTarget(process.env);
  const schema = envSchemas[schemaTarget] ?? envSchemas.development;

  const result = schema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Environment validation failed at runtime:\n${formatted}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getEnv(): Env {
  return parseEnv();
}

export function resetEnvCache() {
  cachedEnv = null;
}

export const env = {
  get raw(): Env {
    return parseEnv();
  },

  get node() {
    const parsed = parseEnv();
    return {
      env: parsed.NODE_ENV,
      appEnv: parsed.APP_ENV,
    } as const;
  },

  get supabase() {
    const parsed = parseEnv();
    return {
      url: parsed.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    } as const;
  },

  get safety() {
    const parsed = parseEnv();
    return {
      allowProdResourcesInNonProd: parsed.ALLOW_PROD_RESOURCES_IN_NONPROD ?? false,
      productionSupabaseUrl: parsed.PRODUCTION_SUPABASE_URL,
      productionSupabaseAnonKey: parsed.PRODUCTION_SUPABASE_ANON_KEY,
      productionSupabaseServiceRoleKey: parsed.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY,
      productionBookingApiBaseUrl: parsed.PRODUCTION_BOOKING_API_BASE_URL,
      appEnv: parsed.APP_ENV,
      nodeEnv: parsed.NODE_ENV,
    } as const;
  },

  get app() {
    const parsed = parseEnv();
    return {
      url: parsed.NEXT_PUBLIC_APP_URL ?? parsed.NEXT_PUBLIC_SITE_URL ?? getCanonicalSiteUrl(),
      version: parsed.NEXT_PUBLIC_APP_VERSION,
      commitSha: parsed.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    } as const;
  },

  get reserve() {
    const parsed = parseEnv();
    return {
      apiBaseUrl: parsed.RESERVE_API_BASE_URL ?? '/api/v1',
      apiTimeoutMs: parsed.RESERVE_API_TIMEOUT_MS ?? 15_000,
      routerBasePath: parsed.RESERVE_ROUTER_BASE_PATH ?? '/reserve',
      buildOutDir: parsed.RESERVE_BUILD_OUT_DIR,
      defaultDurationMinutes: parsed.RESERVE_RESERVATION_DEFAULT_DURATION_MINUTES ?? 90,
      intervalMinutes:
        parsed.RESERVE_RESERVATION_INTERVAL_MINUTES ?? DEFAULT_RESERVATION_INTERVAL_MINUTES,
      isOpenLabel: parsed.RESERVE_RESERVATION_OPEN,
      timezone: parsed.RESERVE_RESERVATION_TIMEZONE,
      unavailableTooltip: parsed.RESERVE_RESERVATION_UNAVAILABLE_TOOLTIP,
      flags: {
        reserveV2: parsed.NEXT_PUBLIC_RESERVE_V2 ?? false,
      },
    } as const;
  },

  get resend() {
    const parsed = parseEnv();
    const explicitMock =
      typeof parsed.RESEND_USE_MOCK === 'boolean' ? parsed.RESEND_USE_MOCK : null;
    const hasCredentials = Boolean(parsed.RESEND_API_KEY && parsed.RESEND_FROM);
    const defaultUseMock = explicitMock ?? (parsed.NODE_ENV !== 'production' && !hasCredentials);
    return {
      apiKey: parsed.RESEND_API_KEY,
      from: parsed.RESEND_FROM,
      useMock: defaultUseMock,
    } as const;
  },

  get twilio() {
    const parsed = parseEnv();
    const accountSid = parsed.TWILIO_ACCOUNT_SID ?? null;
    const apiKeySid = parsed.TWILIO_API_KEY_SID ?? null;
    const apiKeySecret = parsed.TWILIO_API_KEY_SECRET ?? null;
    const authToken = parsed.TWILIO_AUTH_TOKEN ?? null;
    const messagingServiceSid = parsed.TWILIO_MESSAGING_SERVICE_SID ?? null;
    const shortenUrls = parsed.TWILIO_SHORTEN_URLS ?? false;
    const whatsappSender = parsed.TWILIO_WHATSAPP_SENDER ?? null;
    const whatsappTemplates = {
      bookingConfirmation: parsed.TWILIO_WHATSAPP_BOOKING_CONFIRMATION_CONTENT_SID ?? null,
      bookingUpdate: parsed.TWILIO_WHATSAPP_BOOKING_UPDATE_CONTENT_SID ?? null,
      bookingCancellation: parsed.TWILIO_WHATSAPP_BOOKING_CANCELLATION_CONTENT_SID ?? null,
      restaurantCancellation: parsed.TWILIO_WHATSAPP_RESTAURANT_CANCELLATION_CONTENT_SID ?? null,
      reviewRequest: parsed.TWILIO_WHATSAPP_REVIEW_REQUEST_CONTENT_SID ?? null,
      managerSummary: parsed.TWILIO_WHATSAPP_MANAGER_SUMMARY_CONTENT_SID ?? null,
    } as const;

    return {
      accountSid,
      apiKeySid,
      apiKeySecret,
      authToken,
      messagingServiceSid,
      shortenUrls,
      configured: Boolean(accountSid && apiKeySid && apiKeySecret && messagingServiceSid),
      whatsapp: {
        sender: whatsappSender,
        templates: whatsappTemplates,
        configured: Boolean(
          accountSid &&
          apiKeySid &&
          apiKeySecret &&
          whatsappSender &&
          whatsappTemplates.bookingConfirmation &&
          whatsappTemplates.bookingUpdate &&
          whatsappTemplates.bookingCancellation &&
          whatsappTemplates.restaurantCancellation &&
          whatsappTemplates.reviewRequest,
        ),
      },
    } as const;
  },

  get strategic() {
    const parsed = parseEnv();
    const clamp = (
      value: number | undefined | null,
      min: number,
      max: number,
      fallback: number,
    ) => {
      if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
      return Math.max(min, Math.min(max, value));
    };

    const scarcityWeight = clamp(parsed.STRATEGIC_SCARCITY_WEIGHT, 0, 1000, 22);
    const demandMultiplierOverride =
      typeof parsed.STRATEGIC_DEMAND_MULTIPLIER_OVERRIDE === 'number'
        ? clamp(parsed.STRATEGIC_DEMAND_MULTIPLIER_OVERRIDE, 0, 10, NaN)
        : null;
    const futureConflictPenalty =
      typeof parsed.STRATEGIC_FUTURE_CONFLICT_PENALTY === 'number'
        ? clamp(parsed.STRATEGIC_FUTURE_CONFLICT_PENALTY, 0, 100_000, NaN)
        : null;

    return {
      scarcityWeight,
      demandProfilePath: parsed.STRATEGIC_DEMAND_PROFILE_PATH,
      demandMultiplierOverride,
      futureConflictPenalty,
    } as const;
  },

  get security() {
    const parsed = parseEnv();
    return {
      guestLookupPepper: parsed.GUEST_LOOKUP_PEPPER ?? null,
      sessionRecoveryAccessTokenSecret: parsed.SESSION_RECOVERY_ACCESS_TOKEN_SECRET ?? null,
      authAuditHashSecret: parsed.AUTH_AUDIT_HASH_SECRET ?? null,
      turnstileSecretKey: parsed.TURNSTILE_SECRET_KEY ?? null,
      turnstileExpectedHostname: parsed.TURNSTILE_EXPECTED_HOSTNAME ?? null,
      sessionRecoveryAccessTokenTtlSeconds: (() => {
        const value = parsed.SESSION_RECOVERY_ACCESS_TOKEN_TTL_SECONDS ?? 900;
        if (typeof value !== 'number' || Number.isNaN(value)) return 900;
        return Math.max(60, Math.min(value, 2_592_000));
      })(),
    } as const;
  },

  get analytics() {
    const parsed = parseEnv();
    return {
      writeKey: parsed.NEXT_PUBLIC_SITE_ANALYTICS_WRITE_KEY,
    } as const;
  },

  get googleBusinessProfile() {
    const parsed = parseEnv();
    const clientId =
      parsed.GOOGLE_BUSINESS_CLIENT_ID ?? parsed.GOOGLE_BUSINESS_PROFILE_CLIENT_ID ?? null;
    const clientSecret =
      parsed.GOOGLE_BUSINESS_CLIENT_SECRET ?? parsed.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET ?? null;
    const redirectUri =
      parsed.GOOGLE_BUSINESS_REDIRECT_URI ?? parsed.GOOGLE_BUSINESS_PROFILE_REDIRECT_URI ?? null;
    const tokenEncryptionKey =
      parsed.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY ??
      parsed.GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY ??
      null;
    const tokenEncryptionKeyring =
      parsed.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID &&
      parsed.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS
        ? {
            activeKeyId: parsed.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID,
            keys: parsed.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS,
          }
        : null;
    return {
      clientId,
      clientSecret,
      redirectUri,
      tokenEncryptionKey,
      tokenEncryptionKeyring,
      quotaProject: parsed.GOOGLE_CLOUD_QUOTA_PROJECT ?? null,
      configured: Boolean(
        clientId && clientSecret && redirectUri && (tokenEncryptionKey || tokenEncryptionKeyring),
      ),
    } as const;
  },

  get misc() {
    const parsed = parseEnv();
    return {
      siteUrl: parsed.SITE_URL ?? parsed.NEXT_PUBLIC_SITE_URL,
      baseUrl: parsed.BASE_URL,
      openAiKey: parsed.OPENAI_API_KEY,
      analyzeBuild: parsed.ANALYZE ?? false,
      bookingDefaultRestaurantId: parsed.BOOKING_DEFAULT_RESTAURANT_ID,
    } as const;
  },

  get opsCache() {
    const parsed = parseEnv();

    const clamp = (value: number | undefined, min: number, max: number, fallback: number) => {
      if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
      return Math.min(max, Math.max(min, value));
    };

    return {
      summaryTtlMs: clamp(parsed.OPS_SUMMARY_CACHE_TTL_MS, 0, 600_000, 5_000),
      changesTtlMs: clamp(parsed.OPS_CHANGES_CACHE_TTL_MS, 0, 600_000, 3_000),
      restaurantMetaTtlMs: clamp(parsed.OPS_RESTAURANT_META_CACHE_TTL_MS, 0, 3_600_000, 600_000),
      maxEntries: clamp(parsed.OPS_CACHE_MAX_ENTRIES, 1, 500, 128),
    } as const;
  },

  get cloudflare() {
    const parsed = parseEnv();
    return {
      emailQueueGatewayUrl: parsed.CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL,
      emailQueueGatewayToken: parsed.CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN,
      bookingShortLinksBaseUrl: parsed.BOOKING_SHORT_LINKS_BASE_URL ?? null,
      bookingShortLinksInternalUrl: parsed.BOOKING_SHORT_LINKS_INTERNAL_URL ?? null,
      bookingShortLinksInternalToken: parsed.BOOKING_SHORT_LINKS_INTERNAL_TOKEN ?? null,
    } as const;
  },

  get dualSync() {
    const parsed = parseEnv();
    return {
      failureWebhookUrl: parsed.DUAL_SYNC_FAILURE_WEBHOOK_URL ?? null,
      pubsubIngress: {
        enabled: parsed.GBP_PUBSUB_INGEST_ENABLED,
        expectedAudience: parsed.GBP_PUBSUB_EXPECTED_AUDIENCE ?? null,
        pushServiceAccountEmail: parsed.GBP_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL ?? null,
        subscription: parsed.GBP_PUBSUB_SUBSCRIPTION ?? null,
        topic: parsed.GBP_PUBSUB_TOPIC ?? null,
      },
    } as const;
  },
} as const;
