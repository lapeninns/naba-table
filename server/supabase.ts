import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { env, getEnv } from "@/lib/env";
import { Database } from "@/types/supabase";

export { BOOKING_BLOCKING_STATUSES } from "@/lib/enums";

let serviceClient: SupabaseClient<Database, any, any> | null = null;

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

export function getServiceSupabaseClient(): SupabaseClient<Database, any, any> {
  if (!serviceClient) {
    serviceClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    });
  }

  return serviceClient;
}

export async function getServerComponentSupabaseClient(): Promise<SupabaseClient<Database, any, any>> {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: createCookieAdapter(cookieStore),
  });
}

export async function getRouteHandlerSupabaseClient(
  cookieStore?: NextCookies,
): Promise<SupabaseClient<Database, any, any>> {
  const store = cookieStore ?? (await cookies());
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: createCookieAdapter(store, store as CookieWriter),
  });
}

export function getMiddlewareSupabaseClient(req: NextRequest, res: NextResponse): SupabaseClient<Database, any, any> {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: createCookieAdapter(req.cookies, res.cookies),
  });
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



