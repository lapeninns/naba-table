import { NextRequest, NextResponse } from "next/server";

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

export default async function proxy(req: NextRequest) {
  const url = req.nextUrl;

  // Get hostname (e.g. app.sajiloreserve.com or localhost:3000)
  let hostname = req.headers.get("host")!;

  // Remove port if on localhost
  hostname = hostname.replace(":3000", "");

  // Define allowed subdomains
  const searchParams = req.nextUrl.searchParams.toString();

  // Get the path (e.g. /bookings)
  const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ""}`;

  // 1. App Subdomain Logic
  if (hostname === `app.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}` || hostname === "app.localhost") {
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

    // Rewrite to the (app) folder for non-API routes
    return NextResponse.rewrite(new URL(`/app${path}`, req.url));
  }

  // 2. Guest/Root Domain Logic
  if (
    hostname === "www.sajiloreserve.com" ||
    hostname === process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    hostname === "localhost"
  ) {
    // Rewrite to the (guest) folder, but NOT for API routes
    if (!url.pathname.startsWith("/api/")) {
      return NextResponse.rewrite(new URL(`/guest${path}`, req.url));
    }
  }

  // Default
  return NextResponse.next();
}
