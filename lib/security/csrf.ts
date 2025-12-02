const TOKEN_COOKIE_NAME = "sr-csrf-token";
const TOKEN_HEADER_NAME = "x-csrf-token";
const TOKEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 3; // 3 days
const TOKEN_BYTES = 32;

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

function setBrowserCsrfCookie(token: string) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" ? location.protocol === "https:" : false;
  const attributes = [
    `max-age=${TOKEN_COOKIE_MAX_AGE_SECONDS}`,
    "path=/",
    "samesite=lax",
    secure ? "secure" : null,
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
  if (existing) return existing;

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
