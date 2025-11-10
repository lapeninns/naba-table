const TOKEN_COOKIE_NAME = "sr-csrf-token";
const TOKEN_HEADER_NAME = "x-csrf-token";
const TOKEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 3; // 3 days

function readCookieValue(source: string, name: string): string | null {
  if (!source || !name) {
    return null;
  }

  const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const pattern = new RegExp(`(?:^|;\\s*)${escaped}\\s*=\\s*([^;]+)`);
  const match = source.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function getBrowserCsrfToken(): string | null {
  if (typeof document === "undefined" || typeof document.cookie !== "string") {
    return null;
  }
  return readCookieValue(document.cookie, TOKEN_COOKIE_NAME);
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
