import { NextResponse } from "next/server";

import { CSRF_COOKIE_MAX_AGE_SECONDS, CSRF_COOKIE_NAME } from "@/lib/security/csrf";
import { requireOpsAuth } from "@/server/auth/ops-guard";

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

function getRootDomain() {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
}

function getAppHosts(rootDomain: string) {
  const hosts = new Set([`app.${rootDomain}`, "app.localhost"]);
  if (rootDomain === "localhost") hosts.add("app.localhost.com");
  return hosts;
}

function getWebHosts(rootDomain: string) {
  return new Set([rootDomain, `www.${rootDomain}`, "localhost", "127.0.0.1"]);
}

const STATIC_PATHS = new Set(["/favicon.ico", "/robots.txt", "/sitemap.xml"]);

function isStaticOrFramework(pathname: string) {
  if (STATIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/_static")) return true;
  if (pathname.startsWith("/_vercel")) return true;
  // Any file with an extension (assets served from /public)
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  return false;
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

async function handleRouting(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl;
  const rootDomain = getRootDomain();
  const appHosts = getAppHosts(rootDomain);
  const webHosts = getWebHosts(rootDomain);
  const hostname = url.hostname.toLowerCase();
  const port = url.port;
  const isLocalHost = (candidate: string) => candidate === "localhost" || candidate === "127.0.0.1";
  const hostForMatch = hostname;
  const localPort = port && port.length > 0 ? port : "3000";
  const protocol = url.protocol || "http";

  // Define allowed subdomains
  const searchParams = req.nextUrl.searchParams.toString();

  // Early exits for static/framework assets
  if (isStaticOrFramework(url.pathname)) {
    return NextResponse.next();
  }

  // API ops guard (applies on both hosts)
  if (url.pathname.startsWith("/api/ops")) {
    const guardResponse = await requireOpsAuth(req);
    if (guardResponse instanceof NextResponse) return guardResponse;
  }

  // 1. App Subdomain Logic (restaurant-facing)
  if (appHosts.has(hostForMatch)) {
    // Static/framework already handled above; preserve other api paths untouched unless ops rewrite needed
    if (isApiPath(url.pathname)) {
      const [, , service, ...rest] = url.pathname.split("/");
      const pathAfterService = `/${rest.join("/")}`;
      const isPublicRestaurantSchedule =
        service === "restaurants" && /^\/[^/]+\/(schedule|calendar-mask)(\/|$)/.test(pathAfterService);

      if (OPS_API_SERVICES.includes(service) && !isPublicRestaurantSchedule) {
        const guardResponse = await requireOpsAuth(req);
        if (guardResponse instanceof NextResponse) return guardResponse;

        return NextResponse.rewrite(
          new URL(
            url.pathname.replace(`/api/${service}`, `/api/ops/${service}`) +
            (searchParams.length > 0 ? `?${searchParams}` : ""),
            req.url,
          ),
        );
      }

      // Already under /api/ops -> allow through (guarded above)
      return NextResponse.next();
    }

    // If the path starts with /app, redirect to remove it (canonicalize to subdomain root)
    if (url.pathname.startsWith("/app")) {
      const normalizedPath = url.pathname.replace(/^\/app/, "") || "/";
      return NextResponse.redirect(
        new URL(`${normalizedPath}${searchParams.length > 0 ? `?${searchParams}` : ""}`, req.url),
        308,
      );
    }

    // Rewrite all other non-API paths to /app/* so they are handled by src/app/app
    if (!isApiPath(url.pathname)) {
      const rewritePath = `/app${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ""}`;
      return NextResponse.rewrite(new URL(rewritePath, req.url));
    }
  }

  // 2. Guest/Root Domain Logic
  if (webHosts.has(hostForMatch)) {
    if (!isApiPath(url.pathname)) {
      // Canonicalize restaurant-facing app to the app subdomain
      // Redirect /app/* to app.domain/* (stripping /app prefix)
      if (url.pathname.startsWith("/app")) {
        const redirectedPath = url.pathname.replace(/^\/app/, "") || "/";

        if (isLocalHost(hostname)) {
          return NextResponse.redirect(
            new URL(`${protocol}//app.localhost:${localPort}${redirectedPath}${searchParams ? `?${searchParams}` : ""}`),
            308,
          );
        }

        return NextResponse.redirect(
          `https://app.${rootDomain}${redirectedPath}${searchParams ? `?${searchParams}` : ""}`,
          308,
        );
      }

      // Legacy /ops -> management on app host
      if (url.pathname.startsWith("/ops")) {
        if (!isLocalHost(hostname)) {
          return NextResponse.redirect(
            `https://app.${rootDomain}/app/management${searchParams ? `?${searchParams}` : ""}`,
            308,
          );
        }

        // Local dev: keep host, still funnel to /app/management
        return NextResponse.redirect(
          `/app/management${searchParams ? `?${searchParams}` : ""}`,
          308,
        );
      }

      return NextResponse.next();
    }
  }

  // Default
  return NextResponse.next();
}

export default async function proxy(req: NextRequest) {
  const response = await handleRouting(req);
  const rootDomain = getRootDomain();

  // CSRF Token Logic
  const csrfToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!csrfToken) {
    const newCsrfToken = crypto.randomUUID().replace(/-/g, "");

    // Set domain for cross-subdomain cookie sharing in production
    // The leading dot allows cookies to be shared across all subdomains
    if (rootDomain !== "localhost") {
      response.cookies.set({
        name: CSRF_COOKIE_NAME,
        value: newCsrfToken,
        httpOnly: false, // must be readable by the browser to echo in headers
        sameSite: "lax",
        secure: process.env.NODE_ENV !== "development",
        path: "/",
        maxAge: CSRF_COOKIE_MAX_AGE_SECONDS,
        domain: `.${rootDomain}`,
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

// Exported for tests
export { handleRouting };
