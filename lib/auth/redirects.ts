import type { NextRequest } from "next/server";

const ALLOWED_REDIRECT_PREFIXES = ["/app", "/guest", "/bookings", "/restaurants", "/dashboard"] as const;

function isAllowedPath(path: string) {
  return ALLOWED_REDIRECT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function allowedHosts(rootDomain: string): Set<string> {
  const base = rootDomain.toLowerCase();
  const hosts = new Set<string>([base, `www.${base}`, `app.${base}`]);

  if (base === "localhost") {
    hosts.add("localhost");
    hosts.add("127.0.0.1");
    hosts.add("app.localhost");
    hosts.add("www.localhost");
  }

  return hosts;
}

function isLocalLikeHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized.endsWith(".localhost")
    || normalized.startsWith("app.localhost")
  );
}

function normalizeRootDomain(rootDomain: string): string {
  return rootDomain.toLowerCase().replace(/^www\./, "");
}

function buildAppHost(rootDomain: string): string {
  return `app.${normalizeRootDomain(rootDomain)}`;
}

function buildWwwHost(rootDomain: string): string {
  const normalized = normalizeRootDomain(rootDomain);
  return rootDomain.toLowerCase().startsWith("www.") ? rootDomain.toLowerCase() : `www.${normalized}`;
}

function toAbsoluteRedirect(target: string, rootDomain: string): string {
  if (/^https?:\/\//i.test(target)) return target;
  if (rootDomain === "localhost") return target;

  const normalizedRoot = rootDomain.startsWith("www.") ? rootDomain : `www.${rootDomain}`;
  const normalizedPath = target.startsWith("/") ? target : `/${target}`;
  return `https://${normalizedRoot}${normalizedPath}`;
}

export function parseHostname(req: NextRequest): string {
  const headerHost = (req.headers.get("host") || "").toLowerCase();
  const urlHost = req.nextUrl?.hostname?.toLowerCase?.() ?? "";
  const host = urlHost || headerHost;
  return host.replace(/:\d+$/, "");
}

export function defaultRedirectForHost(hostname: string, rootDomain: string): string {
  const normalizedHost = hostname.toLowerCase();
  const appHost = buildAppHost(rootDomain);
  const isAppHost = isLocalLikeHost(normalizedHost)
    ? normalizedHost.startsWith("app.")
    : normalizedHost === appHost;

  if (isAppHost) {
    // On app subdomain, return /dashboard directly - proxy rewrites to /app/dashboard
    if (isLocalLikeHost(normalizedHost)) return "/dashboard";
    return `https://${appHost}/dashboard`;
  }

  // On root domain, return /guest/dashboard for guest-facing flows
  if (isLocalLikeHost(normalizedHost)) return "/guest/dashboard";
  return `https://${buildWwwHost(rootDomain)}/guest/dashboard`;
}

export function sanitizeRedirect(target: string | undefined | null, rootDomain: string): string | undefined {
  if (!target) return undefined;

  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      if (!allowedHosts(rootDomain).has(url.hostname.toLowerCase())) return undefined;
      return isAllowedPath(url.pathname) ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  if (!target.startsWith("/")) return undefined;
  return isAllowedPath(target) ? target : undefined;
}

export function toAbsoluteRedirectTarget(target: string, rootDomain: string): string {
  return toAbsoluteRedirect(target, rootDomain);
}
