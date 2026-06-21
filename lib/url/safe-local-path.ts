type SanitizeLocalRedirectPathOptions = {
  fallback?: string;
  allowedPrefixes?: readonly string[];
  allowAbsolute?: boolean;
};

function matchesAllowedPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function sanitizeLocalRedirectPath(
  raw: string | null | undefined,
  options: SanitizeLocalRedirectPathOptions = {},
): string {
  const fallback = options.fallback ?? '/';
  if (typeof raw !== 'string') {
    return fallback;
  }

  let candidate = raw.trim();
  if (!candidate || /\\|%5c/i.test(candidate)) {
    return fallback;
  }

  if (/^https?:\/\//i.test(candidate)) {
    if (!options.allowAbsolute) {
      return fallback;
    }

    try {
      const url = new URL(candidate);
      candidate = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return fallback;
    }
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  try {
    const base = 'https://nabatable.local';
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base) {
      return fallback;
    }

    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (path.startsWith('//') || /\\|%5c/i.test(path)) {
      return fallback;
    }

    if (
      options.allowedPrefixes &&
      !matchesAllowedPrefix(parsed.pathname, options.allowedPrefixes)
    ) {
      return fallback;
    }

    return path || fallback;
  } catch {
    return fallback;
  }
}
