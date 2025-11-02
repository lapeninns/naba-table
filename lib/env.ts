import { envSchemas, type Env } from "@/config/env.schema";

let cachedEnv: Env | null = null;

function parseEnv(): Env {
  const sanitizeUrlEnv = (key: 'BASE_URL' | 'SITE_URL') => {
    const value = process.env[key];
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length === 0 || normalized === '/' || normalized.toLowerCase() === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = normalized;
      }
    }
  };

  sanitizeUrlEnv('BASE_URL');
  sanitizeUrlEnv('SITE_URL');

  if (!process.env.BASE_URL) {
    const fallback = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    process.env.BASE_URL = fallback;
  }

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

  get featureFlags() {
    const parsed = parseEnv();
    const isProduction = parsed.NODE_ENV === "production";
    const allocatorKMax = Math.max(1, Math.min(parsed.FEATURE_ALLOCATOR_K_MAX ?? 3, 5));
    const allocatorMergesDefault = parsed.FEATURE_ALLOCATOR_MERGES_ENABLED ?? !isProduction;
    const combinationPlannerDefault = parsed.FEATURE_COMBINATION_PLANNER ?? allocatorMergesDefault;
    const plannerTimePruningDefault = parsed.FEATURE_PLANNER_TIME_PRUNING_ENABLED ?? false;
    const adjacencyMinPartySize =
      typeof parsed.FEATURE_ALLOCATOR_ADJACENCY_MIN_PARTY_SIZE === "number"
        ? Math.max(1, Math.min(parsed.FEATURE_ALLOCATOR_ADJACENCY_MIN_PARTY_SIZE, 20))
        : null;
    const selectorMaxPlansPerSlack =
      typeof parsed.FEATURE_SELECTOR_MAX_PLANS_PER_SLACK === "number"
        ? Math.max(1, Math.min(parsed.FEATURE_SELECTOR_MAX_PLANS_PER_SLACK, 500))
        : null;
    const selectorMaxCombinationEvaluations =
      typeof parsed.FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS === "number"
        ? Math.max(1, Math.min(parsed.FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS, 5000))
        : null;
    const selectorEnumerationTimeoutMs =
      typeof parsed.FEATURE_SELECTOR_ENUMERATION_TIMEOUT_MS === "number"
        ? Math.max(50, Math.min(parsed.FEATURE_SELECTOR_ENUMERATION_TIMEOUT_MS, 10_000))
        : null;
    const adjacencyQueryUndirectedDefault = parsed.FEATURE_ADJACENCY_QUERY_UNDIRECTED ?? true;
    return {
      loyaltyPilotRestaurantIds: parsed.LOYALTY_PILOT_RESTAURANT_IDS,
      enableTestApi: parsed.ENABLE_TEST_API ?? false,
      guestLookupPolicy: parsed.FEATURE_GUEST_LOOKUP_POLICY ?? false,
      opsGuardV2: parsed.FEATURE_OPS_GUARD_V2 ?? false,
      bookingPastTimeBlocking: parsed.FEATURE_BOOKING_PAST_TIME_BLOCKING ?? false,
      bookingPastTimeGraceMinutes: parsed.BOOKING_PAST_TIME_GRACE_MINUTES ?? 5,
      bookingValidationUnified: parsed.FEATURE_BOOKING_VALIDATION_UNIFIED ?? false,
      bookingLifecycleV2: parsed.FEATURE_OPS_BOOKING_LIFECYCLE_V2 ?? false,
      allocationsDualWrite: parsed.FEATURE_ALLOCATIONS_DUAL_WRITE ?? false,
      statusTriggers: parsed.FEATURE_STATUS_TRIGGERS ?? false,
      editScheduleParity: parsed.FEATURE_EDIT_SCHEDULE_PARITY ?? true,
      selectorScoring: parsed.FEATURE_SELECTOR_SCORING ?? true,
      selectorLookahead: {
        enabled: parsed.FEATURE_SELECTOR_LOOKAHEAD ?? true,
        windowMinutes: Math.max(
          5,
          Math.min(parsed.FEATURE_SELECTOR_LOOKAHEAD_WINDOW_MINUTES ?? 120, 480),
        ),
        penaltyWeight: Math.max(
          1,
          Math.min(parsed.FEATURE_SELECTOR_LOOKAHEAD_PENALTY_WEIGHT ?? 500, 100_000),
        ),
        blockThreshold: Math.max(
          0,
          Math.min(parsed.FEATURE_SELECTOR_LOOKAHEAD_BLOCK_THRESHOLD ?? 0, 100_000),
        ),
      },
      combinationPlanner: combinationPlannerDefault,
      adjacencyValidation: parsed.FEATURE_ADJACENCY_VALIDATION ?? false,
      opsMetrics: parsed.FEATURE_OPS_METRICS ?? false,
      opsRejectionAnalytics: parsed.FEATURE_OPS_REJECTION_ANALYTICS ?? false,
      realtimeFloorplan: parsed.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN ?? false,
      planner: {
        timePruningEnabled: plannerTimePruningDefault,
      },
      allocatorV2: {
        enabled: parsed.FEATURE_ALLOCATOR_V2_ENABLED ?? true,
        shadow: parsed.FEATURE_ALLOCATOR_V2_SHADOW ?? false,
        forceLegacy: parsed.FEATURE_ALLOCATOR_V2_FORCE_LEGACY ?? false,
      },
      allocator: {
        mergesEnabled: allocatorMergesDefault,
        requireAdjacency: parsed.FEATURE_ALLOCATOR_REQUIRE_ADJACENCY ?? true,
        kMax: allocatorKMax,
        adjacencyMinPartySize,
        service: {
          failHard: parsed.FEATURE_ALLOCATOR_SERVICE_FAIL_HARD ?? false,
        },
      },
      selector: {
        maxPlansPerSlack: selectorMaxPlansPerSlack,
        maxCombinationEvaluations: selectorMaxCombinationEvaluations,
        enumerationTimeoutMs: selectorEnumerationTimeoutMs,
      },
      context: {
        queryPaddingMinutes: Math.max(0, Math.min(parsed.FEATURE_CONTEXT_QUERY_PADDING_MINUTES ?? 60, 240)),
      },
      holds: {
        enabled: parsed.FEATURE_HOLDS_ENABLED ?? true,
        strictConflicts: parsed.FEATURE_HOLDS_STRICT_CONFLICTS_ENABLED ?? false,
        minTtlSeconds: Math.max(1, Math.min(parsed.FEATURE_HOLDS_MIN_TTL_SECONDS ?? 60, 3600)),
        rate: {
          windowSeconds: Math.max(5, Math.min(parsed.FEATURE_HOLDS_RATE_WINDOW_SECONDS ?? 60, 3600)),
          maxPerBooking: Math.max(1, Math.min(parsed.FEATURE_HOLDS_RATE_MAX_PER_BOOKING ?? 5, 100)),
        },
      },
      adjacency: {
        queryUndirected: adjacencyQueryUndirectedDefault,
      },
    } as const;
  },

  get strategic() {
    const parsed = parseEnv();
    const rawScarcityWeight = parsed.FEATURE_SELECTOR_SCARCITY_WEIGHT;
    const scarcityWeight =
      typeof rawScarcityWeight === "number" && Number.isFinite(rawScarcityWeight)
        ? Math.max(0, Math.min(rawScarcityWeight, 1000))
        : undefined;
    const demandProfilePath =
      typeof parsed.STRATEGIC_DEMAND_PROFILE_PATH === "string"
        ? parsed.STRATEGIC_DEMAND_PROFILE_PATH.trim() || undefined
        : undefined;

    return {
      scarcityWeight,
      demandProfilePath,
    } as const;
  },

  get security() {
    const parsed = parseEnv();
    return {
      guestLookupPepper: parsed.GUEST_LOOKUP_PEPPER ?? null,
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
} as const;
