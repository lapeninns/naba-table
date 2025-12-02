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

  console.log("[auth/callback] Request received:", {
    hostname,
    rootDomain,
    hasCode: !!code,
    redirectedFrom,
    fullUrl: req.url,
    headers: {
      host: req.headers.get("host"),
      referer: req.headers.get("referer"),
      userAgent: req.headers.get("user-agent"),
    },
  });

  const resolveDestination = () => {
    const sanitized = sanitizeRedirect(redirectedFrom, rootDomain);
    if (!sanitized) {
      if (redirectedFrom) {
        console.warn("[auth/callback] rejected redirect param", redirectedFrom);
      }
      const fallback = FALLBACK_REDIRECT_CONFIG ?? defaultRedirectForHost(hostname, rootDomain);
      console.log("[auth/callback] Using fallback destination:", fallback);
      return fallback;
    }
    console.log("[auth/callback] Using sanitized destination:", sanitized);
    return sanitized;
  };

  if (code) {
    const supabase = await getRouteHandlerSupabaseClient();
    console.log("[auth/callback] Attempting to exchange code for session...");
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] Session exchange failed:", {
        message: error.message,
        status: error.status,
        code: error.code,
        name: error.name,
      });

      // Redirect to login page with error
      const loginUrl = new URL(config.auth.loginUrl, requestUrl.origin);
      loginUrl.searchParams.set("error", "auth_failed");
      loginUrl.searchParams.set("message", "Authentication link has expired or is invalid. Please try again.");
      console.log("[auth/callback] Redirecting to login due to error:", loginUrl.toString());
      return NextResponse.redirect(loginUrl.toString());
    } else {
      console.log("[auth/callback] Session exchanged successfully:", {
        userId: data.user?.id,
        email: data.user?.email,
        redirectedFrom,
      });

      // Verify session was actually set
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("[auth/callback] Session verification:", {
        hasSession: !!sessionData.session,
        sessionUserId: sessionData.session?.user?.id,
      });
    }
  } else {
    console.warn("[auth/callback] No code parameter in request - possible direct access or malformed link");
  }

  // URL to redirect to after sign in process completes
  const destination = toAbsoluteRedirectTarget(resolveDestination(), rootDomain);
  const redirectUrl = new URL(destination, requestUrl.origin);
  console.log("[auth/callback] Final redirect:", {
    destination,
    redirectUrl: redirectUrl.toString(),
    origin: requestUrl.origin,
  });

  return NextResponse.redirect(redirectUrl.toString());
}
