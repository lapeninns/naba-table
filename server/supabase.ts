import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

import { env, getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildSupabaseCookieOptions, resolveCookieDomain } from "@/lib/supabase/cookies";

import type { Database } from "@/types/supabase";
import type { NextResponse} from "next/server";

export { BOOKING_BLOCKING_STATUSES } from "@/lib/enums";

let serviceClient: SupabaseClient<Database> | null = null;
const tenantClientCache = new Map<string, SupabaseClient<Database>>();
let strictHoldInitStarted = false;
let strictHoldEnforcementActive: boolean | null = null;
let cookieWriteSuppressedLogged = false;
const supabaseLogger = logger.child({ module: "supabase" });

export class MissingRestaurantContextError extends Error {
  constructor(message = "Restaurant context is required") {
    super(message);
    this.name = "MissingRestaurantContextError";
  }
}

/** Auth, cookies, middleware, and RLS-aligned browser flows always use the primary project URL. */
function getPublicSupabaseUrl(): string {
  return getEnv().NEXT_PUBLIC_SUPABASE_URL;
}

function getPublicSupabaseAnonKey(): string {
  return getEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function getServiceRoleSupabaseKey(): string {
  return getEnv().SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Supabase REST URL for the memoized service-role client.
 * On staging/preview, can target a read replica when configured (same API keys as the primary).
 * Never switches away from the primary URL on production deployment targets.
 */
export function resolveServiceRoleSupabaseUrl(): string {
  const parsed = getEnv();
  const replicaUrl = parsed.SUPABASE_READ_REPLICA_URL?.trim();
  const wantsReplica =
    parsed.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA === true && Boolean(replicaUrl);
  if (!wantsReplica) {
    return parsed.NEXT_PUBLIC_SUPABASE_URL;
  }
  const treatAsProdTarget =
    parsed.APP_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (treatAsProdTarget) {
    return parsed.NEXT_PUBLIC_SUPABASE_URL;
  }
  return replicaUrl!;
}

const runtimeEnv = getEnv();
const shouldRunStrictHoldCheck = ["production", "staging"].includes(env.node.appEnv);
const RESTAURANT_CONTEXT_HEADER = "X-Restaurant-Id";
const DEFAULT_RESTAURANT_SLUG = runtimeEnv.NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG ?? null;
const ROOT_DOMAIN =
  typeof runtimeEnv.NEXT_PUBLIC_ROOT_DOMAIN === "string"
    ? runtimeEnv.NEXT_PUBLIC_ROOT_DOMAIN
    : "localhost";
const COOKIE_DOMAIN = resolveCookieDomain(ROOT_DOMAIN);
const secureCookies = env.node.appEnv !== "development" && COOKIE_DOMAIN !== undefined;

let cachedDefaultRestaurantId: string | null =
  runtimeEnv.NEXT_PUBLIC_DEFAULT_RESTAURANT_ID ?? env.misc.bookingDefaultRestaurantId ?? null;
let resolvingDefaultRestaurantId: Promise<string | null> | null = null;

type CookieReader = {
  getAll: () => { name: string; value: string }[];
};

type CookieWriter = {
  set: (options: { name: string; value: string; [key: string]: unknown }) => void;
};

type NextCookies = Awaited<ReturnType<typeof cookies>>;

function applyCookieDefaults(options: Record<string, unknown> = {}, rememberMe = true) {
  return {
    ...buildSupabaseCookieOptions({
      domain: COOKIE_DOMAIN,
      secure: secureCookies,
      sameSite: "lax",
      httpOnly: true,
      rememberMe,
    }),
    ...options,
  };
}

function isCookieWriter(candidate: unknown): candidate is CookieWriter {
  return Boolean(candidate && typeof (candidate as CookieWriter).set === "function");
}

function createCookieAdapter(store: CookieReader, writer?: CookieWriter, rememberMe = true) {
  const cookieWriter = writer ?? (isCookieWriter(store) ? store : undefined);

  return {
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    ...(cookieWriter
      ? {
          setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieWriter.set({ name, value, ...applyCookieDefaults(options, rememberMe) });
              });
            } catch (error) {
              if (!cookieWriteSuppressedLogged) {
                cookieWriteSuppressedLogged = true;
                supabaseLogger.debug("cookie write suppressed (likely server component render)", {
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
          },
        }
      : {}),
  };
}

export function getServiceSupabaseClient(): SupabaseClient<Database> {
  if (!serviceClient) {
    const dataUrl = resolveServiceRoleSupabaseUrl();
    const publicUrl = getPublicSupabaseUrl();
    if (dataUrl !== publicUrl) {
      supabaseLogger.info("service-role Supabase client using alternate data URL (read replica)", {
        primaryHost: (() => {
          try {
            return new URL(publicUrl).host;
          } catch {
            return null;
          }
        })(),
        dataHost: (() => {
          try {
            return new URL(dataUrl).host;
          } catch {
            return null;
          }
        })(),
      });
    }
    serviceClient = createClient<Database>(dataUrl, getServiceRoleSupabaseKey(), {
      auth: {
        persistSession: false,
      },
    });

    // Best-effort startup initialization for strict hold conflict enforcement.
    // This config sets the session GUC and verifies it is honored.
    // We intentionally do not await here to avoid blocking cold starts.
    if (!strictHoldInitStarted && shouldRunStrictHoldCheck) {
      strictHoldInitStarted = true;
      void (async () => {
        try {
          // Attempt to enable strict enforcement for this service session
          await serviceClient!.rpc("set_hold_conflict_enforcement", { enabled: true });
          // Verify it stuck (function returns the server-side view of the GUC)
          const { data, error } = await serviceClient!.rpc("is_holds_strict_conflicts_enabled");
          if (error) {
            strictHoldEnforcementActive = false;
            supabaseLogger.warn("strict hold enforcement self-check failed", {
              code: error.code ?? null,
              message: error.message ?? String(error),
            });
          } else {
            strictHoldEnforcementActive = Boolean(data);
            if (!strictHoldEnforcementActive) {
              supabaseLogger.error("strict hold enforcement not honored by server (GUC off)");
            } else {
              supabaseLogger.info("strict hold enforcement active");
            }
          }
        } catch (err) {
          strictHoldEnforcementActive = false;
          supabaseLogger.warn("strict hold enforcement init error", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }
  }

  return serviceClient;
}

/**
 * Returns a memoized service-role client that injects the tenant context header required for scoped RLS.
 * Use this only when executing tenant-specific reads/writes that must honor row-level policies.
 */
export function getTenantServiceSupabaseClient(restaurantId: string): SupabaseClient<Database> {
  if (!restaurantId) {
    throw new Error("restaurantId is required for tenant-scoped Supabase client");
  }

  const cacheKey = restaurantId.toLowerCase();
  const cached = tenantClientCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const tenantClient = createClient<Database>(resolveServiceRoleSupabaseUrl(), getServiceRoleSupabaseKey(), {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        [RESTAURANT_CONTEXT_HEADER]: restaurantId,
      },
    },
  });

  tenantClientCache.set(cacheKey, tenantClient);
  return tenantClient;
}

export async function getServerComponentSupabaseClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  return createServerClient<Database>(getPublicSupabaseUrl(), getPublicSupabaseAnonKey(), {
    cookies: createCookieAdapter(cookieStore),
  });
}

export async function getRouteHandlerSupabaseClient(
  cookieStore?: NextCookies,
  rememberMe: boolean = true,
): Promise<SupabaseClient<Database>> {
  const store = cookieStore ?? (await cookies());
  return createServerClient<Database>(getPublicSupabaseUrl(), getPublicSupabaseAnonKey(), {
    cookies: createCookieAdapter(store, store as CookieWriter, rememberMe),
  });
}

export function getMiddlewareSupabaseClient(req: NextRequest, res: NextResponse): SupabaseClient<Database> {
  return createServerClient<Database>(getPublicSupabaseUrl(), getPublicSupabaseAnonKey(), {
    cookies: createCookieAdapter(req.cookies, res.cookies),
  });
}

/**
 * Returns whether the initial strict hold enforcement self-check succeeded for the service client.
 * This is a best-effort signal for ops visibility and conditional behavior.
 */
export function isStrictHoldEnforcementActive(): boolean | null {
  return strictHoldEnforcementActive;
}

async function resolveActiveRestaurantId(restaurantId: string): Promise<string | null> {
  const normalized = restaurantId.trim();
  if (!normalized) {
    return null;
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("restaurants")
    .select("id")
    .eq("id", normalized)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[supabase][default-restaurant] failed to validate active restaurant", {
      restaurantId: normalized,
      code: error.code ?? null,
      message: error.message ?? String(error),
    });
    return null;
  }

  return data?.id ?? null;
}

export async function getDefaultRestaurantId(): Promise<string> {
  if (env.misc.bookingDefaultRestaurantId) {
    const configuredId = await resolveActiveRestaurantId(env.misc.bookingDefaultRestaurantId);
    if (!configuredId) {
      throw new MissingRestaurantContextError("Configured default restaurant is inactive or missing");
    }
    cachedDefaultRestaurantId = configuredId;
    return configuredId;
  }

  if (cachedDefaultRestaurantId) {
    const activeId = await resolveActiveRestaurantId(cachedDefaultRestaurantId);
    if (activeId) {
      cachedDefaultRestaurantId = activeId;
      return activeId;
    }
    cachedDefaultRestaurantId = null;
  }

  if (!DEFAULT_RESTAURANT_SLUG) {
    throw new MissingRestaurantContextError();
  }

  if (!resolvingDefaultRestaurantId) {
    const service = getServiceSupabaseClient();

    const resolve = async (): Promise<string | null> => {
      try {
        const { data, error } = await service
          .from("restaurants")
          .select("id")
          .eq("slug", DEFAULT_RESTAURANT_SLUG)
          .eq("is_active", true)
          .maybeSingle();

        if (!error && data?.id) {
          return data.id;
        }
      } catch (cause) {
        console.error("[supabase][default-restaurant] failed to resolve id", cause);
      }

      return null;
    };

    resolvingDefaultRestaurantId = resolve().then((value) => {
      cachedDefaultRestaurantId = value ?? null;
      return cachedDefaultRestaurantId;
    });
  }

  const resolved = await resolvingDefaultRestaurantId;
  if (!resolved) {
    throw new MissingRestaurantContextError();
  }

  cachedDefaultRestaurantId = resolved;
  return cachedDefaultRestaurantId;
}
