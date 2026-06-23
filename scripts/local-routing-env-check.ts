/**
 * Local multi-host routing env check.
 *
 * The proxy (src/proxy.ts) derives the ops/app surface from
 * `NEXT_PUBLIC_ROOT_DOMAIN`: ops lives at `app.${NEXT_PUBLIC_ROOT_DOMAIN}` and
 * `/app/*` on the root host is redirected there. When a developer copies a
 * Vercel preview/staging env into `.env.local`, `NEXT_PUBLIC_ROOT_DOMAIN` can end
 * up as a real domain (e.g. `nabatable.com`) while the browser URLs still point
 * at `localhost`. In that state ops routes silently break locally: `app.localhost`
 * is not recognized as the ops host and `/app/*` redirects to an unresolvable
 * `app.nabatable.com:3000`.
 *
 * This module exposes a pure function that detects that mismatch so
 * `scripts/validate-env.ts` can surface a dev-only warning (never a blocker).
 *
 * See docs/dev-routing.md for the full local multi-host contract.
 */

export type LocalRoutingUrlKey = 'BASE_URL' | 'NEXT_PUBLIC_APP_URL' | 'NEXT_PUBLIC_SITE_URL';

export interface LocalRoutingEnvCheckInput {
  /** `process.env.NODE_ENV` (defaults to 'development' when unset). */
  nodeEnv?: string;
  /** `process.env.VERCEL_ENV`; any truthy value means this is a Vercel build, not local dev. */
  vercelEnv?: string;
  /** `process.env.NEXT_PUBLIC_ROOT_DOMAIN`. */
  rootDomain?: string;
  /** The site/app/base URLs that should agree with the routing domain locally. */
  urls?: Partial<Record<LocalRoutingUrlKey, string | undefined>>;
}

/**
 * `localhost`, IPv4/IPv6 loopback, and any `*.localhost` host are all loopback
 * (`.localhost` is reserved for loopback by RFC 6761).
 */
function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
    return true;
  }
  return host.endsWith('.localhost');
}

function extractHostname(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

/**
 * Returns a warning string when `NEXT_PUBLIC_ROOT_DOMAIN` is a non-localhost
 * domain while the site URLs point at localhost during local development, or
 * `null` when the configuration is consistent / not applicable.
 *
 * Applicability:
 *  - Only for local dev: `NODE_ENV` is `development` (or unset) and `VERCEL_ENV` is unset.
 *  - Only when `NEXT_PUBLIC_ROOT_DOMAIN` is set and is not `localhost`.
 *  - Only when at least one of BASE_URL / NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL
 *    resolves to a loopback host.
 */
export function buildLocalRoutingEnvWarning(input: LocalRoutingEnvCheckInput): string | null {
  // Skip on Vercel builds (preview/production set their own real ROOT_DOMAIN + URLs).
  if (input.vercelEnv) return null;

  // Skip outside local development (e.g. NODE_ENV=production|test).
  const nodeEnv = input.nodeEnv ?? 'development';
  if (nodeEnv !== 'development') return null;

  const rootDomain = input.rootDomain?.trim().toLowerCase();
  // Unset → the proxy defaults to 'localhost' (correct for local dev). 'localhost' → already aligned.
  if (!rootDomain || rootDomain === 'localhost') return null;

  const urls = input.urls ?? {};
  const localhostUrlKeys = (Object.keys(urls) as LocalRoutingUrlKey[])
    .filter((key) => {
      const hostname = extractHostname(urls[key]);
      return hostname !== null && isLoopbackHostname(hostname);
    })
    .sort();

  if (localhostUrlKeys.length === 0) return null;

  const verb = localhostUrlKeys.length === 1 ? 'points' : 'point';
  return (
    `NEXT_PUBLIC_ROOT_DOMAIN is "${rootDomain}" but ${localhostUrlKeys.join(', ')} ${verb} to ` +
    `localhost. Ops routes will not work on app.localhost (the proxy redirects /app/* to ` +
    `app.${rootDomain}). Set NEXT_PUBLIC_ROOT_DOMAIN=localhost for local multi-host dev ` +
    `(see docs/dev-routing.md).`
  );
}
