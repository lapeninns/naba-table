/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Shared normalisation + canonicalisation primitives reused by every
 * section's registry configs. Keeping these in one place lets the diff
 * engine and state computer trust that two values reaching it through
 * different sections behave consistently.
 */

export function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function canonicalizeText(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const collapsed = normalized.replace(/\s+/g, ' ').toLowerCase();
  return collapsed.length > 0 ? collapsed : null;
}

export function normalizePhone(value: unknown): string | null {
  return normalizeString(value);
}

export function canonicalizePhone(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const comparable = normalized.replace(/[^\d+]/g, '');
  return comparable.length > 0 ? comparable : null;
}

export function normalizeUrl(value: unknown): string | null {
  return normalizeString(value);
}

function extractGoogleStableUrlId(parsed: URL): string | null {
  const host = parsed.host.toLowerCase();
  const pathSegments = parsed.pathname.split('/').filter(Boolean);

  if (host === 'maps.app.goo.gl' && pathSegments.length > 0) {
    return `goo:${pathSegments[0].toLowerCase()}`;
  }
  if (host === 'goo.gl' && pathSegments[0] === 'maps' && pathSegments[1]) {
    return `goo:${pathSegments[1].toLowerCase()}`;
  }
  if (host === 'g.page' && pathSegments.length > 0) {
    return `gpage:${pathSegments[0].toLowerCase()}`;
  }

  const cid = parsed.searchParams.get('cid');
  if (cid) return `cid:${cid}`;
  const placeId =
    parsed.searchParams.get('placeid') ?? parsed.searchParams.get('place_id') ?? null;
  if (placeId) return `placeid:${placeId}`;

  if (
    (host === 'www.google.com' || host === 'google.com' || host === 'maps.google.com') &&
    pathSegments[0] === 'maps' &&
    pathSegments[1] === 'place'
  ) {
    const placeIdLike = pathSegments
      .slice(2)
      .find((segment) =>
        /^(0x[0-9a-f]+:0x[0-9a-f]+|Ch[A-Za-z0-9_-]{15,})$/.test(segment),
      );
    if (placeIdLike) return `placeid:${placeIdLike.toLowerCase()}`;
  }

  return null;
}

export function canonicalizeUrl(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    const stableId = extractGoogleStableUrlId(parsed);
    if (stableId) return stableId;
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${normalizedPath}${parsed.search}`;
  } catch {
    return normalized.toLowerCase();
  }
}

export function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  return null;
}

export function normalizeStringArray(value: unknown): ReadonlyArray<string> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry): entry is string => entry.length > 0);
}

export function canonicalizeStringArray(value: unknown): ReadonlyArray<string> {
  return [...normalizeStringArray(value)].map((entry) => entry.toLowerCase()).sort();
}

export function slugifyDisplay(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
