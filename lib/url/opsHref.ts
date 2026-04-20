const PLACEHOLDER_ORIGIN = 'https://ops.local';

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

function ensureLeadingSlash(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function normalizeOpsPathname(target: string): string {
  const url = new URL(target, PLACEHOLDER_ORIGIN);
  const pathname = ensureLeadingSlash(url.pathname);

  if (pathname === '/app') {
    return '/';
  }

  if (pathname.startsWith('/app/')) {
    return pathname.slice(4);
  }

  return pathname;
}

export function opsHref(target: string): string {
  const isAbsolute = ABSOLUTE_URL_PATTERN.test(target);
  const url = new URL(target, isAbsolute ? undefined : PLACEHOLDER_ORIGIN);
  const normalizedPathname = ensureLeadingSlash(url.pathname);

  url.pathname =
    normalizedPathname === '/app' || normalizedPathname.startsWith('/app/')
      ? normalizedPathname
      : normalizedPathname === '/'
        ? '/app'
        : `/app${normalizedPathname}`;

  if (isAbsolute) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
