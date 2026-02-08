import config from "@/config";

const DEFAULT_FALLBACK_DOMAIN = "example.com";

function normalizeOrigin(candidate?: string | null): string | null {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed || trimmed === "/") {
    return null;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");

  if (/^https?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `https://${withoutTrailingSlash}`;
}

export function getCanonicalSiteUrl(): string {
  return normalizeOrigin(config.domainName) ?? `https://${DEFAULT_FALLBACK_DOMAIN}`;
}

export function getTrustedSiteOrigin(): string {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null;
  return normalizeOrigin(candidate) ?? getCanonicalSiteUrl();
}

export function getTrustedAppOrigin(): string {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? null;
  return normalizeOrigin(candidate) ?? getCanonicalSiteUrl();
}
