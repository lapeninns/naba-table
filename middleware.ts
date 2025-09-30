import appConfig from "@/config";
import { getMiddlewareSupabaseClient } from "@/server/supabase";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_MATCHERS = [/^\/dashboard(\/.*)?$/, /^\/profile(\/.*)?$/];

// Refresh the Supabase session and gate dashboard routes behind authentication.
export async function middleware(req: NextRequest) {
  const response = NextResponse.next();
  const supabase = getMiddlewareSupabaseClient(req, response);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && PROTECTED_MATCHERS.some((matcher) => matcher.test(req.nextUrl.pathname))) {
    const redirectUrl = req.nextUrl.clone();
    const loginPath = appConfig.auth?.loginUrl ?? "/signin";
    redirectUrl.pathname = loginPath.startsWith("/") ? loginPath : `/${loginPath}`;
    redirectUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*"],
};
