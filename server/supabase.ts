import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Database } from "@/types/supabase";

export { BOOKING_BLOCKING_STATUSES } from "@/lib/enums";

let serviceClient: SupabaseClient<Database, any, any> | null = null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertSupabaseEnv(varName: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing Supabase environment variable: ${varName}`);
  }
  return value;
}

export function getServiceSupabaseClient(): SupabaseClient<Database, any, any> {
  const supabaseUrl = assertSupabaseEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  const serviceRoleKey = assertSupabaseEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);

  if (!serviceClient) {
    serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return serviceClient;
}

export function getRouteHandlerSupabaseClient(cookieStore = cookies()): SupabaseClient<Database, any, any> {
  return createRouteHandlerClient<Database>({ cookies: () => cookieStore }) as SupabaseClient<Database, any, any>;
}

export function getDefaultRestaurantId(): string {
  return process.env.BOOKING_DEFAULT_RESTAURANT_ID ?? process.env.NEXT_PUBLIC_DEFAULT_RESTAURANT_ID ?? "f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68";
}
