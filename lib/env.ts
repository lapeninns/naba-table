import { envSchemas, type Env } from '@/config/env.schema';
import { getCanonicalSiteUrl } from '@/lib/site-url';

const DEFAULT_RESEND_DOMAIN = 'no-reply-notifications.nabatable.com';
const DEFAULT_RESEND_FROM = `no-reply@${DEFAULT_RESEND_DOMAIN}`;

let cachedEnv: Env | null = null;

function parseEnv(): Env {
  const sanitizeUrlEnv = (key: 'BASE_URL' | 'SITE_URL') => {
    const value = process.env[key];
    if (typeof value === 'string') {
      const normalized = value.trim();
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

  const nodeEnv = (process.env.NODE_ENV ?? 'development') as keyof typeof envSchemas;
  const schema = envSchemas[nodeEnv] ?? envSchemas.development;

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
      intervalMinutes: parsed.RESERVE_RESERVATION_INTERVAL_MINUTES ?? 15,
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

  get featureFlags() {
    const parsed = parseEnv();
    const isProduction = parsed.NODE_ENV === 'production';
    const allocatorKMax = Math.max(1, Math.min(parsed.FEATURE_ALLOCATOR_K_MAX ?? 3, 5));
    const allocatorMergesDefault = parsed.FEATURE_ALLOCATOR_MERGES_ENABLED ?? !isProduction;
    const combinationPlannerDefault = parsed.FEATURE_COMBINATION_PLANNER ?? allocatorMergesDefault;
    const plannerTimePruningDefault = parsed.FEATURE_PLANNER_TIME_PRUNING_ENABLED ?? true;
    const plannerCacheTtlMs = 60_000;
    const adjacencyMinPartySize = null;
    const adjacencyMode = 'connected' as const;
    const manualAssignmentMaxSlack =
      typeof parsed.FEATURE_MANUAL_ASSIGNMENT_MAX_SLACK === 'number'
        ? Math.max(0, Math.min(parsed.FEATURE_MANUAL_ASSIGNMENT_MAX_SLACK, 12))
        : null;
    const manualAssignmentSessionEnabled =
      parsed.FEATURE_MANUAL_ASSIGNMENT_SESSION_ENABLED ?? false;
    const manualAssignmentSnapshotValidation =
      parsed.FEATURE_MANUAL_ASSIGNMENT_SNAPSHOT_VALIDATION !== false;
    const selectorMaxPlansPerSlack =
      typeof parsed.FEATURE_SELECTOR_MAX_PLANS_PER_SLACK === 'number'
        ? Math.max(1, Math.min(parsed.FEATURE_SELECTOR_MAX_PLANS_PER_SLACK, 500))
        : null;
    const selectorMaxCombinationEvaluations =
      typeof parsed.FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS === 'number'
        ? Math.max(1, Math.min(parsed.FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS, 5000))
        : null;
    const selectorEnumerationTimeoutMs =
      typeof parsed.FEATURE_SELECTOR_ENUMERATION_TIMEOUT_MS === 'number'
        ? Math.max(50, Math.min(parsed.FEATURE_SELECTOR_ENUMERATION_TIMEOUT_MS, 10_000))
        : null;
    const adjacencyQueryUndirectedDefault = true;
    const strictConflictsDefault =
      typeof parsed.FEATURE_HOLDS_STRICT_CONFLICTS_ENABLED === 'boolean'
        ? parsed.FEATURE_HOLDS_STRICT_CONFLICTS_ENABLED
        : parsed.APP_ENV === 'staging';
    return {
      loyaltyPilotRestaurantIds: parsed.LOYALTY_PILOT_RESTAURANT_IDS,
      guestLookupPolicy: parsed.FEATURE_GUEST_LOOKUP_POLICY ?? false,
      opsGuardV2: parsed.FEATURE_OPS_GUARD_V2 ?? false,
      bookingPastTimeBlocking: parsed.FEATURE_BOOKING_PAST_TIME_BLOCKING ?? false,
      bookingPastTimeGraceMinutes: parsed.BOOKING_PAST_TIME_GRACE_MINUTES ?? 5,
      pendingSelfServeGraceMinutes: Math.max(
        0,
        Math.min(parsed.NEXT_PUBLIC_BOOKING_PENDING_GRACE_MINUTES ?? 10, 60),
      ),
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
      realtimeFloorplan: parsed.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN ?? true,
      planner: {
        timePruningEnabled: plannerTimePruningDefault,
        cacheEnabled: false,
        cacheTtlMs: plannerCacheTtlMs,
        debugProfiling: parsed.DEBUG_CAPACITY_PROFILING ?? false,
      },
      allocator: {
        mergesEnabled: allocatorMergesDefault,
        requireAdjacency: parsed.FEATURE_ALLOCATOR_REQUIRE_ADJACENCY ?? true,
        kMax: allocatorKMax,
        adjacencyMinPartySize,
        adjacencyMode,
        service: {
          failHard: parsed.FEATURE_ALLOCATOR_SERVICE_FAIL_HARD ?? false,
        },
      },
      manualAssignments: {
        maxSlack: manualAssignmentMaxSlack,
        sessionEnabled: manualAssignmentSessionEnabled,
        snapshotValidation: manualAssignmentSnapshotValidation,
      },
      selector: {
        maxPlansPerSlack: selectorMaxPlansPerSlack,
        maxCombinationEvaluations: selectorMaxCombinationEvaluations,
        enumerationTimeoutMs: selectorEnumerationTimeoutMs,
      },
      context: {
        queryPaddingMinutes: Math.max(
          0,
          Math.min(parsed.FEATURE_CONTEXT_QUERY_PADDING_MINUTES ?? 60, 240),
        ),
      },
      holds: {
        enabled: parsed.FEATURE_HOLDS_ENABLED ?? true,
        strictConflicts: strictConflictsDefault,
        minTtlSeconds: 180,
      },
      adjacency: {
        queryUndirected: adjacencyQueryUndirectedDefault,
      },
      // Booking auto-assignment
      autoAssignOnBooking: parsed.FEATURE_AUTO_ASSIGN_ON_BOOKING ?? false,
      inlineAutoAssignTimeoutMs: (() => {
        const raw = parsed.FEATURE_INLINE_AUTO_ASSIGN_TIMEOUT_MS;
        const fallback = 12_000;
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          return Math.max(2_000, Math.min(raw, 20_000));
        }
        return fallback;
      })(),
      autoAssign: {
        maxRetries: Math.max(0, Math.min(parsed.FEATURE_AUTO_ASSIGN_MAX_RETRIES ?? 3, 10)),
        retryDelaysMs:
          typeof parsed.FEATURE_AUTO_ASSIGN_RETRY_DELAYS_MS === 'string'
            ? parsed.FEATURE_AUTO_ASSIGN_RETRY_DELAYS_MS
            : undefined,
        startCutoffMinutes: Math.max(
          0,
          Math.min(parsed.FEATURE_AUTO_ASSIGN_START_CUTOFF_MINUTES ?? 10, 240),
        ),
        createdEmailDeferMinutes: Math.max(
          0,
          Math.min(parsed.FEATURE_AUTO_ASSIGN_CREATED_EMAIL_DEFER_MINUTES ?? 5, 120),
        ),
      },
      emailQueueEnabled: parsed.FEATURE_EMAIL_QUEUE_ENABLED ?? false,
      policyRequoteEnabled: parsed.FEATURE_POLICY_REQUOTE_ENABLED ?? true,
      dbStrictConstraints: parsed.FEATURE_DB_STRICT_CONSTRAINTS ?? false,
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

  get queue() {
    const parsed = parseEnv();
    return {
      redisUrl: parsed.QUEUE_REDIS_URL,
      host: parsed.QUEUE_REDIS_HOST,
      port: parsed.QUEUE_REDIS_PORT,
      username: parsed.QUEUE_REDIS_USERNAME,
      password: parsed.QUEUE_REDIS_PASSWORD,
      tls: parsed.QUEUE_REDIS_TLS ?? false,
    } as const;
  },
} as const;
