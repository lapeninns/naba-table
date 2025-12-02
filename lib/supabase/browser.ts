"use client";

import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env-client";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserClient: SupabaseClient<Database, any, any> | null = null;

// Get cookie domain for cross-subdomain sharing (matches server config)
function getCookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  
  const hostname = window.location.hostname;
  // Don't set domain for localhost
  if (hostname === "localhost" || hostname.startsWith("127.")) {
    return undefined;
  }
  
  // For production, use root domain with leading dot for subdomain sharing
  // e.g., ".nabatable.com" allows cookies on www.nabatable.com and app.nabatable.com
  const rootDomain = clientEnv.rootDomain ?? "nabatable.com";
  return `.${rootDomain}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseBrowserClient(): SupabaseClient<Database, any, any> {
  if (browserClient) {
    return browserClient;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = clientEnv.supabase;
  const cookieDomain = getCookieDomain();

  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    isSingleton: true,
    cookieOptions: cookieDomain ? {
      domain: cookieDomain,
      path: "/",
      sameSite: "lax",
      secure: window.location.protocol === "https:",
    } : undefined,
  });

  return browserClient;
}
