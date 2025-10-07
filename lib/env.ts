import { envSchemas, type Env } from "@/config/env.schema";

let cachedEnv: Env | null = null;

function parseEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const nodeEnv = (process.env.NODE_ENV ?? "development") as keyof typeof envSchemas;
  const schema = envSchemas[nodeEnv] ?? envSchemas.development;

  const result = schema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("\n");

    throw new Error(`Environment validation failed at runtime:\n${formatted}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getEnv(): Env {
  return parseEnv();
}

export const env = {
  get raw(): Env {
    return parseEnv();
  },

  get node() {
    const parsed = parseEnv();
    return {
      env: parsed.NODE_ENV,
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

  get app() {
    const parsed = parseEnv();
    return {
      url: parsed.NEXT_PUBLIC_APP_URL ?? parsed.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      version: parsed.NEXT_PUBLIC_APP_VERSION,
      commitSha: parsed.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    } as const;
  },

  get reserve() {
    const parsed = parseEnv();
    return {
      apiBaseUrl: parsed.RESERVE_API_BASE_URL ?? "/api",
      apiTimeoutMs: parsed.RESERVE_API_TIMEOUT_MS ?? 15_000,
      routerBasePath: parsed.RESERVE_ROUTER_BASE_PATH ?? "/reserve",
      buildOutDir: parsed.RESERVE_BUILD_OUT_DIR,
      defaultDurationMinutes: parsed.RESERVE_RESERVATION_DEFAULT_DURATION_MINUTES ?? 90,
      intervalMinutes: parsed.RESERVE_RESERVATION_INTERVAL_MINUTES ?? 15,
      isOpenLabel: parsed.RESERVE_RESERVATION_OPEN,
      timezone: parsed.RESERVE_RESERVATION_TIMEZONE,
      unavailableTooltip: parsed.RESERVE_RESERVATION_UNAVAILABLE_TOOLTIP,
      flags: {
        reserveV2: parsed.NEXT_PUBLIC_RESERVE_V2 ?? false,
        enableTestUi: parsed.NEXT_PUBLIC_ENABLE_TEST_UI ?? false,
      },
    } as const;
  },

  get resend() {
    const parsed = parseEnv();
    return {
      apiKey: parsed.RESEND_API_KEY,
      from: parsed.RESEND_FROM,
    } as const;
  },

  get mailgun() {
    const parsed = parseEnv();
    return {
      apiKey: parsed.MAILGUN_API_KEY,
    } as const;
  },

  get featureFlags() {
    const parsed = parseEnv();
    return {
      loyaltyPilotRestaurantIds: parsed.LOYALTY_PILOT_RESTAURANT_IDS,
      enableTestApi: parsed.ENABLE_TEST_API ?? false,
    } as const;
  },

  get testing() {
    const parsed = parseEnv();
    return {
      playwright: {
        apiKey: parsed.PLAYWRIGHT_TEST_API_KEY,
        email: parsed.PLAYWRIGHT_TEST_EMAIL,
        password: parsed.PLAYWRIGHT_TEST_PASSWORD,
        iframe: parsed.PLAYWRIGHT_TEST_IFRAME ?? false,
        offline: parsed.PLAYWRIGHT_TEST_OFFLINE ?? false,
        authFlow: parsed.PLAYWRIGHT_TEST_AUTH_FLOW,
      },
      auth: {
        email: parsed.PLAYWRIGHT_AUTH_EMAIL,
        name: parsed.PLAYWRIGHT_AUTH_NAME,
        password: parsed.PLAYWRIGHT_AUTH_PASSWORD,
        phone: parsed.PLAYWRIGHT_AUTH_PHONE,
        refreshToken: parsed.PLAYWRIGHT_AUTH_REFRESH,
      },
      routeCompatWindowDays: parsed.ROUTE_COMPAT_WINDOW_DAYS ?? 7,
    } as const;
  },

  get analytics() {
    const parsed = parseEnv();
    return {
      writeKey: parsed.NEXT_PUBLIC_SITE_ANALYTICS_WRITE_KEY,
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

  get cache() {
    const parsed = parseEnv();
    return {
      enableAvailabilityCache: parsed.ENABLE_AVAILABILITY_CACHE ?? false,
      availabilityTtlSeconds: parsed.AVAILABILITY_CACHE_TTL_SECONDS ?? 300,
      upstash: {
        restUrl: parsed.UPSTASH_REDIS_REST_URL,
        restToken: parsed.UPSTASH_REDIS_REST_TOKEN,
      },
    } as const;
  },

  get queue() {
    const parsed = parseEnv();
    return {
      provider: parsed.QUEUE_PROVIDER ?? "inngest",
      useAsyncSideEffects: parsed.USE_ASYNC_SIDE_EFFECTS ?? false,
      inngest: {
        appId: parsed.INNGEST_APP_ID,
        eventKey: parsed.INNGEST_EVENT_KEY,
        signingKey: parsed.INNGEST_SIGNING_KEY,
      },
    } as const;
  },
} as const;
