import config from '@/config';

const DEFAULT_FALLBACK_DOMAIN = 'example.com';
const APP_HOST_PREFIX = 'app.';

function normalizeOrigin(candidate?: string | null): string | null {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed || trimmed === '/') {
    return null;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

  if (/^https?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `https://${withoutTrailingSlash}`;
}

function originFromRootDomain(rootDomain?: string | null): string | null {
  const normalized = normalizeOrigin(rootDomain);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (url.hostname === 'localhost') {
      return null;
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function rootOriginFromAppOrigin(candidate?: string | null): string | null {
  const normalized = normalizeOrigin(candidate);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (!url.hostname.toLowerCase().startsWith(APP_HOST_PREFIX)) {
      return normalized;
    }
    url.hostname = url.hostname.slice(APP_HOST_PREFIX.length);
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function getCanonicalSiteUrl(): string {
  return normalizeOrigin(config.domainName) ?? `https://${DEFAULT_FALLBACK_DOMAIN}`;
}

export function getTrustedSiteOrigin(): string {
  const explicitSiteOrigin = rootOriginFromAppOrigin(
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL,
  );
  if (explicitSiteOrigin) {
    return explicitSiteOrigin;
  }

  return (
    rootOriginFromAppOrigin(process.env.BASE_URL) ??
    originFromRootDomain(process.env.NEXT_PUBLIC_ROOT_DOMAIN) ??
    rootOriginFromAppOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    getCanonicalSiteUrl()
  );
}

export function getTrustedAppOrigin(): string {
  const candidate = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? null;
  return normalizeOrigin(candidate) ?? getCanonicalSiteUrl();
}
