import { NextResponse } from "next/server";

import { CSRF_COOKIE_MAX_AGE_SECONDS, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/security/csrf";
import { RESTAURANT_ADMIN_ROLES, isRestaurantAdminRole } from "@/lib/owner/auth/roles";
import { getMiddlewareSupabaseClient } from "@/server/supabase";
import { fetchUserMemberships } from "@/server/team/access";

import type { NextRequest } from "next/server";

const SAFE_REDIRECT_PREFIXES = [
  "/",
  "/ops",
  "/my-bookings",
  "/reserve",
  "/create",
  "/checkout",
  "/thank-you",
  "/invite",
];

const OPS_PUBLIC_PATHS = ["/ops/login"];
const OPS_ROLE_HEADER = "X-Ops-Role";
const OPS_ROLE_SOURCE_HEADER = "X-Ops-Role-Source";

const ACCOUNT_PROTECTED = [/^\/my-bookings(\/|$)/, /^\/profile(\/|$)/, /^\/invite(\/|$)/];

const isProduction = process.env.NODE_ENV === "production";
const CSRF_UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isSafeRedirectPath(path: string | null): boolean {
  if (!path || typeof path !== "string") return false;
  if (path.startsWith("/signin") || path.startsWith("/ops/login") || path.startsWith("/api/")) return false;
  return SAFE_REDIRECT_PREFIXES.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(`${prefix}/`) ||
      path.startsWith(`${prefix}?`) ||
      path.startsWith(`${prefix}#`),
  );
}

function isGuestAccountPath(pathname: string): boolean {
  return ACCOUNT_PROTECTED.some((pattern) => pattern.test(pathname));
}

function isOpsProtectedPath(pathname: string): boolean {
  if (!pathname.startsWith("/ops")) return false;
  return !OPS_PUBLIC_PATHS.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function buildRedirect(target: string, redirectedFrom: string | null, url: URL) {
  const dest = new URL(target, url);
  if (redirectedFrom && isSafeRedirectPath(redirectedFrom)) {
    dest.searchParams.set("redirectedFrom", redirectedFrom);
  }
  return NextResponse.redirect(dest);
}

function sanitizeRedirectedFrom(url: URL) {
  const redirectedFrom = url.searchParams.get("redirectedFrom");
  if (redirectedFrom && !isSafeRedirectPath(redirectedFrom)) {
    url.searchParams.delete("redirectedFrom");
    return NextResponse.redirect(url);
  }
  return null;
}

function needsCsrfValidation(method: string): boolean {
  return CSRF_UNSAFE_METHODS.has(method.toUpperCase());
}

function constantTimeEquals(a: string | null, b: string | null): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function validateCsrf(request: NextRequest, method: string): NextResponse | null {
  if (!needsCsrfValidation(method)) {
    return null;
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? null;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!constantTimeEquals(cookieToken, headerToken)) {
    return NextResponse.json(
      {
        error: {
          code: "CSRF_MISMATCH",
          message: "Invalid or missing CSRF token",
        },
      },
      { status: 403 },
    );
  }
  return null;
}

function ensureCsrfCookie(request: NextRequest, response: NextResponse) {
  if (request.cookies.get(CSRF_COOKIE_NAME)) {
    return;
  }
  const token = crypto.randomUUID().replace(/-/g, "");
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: false,
    sameSite: "strict",
    secure: isProduction,
    maxAge: CSRF_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

type OpsRoleResolution = {
  role: "owner" | "staff";
  source: "membership" | "fallback" | "error";
};

async function resolveOpsRole(request: NextRequest, response: NextResponse): Promise<OpsRoleResolution | null> {
  try {
    const supabase = getMiddlewareSupabaseClient(request, response);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    try {
      const memberships = await fetchUserMemberships(user.id, supabase);
      const hasAdminRole = memberships.some((membership) => isRestaurantAdminRole(membership.role));
      return {
        role: hasAdminRole ? "owner" : "staff",
        source: "membership",
      };
    } catch (membershipError) {
      console.error("[middleware][ops-role] membership lookup failed", membershipError);
      return {
        role: "staff",
        source: "error",
      };
    }
  } catch (error) {
    console.error("[middleware][ops-role] unexpected failure", error);
    return {
      role: "staff",
      source: "error",
    };
  }
}

function attachOpsRoleHeaders(response: NextResponse, resolution: OpsRoleResolution | null) {
  if (!resolution) return;
  response.headers.set(OPS_ROLE_HEADER, resolution.role);
  response.headers.set(OPS_ROLE_SOURCE_HEADER, resolution.source);
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;
  const method = request.method.toUpperCase();
  const isApiRequest = pathname.startsWith("/api/");
  const isOpsSurfaceApi = pathname.startsWith("/api/ops/") || pathname.startsWith("/api/v1/ops/");
  const isOpsSurfaceUi = pathname.startsWith("/ops");

  if (isApiRequest) {
    const csrfFailure = validateCsrf(request, method);
    if (csrfFailure) {
      ensureCsrfCookie(request, csrfFailure);
      return csrfFailure;
    }
  }

  const redirectSanitizer = sanitizeRedirectedFrom(url);
  if (redirectSanitizer) {
    ensureCsrfCookie(request, redirectSanitizer);
    return redirectSanitizer;
  }

  if (isApiRequest) {
    if (
      isProduction &&
      (pathname.startsWith("/api/test/") || pathname.startsWith("/api/v1/test/"))
    ) {
      const blocked = NextResponse.json({ message: "Not found" }, { status: 404 });
      ensureCsrfCookie(request, blocked);
      return blocked;
    }

    const response = NextResponse.next();
    ensureCsrfCookie(request, response);

    if (!pathname.startsWith("/api/v1/")) {
      response.headers.set("Deprecation", "true");
      response.headers.set("Sunset", "Mon, 01 Jun 2026 00:00:00 GMT");
      response.headers.set("Link", "</api/v1>; rel=\"successor-version\"");
    }

    if (isOpsSurfaceApi) {
      const role = await resolveOpsRole(request, response);
      attachOpsRoleHeaders(response, role);
    }

    return response;
  }

  const redirectedFrom = url.searchParams.get("redirectedFrom") ?? `${pathname}${url.search}`;
  const wantsGuestAccount = isGuestAccountPath(pathname);
  const wantsOps = isOpsProtectedPath(pathname);

  if (wantsGuestAccount || wantsOps) {
    const supabase = getMiddlewareSupabaseClient(request, NextResponse.next());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (wantsGuestAccount && !user) {
      const redirect = buildRedirect("/signin", redirectedFrom, url);
      ensureCsrfCookie(request, redirect);
      return redirect;
    }

    if (wantsOps && !user) {
      const redirect = buildRedirect("/ops/login", redirectedFrom, url);
      ensureCsrfCookie(request, redirect);
      return redirect;
    }
  }

  const response = NextResponse.next();
  ensureCsrfCookie(request, response);

  if (isOpsSurfaceUi) {
    const role = await resolveOpsRole(request, response);
    attachOpsRoleHeaders(response, role);
  }

  if (pathname === "/thank-you") {
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|fonts/).*)"],
};
