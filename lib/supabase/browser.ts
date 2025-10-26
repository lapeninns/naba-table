"use client";

import { createBrowserClient } from "@supabase/ssr";


import { clientEnv } from "@/lib/env-client";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient<Database, any, any> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database, any, any> {
  if (browserClient) {
    return browserClient;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = clientEnv.supabase;

  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    isSingleton: true,
  });

  return browserClient;
}
