"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

let browserClient: SupabaseClient<Database, any, any> | null = null;

function assertBrowserEnv(varName: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing Supabase environment variable: ${varName}`);
  }
  return value;
}

export function getSupabaseBrowserClient(): SupabaseClient<Database, any, any> {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = assertBrowserEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = assertBrowserEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    isSingleton: true,
  });

  return browserClient;
}
