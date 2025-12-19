import type { NextRequest } from "next/server";

const ALLOWED_REDIRECT_PREFIXES = ["/app", "/guest", "/bookings", "/restaurants"] as const;

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
  const appHosts = new Set([`app.${rootDomain}`, "app.localhost"]);
  if (rootDomain === "localhost") appHosts.add("app.localhost.com");
  const path = appHosts.has(hostname) ? "/app/dashboard" : "/guest/dashboard";
  return path;
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
