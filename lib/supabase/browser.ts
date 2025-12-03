"use client";

import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env-client";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserClient: SupabaseClient<Database, any, any> | null = null;

function deriveRootDomain(hostname: string): string | undefined {
  // If already an IP or localhost, do not set a domain attribute
  if (!hostname || hostname === "localhost" || hostname.startsWith("127.")) return undefined;
  const parts = hostname.split(".");
  if (parts.length < 2) return undefined;
  const lastTwo = parts.slice(-2).join(".");
  return lastTwo;
}

// Get cookie domain for cross-subdomain sharing (matches server config)
function getCookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const hostname = window.location.hostname;
  const envRoot = clientEnv.rootDomain?.trim();
  const rootDomain = envRoot && envRoot.length > 0 ? envRoot : deriveRootDomain(hostname);

  // Don't force a domain attribute if we can't confidently derive one
  if (!rootDomain || rootDomain === "localhost") {
    return undefined;
  }

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
