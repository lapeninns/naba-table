import { NextResponse } from "next/server";

import config from "@/config";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// This route is called after a successful login. It exchanges the code for a session and redirects to the callback URL (see config.js).
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const redirectedFrom = requestUrl.searchParams.get("redirectedFrom");

  const resolveDestination = () => {
    const fallback = config.auth.callbackUrl ?? "/";
    if (!redirectedFrom) {
      return fallback;
    }
    if (!redirectedFrom.startsWith("/")) {
      console.warn("[auth/callback] rejected redirect param", redirectedFrom);
      return fallback;
    }
    return redirectedFrom;
  };

  if (code) {
    const supabase = await getRouteHandlerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] failed to exchange session", error.message);
    }
  } else {
    console.warn("[auth/callback] received request without code parameter");
  }

  // URL to redirect to after sign in process completes
  const destination = resolveDestination();
  const redirectUrl = new URL(destination, requestUrl.origin);
  return NextResponse.redirect(redirectUrl.toString());
}
