import { NextResponse } from 'next/server';

export const GBP_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  Vary: 'Cookie, Authorization',
} as const;

const GBP_QUERY_MARKERS = ['dualsync', 'googlebusinessprofile', 'gbp'];
const SAFE_TELEMETRY_KEYS = new Set([
  'eventId',
  'status',
  'errorCode',
  'routeId',
  'operationId',
  'restaurantId',
  'jobId',
  'candidateId',
  'source',
  'kind',
]);
const SAFE_TELEMETRY_VALUE = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/;

function isGbpQueryPart(value: unknown, seen: WeakSet<object>): boolean {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
    return GBP_QUERY_MARKERS.some((marker) => normalized.includes(marker));
  }
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((part) => isGbpQueryPart(part, seen));
  return Object.entries(value).some(
    ([key, part]) => isGbpQueryPart(key, seen) || isGbpQueryPart(part, seen),
  );
}

export function isGbpQueryPersistenceAllowed(queryKey: readonly unknown[]): boolean {
  const seen = new WeakSet<object>();
  return !queryKey.some((part) => isGbpQueryPart(part, seen));
}

export function safeGbpTelemetry(
  attributes: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string | number | boolean | null>> {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!SAFE_TELEMETRY_KEYS.has(key)) continue;
    if (value === null) safe[key] = value;
    if (typeof value === 'string' && SAFE_TELEMETRY_VALUE.test(value)) safe[key] = value;
    if (typeof value === 'number' || typeof value === 'boolean') safe[key] = value;
  }
  return safe;
}

export const GBP_ANALYTICS_BOUNDARY = {
  autocapture: false,
  sessionReplay: false,
  exceptionAttributes: 'safe_allowlist_only',
} as const;

export function gbpNoStoreJson(body: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(GBP_NO_STORE_HEADERS)) headers.set(key, value);
  return NextResponse.json(body, { ...init, headers });
}

export function gbpNoStoreResponse<T extends Response>(response: T): T {
  for (const [key, value] of Object.entries(GBP_NO_STORE_HEADERS)) response.headers.set(key, value);
  return response;
}
