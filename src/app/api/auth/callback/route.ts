import { NextResponse } from "next/server";

import config from "@/config";
import { defaultRedirectForHost, parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const FALLBACK_REDIRECT_CONFIG = config.auth.callbackUrl ?? "/app";

// This route is called after a successful login. It exchanges the code for a session and redirects to the callback URL (see config.js).
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const redirectedFrom = requestUrl.searchParams.get("redirectedFrom");
  const hostname = parseHostname(req);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

  const resolveDestination = () => {
    const sanitized = sanitizeRedirect(redirectedFrom, rootDomain);
    if (!sanitized) {
      if (redirectedFrom) {
        console.warn("[auth/callback] rejected redirect param", redirectedFrom);
      }
      return FALLBACK_REDIRECT_CONFIG ?? defaultRedirectForHost(hostname, rootDomain);
    }
    return sanitized;
  };

  if (code) {
    const supabase = await getRouteHandlerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] failed to exchange session", error.message);
    } else {
      console.log("[auth/callback] session exchanged successfully", { redirectedFrom });
    }
  } else {
    console.warn("[auth/callback] received request without code parameter");
  }

  // URL to redirect to after sign in process completes
  const destination = toAbsoluteRedirectTarget(resolveDestination(), rootDomain);
  const redirectUrl = new URL(destination, requestUrl.origin);
  return NextResponse.redirect(redirectUrl.toString());
}
