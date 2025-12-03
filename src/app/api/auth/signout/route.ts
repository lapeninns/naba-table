import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";

import type { Database } from "@/types/supabase";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const secureCookies = env.node.appEnv !== "development";

function buildCookieConfig(options: Record<string, unknown> = {}) {
  const cookieConfig: Record<string, unknown> = {
    ...options,
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax" as const,
    path: "/",
  };

  if (ROOT_DOMAIN !== "localhost") {
    cookieConfig.domain = `.${ROOT_DOMAIN}`;
  }

  return cookieConfig;
}

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();

  // Create Supabase client that can clear cookies
  const supabase = createServerClient<Database>(
    env.supabase.url,
    env.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              console.log(`[auth/signout] Setting cookie: ${name} = "${value.substring(0, 20)}..."`);
              cookieStore.set({ name, value, ...buildCookieConfig(options) });
            });
          } catch (error) {
            console.warn("[auth/signout] Cookie write warning:", error instanceof Error ? error.message : String(error));
          }
        },
      },
    }
  );

  // Sign out - this will trigger cookie deletion via setAll
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[auth/signout] Error signing out:", error.message);
    return NextResponse.json({ error: "Failed to sign out" }, { status: 500 });
  }

  // Explicitly delete auth cookies to be sure
  const authCookieNames = cookieStore.getAll()
    .filter(c => c.name.startsWith("sb-"))
    .map(c => c.name);
  
  console.log("[auth/signout] Deleting auth cookies:", authCookieNames);
  
  for (const name of authCookieNames) {
    cookieStore.delete(name);
  }

  console.log("[auth/signout] User signed out successfully");

  return NextResponse.json({ success: true });
}
