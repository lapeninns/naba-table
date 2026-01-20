import { resolveCookieDomain } from "@/lib/supabase/cookies";

const TOKEN_COOKIE_NAME = "sr-csrf-token";
const TOKEN_HEADER_NAME = "x-csrf-token";
const TOKEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 3; // 3 days
const TOKEN_BYTES = 32;

type CsrfCookieOptions = {
  domain?: string;
  maxAge: number;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  httpOnly: false;
};

type CsrfCookieConfig = {
  rootDomain?: string | null;
  secure: boolean;
};

function readCookieValue(source: string, name: string): string | null {
  if (!source || !name) {
    return null;
  }

  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const pattern = new RegExp(`(?:^|;\\s*)${escaped}\\s*=\\s*([^;]+)`);
  const match = source.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function generateToken(): string | null {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") return null;
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function deriveRootDomain(hostname: string): string | undefined {
  if (!hostname || hostname === "localhost" || hostname.startsWith("127.")) return undefined;
  const parts = hostname.split(".");
  if (parts.length < 2) return undefined;
  return parts.slice(-2).join(".");
}

function resolveBrowserRootDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const envRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  if (envRoot && envRoot !== "localhost") return envRoot;
  return deriveRootDomain(window.location.hostname);
}

export function buildCsrfCookieOptions({ rootDomain, secure }: CsrfCookieConfig): CsrfCookieOptions {
  const resolvedDomain = resolveCookieDomain(rootDomain ?? undefined);
  const options: CsrfCookieOptions = {
    maxAge: TOKEN_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    path: "/",
    secure,
    httpOnly: false,
  };
  if (resolvedDomain) {
    options.domain = resolvedDomain;
  }
  return options;
}

function setBrowserCsrfCookie(token: string) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" ? location.protocol === "https:" : false;
  const rootDomain = resolveBrowserRootDomain();
  const options = buildCsrfCookieOptions({ rootDomain, secure });
  const attributes = [
    `max-age=${options.maxAge}`,
    `path=${options.path}`,
    `samesite=${options.sameSite}`,
    options.domain ? `domain=${options.domain}` : null,
    options.secure ? "secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
  document.cookie = `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; ${attributes}`;
}

export function getBrowserCsrfToken(): string | null {
  if (typeof document === "undefined" || typeof document.cookie !== "string") {
    return null;
  }
  const existing = readCookieValue(document.cookie, TOKEN_COOKIE_NAME);
  if (existing) {
    setBrowserCsrfCookie(existing);
    return existing;
  }

  const token = generateToken();
  if (token) {
    setBrowserCsrfCookie(token);
    return token;
  }
  return null;
}

export function getCsrfConstants() {
  return {
    cookieName: TOKEN_COOKIE_NAME,
    headerName: TOKEN_HEADER_NAME,
    cookieMaxAgeSeconds: TOKEN_COOKIE_MAX_AGE_SECONDS,
  } as const;
}

export const CSRF_COOKIE_NAME = TOKEN_COOKIE_NAME;
export const CSRF_HEADER_NAME = TOKEN_HEADER_NAME;
export const CSRF_COOKIE_MAX_AGE_SECONDS = TOKEN_COOKIE_MAX_AGE_SECONDS;
