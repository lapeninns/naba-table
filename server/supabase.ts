import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

import { env, getEnv } from "@/lib/env";

import type { Database } from "@/types/supabase";
import type { NextResponse} from "next/server";

export { BOOKING_BLOCKING_STATUSES } from "@/lib/enums";

let serviceClient: SupabaseClient<Database> | null = null;
let strictHoldInitStarted = false;
let strictHoldEnforcementActive: boolean | null = null;

const runtimeEnv = getEnv();
const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceKey: SUPABASE_SERVICE_ROLE_KEY } = env.supabase;
const DEFAULT_RESTAURANT_FALLBACK_ID = "39cb1346-20fb-4fa2-b163-0230e1caf749";
const DEFAULT_RESTAURANT_SLUG = runtimeEnv.NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG;

let cachedDefaultRestaurantId: string | null =
  runtimeEnv.NEXT_PUBLIC_DEFAULT_RESTAURANT_ID ?? env.misc.bookingDefaultRestaurantId ?? null;
let resolvingDefaultRestaurantId: Promise<string> | null = null;

type CookieReader = {
  getAll: () => { name: string; value: string }[];
};

type CookieWriter = {
  set: (options: { name: string; value: string; [key: string]: unknown }) => void;
};

type NextCookies = Awaited<ReturnType<typeof cookies>>;

function createCookieAdapter(store: CookieReader, writer?: CookieWriter) {
  return {
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    ...(writer
      ? {
          setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              writer.set({ name, value, ...options });
            });
          },
        }
      : {}),
  };
}

export function getServiceSupabaseClient(): SupabaseClient<Database> {
  if (!serviceClient) {
    serviceClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    });

    // Best-effort startup initialization for strict hold conflict enforcement.
    // This config sets the session GUC and verifies it is honored.
    // We intentionally do not await here to avoid blocking cold starts.
    if (!strictHoldInitStarted) {
      strictHoldInitStarted = true;
      void (async () => {
        try {
          // Attempt to enable strict enforcement for this service session
          await serviceClient!.rpc("set_hold_conflict_enforcement", { enabled: true });
          // Verify it stuck (function returns the server-side view of the GUC)
          const { data, error } = await serviceClient!.rpc("is_holds_strict_conflicts_enabled");
          if (error) {
            strictHoldEnforcementActive = false;
            console.error("[supabase] strict hold enforcement self-check failed", {
              code: error.code ?? null,
              message: error.message ?? String(error),
            });
          } else {
            strictHoldEnforcementActive = Boolean(data);
            if (!strictHoldEnforcementActive) {
              console.error("[supabase] strict hold enforcement not honored by server (GUC off)");
            } else {
              console.info("[supabase] strict hold enforcement active");
            }
          }
        } catch (err) {
          strictHoldEnforcementActive = false;
          console.error("[supabase] strict hold enforcement init error", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }
  }

  return serviceClient;
}

export async function getServerComponentSupabaseClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: createCookieAdapter(cookieStore),
  });
}

export async function getRouteHandlerSupabaseClient(
  cookieStore?: NextCookies,
): Promise<SupabaseClient<Database>> {
  const store = cookieStore ?? (await cookies());
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: createCookieAdapter(store, store as CookieWriter),
  });
}

export function getMiddlewareSupabaseClient(req: NextRequest, res: NextResponse): SupabaseClient<Database> {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

export async function getDefaultRestaurantId(): Promise<string> {
  if (env.misc.bookingDefaultRestaurantId) {
    return env.misc.bookingDefaultRestaurantId;
  }

  if (cachedDefaultRestaurantId) {
    return cachedDefaultRestaurantId;
  }

  if (!resolvingDefaultRestaurantId) {
    const service = getServiceSupabaseClient();

    const resolve = async (): Promise<string> => {
      try {
        if (DEFAULT_RESTAURANT_SLUG) {
          const { data, error } = await service
            .from("restaurants")
            .select("id")
            .eq("slug", DEFAULT_RESTAURANT_SLUG)
            .maybeSingle();

          if (!error && data?.id) {
            return data.id;
          }
        }

        const { data, error } = await service
          .from("restaurants")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!error && data?.id) {
          return data.id;
        }
      } catch (cause) {
        console.error("[supabase][default-restaurant] failed to resolve id", cause);
      }

      return DEFAULT_RESTAURANT_FALLBACK_ID;
    };

    resolvingDefaultRestaurantId = resolve().then((value) => {
      cachedDefaultRestaurantId = value ?? DEFAULT_RESTAURANT_FALLBACK_ID;
      return cachedDefaultRestaurantId;
    });
  }

  const resolved = await resolvingDefaultRestaurantId;
  cachedDefaultRestaurantId = resolved ?? DEFAULT_RESTAURANT_FALLBACK_ID;
  return cachedDefaultRestaurantId;
}


