import type { NextRequest } from "next/server";

const ALLOWED_REDIRECT_PREFIXES = ["/app", "/guest", "/bookings", "/restaurants"] as const;

export function parseHostname(req: NextRequest): string {
  return (req.headers.get("host") || "").replace(/:3000$/, "").toLowerCase();
}

export function defaultRedirectForHost(hostname: string, rootDomain: string): string {
  const appHosts = new Set([`app.${rootDomain}`, "app.localhost"]);
  return appHosts.has(hostname) ? "/app/dashboard" : "/guest/dashboard";
}

export function sanitizeRedirect(target: string | undefined | null): string | undefined {
  if (!target || !target.startsWith("/")) return undefined;
  const isAllowed = ALLOWED_REDIRECT_PREFIXES.some((prefix) => target === prefix || target.startsWith(`${prefix}/`));
  return isAllowed ? target : undefined;
}
