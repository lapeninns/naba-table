const FORBIDDEN_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:']);

const GOOGLE_MAPS_HOSTS = new Set(['g.page', 'maps.app.goo.gl']);
const GOOGLE_HOST_SUFFIXES = [
  'google.com',
  'google.co.uk',
  'google.co.in',
  'google.ca',
  'google.com.au',
  'google.ie',
  'google.fr',
  'google.de',
  'google.es',
  'google.it',
  'google.nl',
];

function isGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return GOOGLE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function isGoogleMapsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return GOOGLE_MAPS_HOSTS.has(host) || isGoogleHost(host);
}

function hasAllowedProtocol(url: URL, protocols: ReadonlySet<string>): boolean {
  const protocol = url.protocol.toLowerCase();
  return protocols.has(protocol) && !FORBIDDEN_SCHEMES.has(protocol);
}

function parseAbsoluteUrl(value: string | null | undefined): URL | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function normalizeUrl(url: URL): string {
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

export function safeHttpUrl(value: string | null | undefined): string | null {
  const url = parseAbsoluteUrl(value);
  if (!url || !hasAllowedProtocol(url, new Set(['http:', 'https:']))) {
    return null;
  }

  return normalizeUrl(url);
}

export function safeHttpsUrl(value: string | null | undefined): string | null {
  const url = parseAbsoluteUrl(value);
  if (!url || !hasAllowedProtocol(url, new Set(['https:']))) {
    return null;
  }

  return normalizeUrl(url);
}

export function safeGoogleMapsUrl(value: string | null | undefined): string | null {
  const url = parseAbsoluteUrl(value);
  if (!url || !hasAllowedProtocol(url, new Set(['https:'])) || !isGoogleMapsHost(url.hostname)) {
    return null;
  }

  return normalizeUrl(url);
}

export function safeGoogleReviewUrl(value: string | null | undefined): string | null {
  const url = parseAbsoluteUrl(value);
  if (!url || !hasAllowedProtocol(url, new Set(['https:'])) || !isGoogleMapsHost(url.hostname)) {
    return null;
  }

  const pathname = url.pathname.toLowerCase();
  const href = url.toString().toLowerCase();
  const isReviewPath =
    url.hostname.toLowerCase() === 'g.page' ||
    pathname.includes('review') ||
    pathname.includes('writereview') ||
    href.includes('/local/reviews') ||
    href.includes('writereview') ||
    href.includes('review');

  return isReviewPath ? normalizeUrl(url) : null;
}

function isSafeRelativeHref(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\');
}

export function safePublicHref(value: string | null | undefined, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed && isSafeRelativeHref(trimmed)) {
    return trimmed;
  }

  const safeAbsolute = safeHttpUrl(trimmed);
  if (safeAbsolute) {
    return safeAbsolute;
  }

  const fallbackTrimmed = fallback.trim();
  if (isSafeRelativeHref(fallbackTrimmed)) {
    return fallbackTrimmed;
  }

  return safeHttpUrl(fallbackTrimmed) ?? '/';
}
