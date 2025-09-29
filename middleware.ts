import { getMiddlewareSupabaseClient } from "@/server/supabase";
import { NextResponse, type NextRequest } from "next/server";

const DASHBOARD_MATCHER = /^\/dashboard(\/.*)?$/;

// Refresh the Supabase session and gate dashboard routes behind authentication.
export async function middleware(req: NextRequest) {
  const response = NextResponse.next();
  const supabase = getMiddlewareSupabaseClient(req, response);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && DASHBOARD_MATCHER.test(req.nextUrl.pathname)) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
