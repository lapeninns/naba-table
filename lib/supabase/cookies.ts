import type { CookieOptions } from "@supabase/ssr";

// Shared cookie defaults for Supabase auth (browser + server adapters)
export const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const SHORT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours for non-remembered sessions

export const resolveCookieDomain = (rootDomain?: string | null): string | undefined => {
  const trimmed = rootDomain?.trim();
  if (!trimmed || trimmed === "localhost") return undefined;
  const withoutWildcard = trimmed.startsWith(".") ? trimmed.slice(1) : trimmed;
  // Vercel aliases share a platform suffix, not a tenant cookie domain. Keep both
  // auth and CSRF cookies on the serving host, including separate staging aliases.
  const hostname = withoutWildcard.toLowerCase();
  if (hostname === "vercel.app" || hostname.endsWith(".vercel.app")) return undefined;
  return `.${withoutWildcard}`;
};

export type CookieConfigOptions = {
  domain?: string | null;
  rememberMe?: boolean;
  secure?: boolean;
  sameSite?: CookieOptions["sameSite"];
  path?: string;
  httpOnly?: boolean;
  maxAgeOverrideSeconds?: number;
};

export const buildSupabaseCookieOptions = ({
  domain,
  rememberMe = true,
  secure,
  sameSite = "lax",
  path = "/",
  httpOnly = true,
  maxAgeOverrideSeconds,
}: CookieConfigOptions = {}): CookieOptions & { httpOnly?: boolean } => {
  const maxAge = typeof maxAgeOverrideSeconds === "number"
    ? maxAgeOverrideSeconds
    : rememberMe
      ? DEFAULT_SESSION_MAX_AGE_SECONDS
      : SHORT_SESSION_MAX_AGE_SECONDS;

  const resolvedDomain = resolveCookieDomain(domain ?? undefined);

  const base: CookieOptions & { httpOnly?: boolean } = {
    maxAge,
    sameSite,
    path,
    secure,
  };

  if (resolvedDomain) {
    base.domain = resolvedDomain;
  }

  // httpOnly is ignored by browser client but used by server adapters
  if (httpOnly !== undefined) {
    base.httpOnly = httpOnly;
  }

  return base;
};
