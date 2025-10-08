import appConfig from "@/config";
import { env } from "@/lib/env";
import { getMiddlewareSupabaseClient } from "@/server/supabase";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_MATCHERS = [
  /^\/dashboard(\/.*)?$/,
  /^\/profile(\/.*)?$/,
  /^\/thank-you(\/.*)?$/,
];

// Refresh the Supabase session and gate dashboard routes behind authentication.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Add deprecation headers for unversioned API routes
  if (pathname.startsWith("/api/")) {
    const isVersioned = /^\/api\/v\d+\//.test(pathname);
    const response = NextResponse.next();
    if (!isVersioned) {
      const days = env.testing.routeCompatWindowDays ?? 30;
      const sunset = new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();
      const successor = pathname.replace(/^\/api\//, "/api/v1/");
      response.headers.set("Deprecation", "true");
      response.headers.set("Sunset", sunset);
      response.headers.set("Link", `<${successor}>; rel="successor-version"`);
    }
    return response;
  }

  const response = NextResponse.next();
  const supabase = getMiddlewareSupabaseClient(req, response);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && PROTECTED_MATCHERS.some((matcher) => matcher.test(pathname))) {
    const redirectUrl = req.nextUrl.clone();
    const loginPath = appConfig.auth?.loginUrl ?? "/signin";
    redirectUrl.pathname = loginPath.startsWith("/") ? loginPath : `/${loginPath}`;
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/profile/:path*", "/thank-you/:path*"],
};
