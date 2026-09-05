/**
 * Production host guard shared by the staging Playwright config and deploy scripts.
 *
 * Production hosts must never be a staging target. Only `staging*.nabatable.com`
 * subdomains are tolerated on the apex domain; everything else on nabatable.com and the
 * canonical `nabatable.vercel.app` alias is production.
 */
export const PRODUCTION_APEX_DOMAIN = 'nabatable.com';

export const PRODUCTION_HOSTS: readonly string[] = [
  PRODUCTION_APEX_DOMAIN,
  `www.${PRODUCTION_APEX_DOMAIN}`,
  `app.${PRODUCTION_APEX_DOMAIN}`,
  `go.${PRODUCTION_APEX_DOMAIN}`,
  'nabatable.vercel.app',
];

export const PRODUCTION_SUPABASE_PROJECT_REF = 'vrdiqfudmwydclqpydee';

export class ProductionHostError extends Error {
  constructor(name: string, hostname: string) {
    super(
      `${name} points at production host "${hostname}"; staging tooling refuses production targets.`,
    );
    this.name = 'ProductionHostError';
  }
}

export function isProductionHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/u, '');
  if (!normalized) return false;
  if (PRODUCTION_HOSTS.includes(normalized)) return true;
  if (normalized.endsWith(`.${PRODUCTION_APEX_DOMAIN}`)) {
    const label = normalized.slice(0, -(PRODUCTION_APEX_DOMAIN.length + 1));
    return !label.startsWith('staging');
  }
  return normalized.includes(PRODUCTION_SUPABASE_PROJECT_REF);
}

export function parseHostname(value: string): string {
  const trimmed = value.trim();
  try {
    return new URL(trimmed).hostname;
  } catch {
    try {
      return new URL(`https://${trimmed}`).hostname;
    } catch {
      return trimmed.toLowerCase();
    }
  }
}

/** Throws when `value` (URL or bare host) names a production host. Returns the URL. */
export function assertNotProductionTarget(name: string, value: string): string {
  const hostname = parseHostname(value);
  if (isProductionHostname(hostname)) {
    throw new ProductionHostError(name, hostname);
  }
  return value.trim();
}

export function requireStagingUrl(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for staging runs and must be an https URL.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL; received "${value}".`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use https; received "${parsed.protocol}".`);
  }
  assertNotProductionTarget(name, value);
  return parsed.origin;
}
