"use client";

import { getCanonicalSiteUrl } from "@/lib/site-url";

type Optional<T> = T | undefined | null;

function assertEnv(name: string, value: Optional<string>): string {
  if (!value) {
    throw new Error(`Missing required public environment variable: ${name}`);
  }
  return value;
}

export const clientEnv = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  supabase: {
    url: assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  },
  app: {
    version:
      process.env.NEXT_PUBLIC_APP_VERSION ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
      "web-dev",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? getCanonicalSiteUrl(),
  },
  flags: {
    reserveV2: process.env.NEXT_PUBLIC_RESERVE_V2 === "true",
    enableTestUi: process.env.NEXT_PUBLIC_ENABLE_TEST_UI === "true",
  },
} as const;
