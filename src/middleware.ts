import { NextResponse } from "next/server";

import { CSRF_COOKIE_MAX_AGE_SECONDS, CSRF_COOKIE_NAME } from "@/lib/security/csrf";

import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /_next (Next.js internals)
     * 2. /_static (inside /public)
     * 3. /_vercel (Vercel internals)
     * 4. all root files inside /public (e.g. /favicon.ico)
     */
    "/((?!_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)",
  ],
};

const OPS_API_SERVICES = [
  "allowed-capacities",
  "bookings",
  "customers",
  "dashboard",
  "debug",
  "metrics",
  "occasions",
  "restaurants",
  "settings",
  "strategies",
  "tables",
  "team",
  "zones",
];

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const APP_HOSTS = new Set([`app.${ROOT_DOMAIN}`, "app.localhost"]);
const WEB_HOSTS = new Set([ROOT_DOMAIN, `www.${ROOT_DOMAIN}`, "localhost"]);

function isAssetOrApi(pathname: string) {
  return pathname.startsWith("/_next") ||
    pathname.startsWith("/_static") ||
    pathname.startsWith("/_vercel") ||
    pathname.startsWith("/api/") ||
    /\.[a-zA-Z0-9]+$/.test(pathname);
}

async function handleRouting(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl;

  // Get hostname (e.g. app.sajiloreserve.com or localhost:3000)
  const hostname = (req.headers.get("host") || "").replace(/:3000$/, "").toLowerCase();

  // Define allowed subdomains
  const searchParams = req.nextUrl.searchParams.toString();

  // 1. App Subdomain Logic (restaurant-facing)
  if (APP_HOSTS.has(hostname)) {
    // Preserve assets/API calls
    if (isAssetOrApi(url.pathname)) {
      // Special-case ops API rewrites only when explicitly under /api
      if (!url.pathname.startsWith("/api/")) return NextResponse.next();
    }

    // API Rewrites for Ops
    if (url.pathname.startsWith("/api/")) {
      const [, , service, ...rest] = url.pathname.split("/");
      const pathAfterService = `/${rest.join("/")}`;
      const isPublicRestaurantSchedule =
        service === "restaurants" && /^\/[^/]+\/(schedule|calendar-mask)(\/|$)/.test(pathAfterService);

      if (OPS_API_SERVICES.includes(service) && !isPublicRestaurantSchedule) {
        return NextResponse.rewrite(
          new URL(
            url.pathname.replace(`/api/${service}`, `/api/ops/${service}`) +
            (searchParams.length > 0 ? `?${searchParams}` : ""),
            req.url,
          ),
        );
      }
      // Allow other API routes (e.g. /api/auth) to pass through to src/app/api
      return NextResponse.next();
    }

    // Redirect app.nabatable.com/app/* to app.nabatable.com/* (remove duplicate /app prefix)
    if (url.pathname.startsWith("/app/")) {
      const cleanPath = url.pathname.replace(/^\/app/, "") || "/";
      return NextResponse.redirect(
        new URL(`${cleanPath}${searchParams.length > 0 ? `?${searchParams}` : ""}`, req.url),
        308,
      );
    }

    // Special case: /app alone redirects to root
    if (url.pathname === "/app") {
      return NextResponse.redirect(
        new URL(`/${searchParams.length > 0 ? `?${searchParams}` : ""}`, req.url),
        308,
      );
    }

    // Rewrite all restaurant-facing routes to /app/* for Next.js routing
    // e.g., app.nabatable.com/walk-in -> internally /app/walk-in
    const rewritePath = `/app${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ""}`;
    return NextResponse.rewrite(new URL(rewritePath, req.url));
  }

  // 2. Guest/Root Domain Logic
  if (WEB_HOSTS.has(hostname)) {
    if (!url.pathname.startsWith("/api/")) {
      // Canonicalize restaurant-facing app to the app subdomain
      if (url.pathname.startsWith("/app")) {
        const redirectedPath = url.pathname.replace(/^\/app/, "") || "/";
        return NextResponse.redirect(
          `https://app.${ROOT_DOMAIN}${redirectedPath}${searchParams ? `?${searchParams}` : ""}`,
          308,
        );
      }

      // Support legacy /ops -> app namespace via app subdomain
      if (url.pathname.startsWith("/ops")) {
        return NextResponse.redirect(
          `https://app.${ROOT_DOMAIN}${url.pathname}${searchParams ? `?${searchParams}` : ""}`,
          308,
        );
      }

      // All other routes handled directly
      return NextResponse.next();
    }
  }

  // Default
  return NextResponse.next();
}

export default async function proxy(req: NextRequest) {
  const response = await handleRouting(req);

  // CSRF Token Logic
  const csrfToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!csrfToken) {
    const newCsrfToken = crypto.randomUUID().replace(/-/g, "");

    // Set domain for cross-subdomain cookie sharing in production
    // The leading dot allows cookies to be shared across all subdomains
    if (ROOT_DOMAIN !== "localhost") {
      response.cookies.set({
        name: CSRF_COOKIE_NAME,
        value: newCsrfToken,
        httpOnly: false, // must be readable by the browser to echo in headers
        sameSite: "lax",
        secure: process.env.NODE_ENV !== "development",
        path: "/",
        maxAge: CSRF_COOKIE_MAX_AGE_SECONDS,
        domain: `.${ROOT_DOMAIN}`,
      });
    } else {
      response.cookies.set({
        name: CSRF_COOKIE_NAME,
        value: newCsrfToken,
        httpOnly: false, // must be readable by the browser to echo in headers
        sameSite: "lax",
        secure: process.env.NODE_ENV !== "development",
        path: "/",
        maxAge: CSRF_COOKIE_MAX_AGE_SECONDS,
      });
    }
  }

  return response;
}
