import { stripUrlQueryAndHash } from '@/lib/security/url-redaction';

type JsonPrimitive = string | number | boolean | null;
export type AnalyticsJsonValue =
  | JsonPrimitive
  | AnalyticsJsonValue[]
  | { [key: string]: AnalyticsJsonValue };

export type AnalyticsProps = Record<string, AnalyticsJsonValue>;

const ALLOWED_ANALYTICS_PROP_KEYS = new Set([
  'bookingId',
  'booking_id',
  'code',
  'date',
  'fields',
  'hasAvatar',
  'idempotent',
  'is_online',
  'kind',
  'method',
  'party',
  'path',
  'range',
  'redirectedFrom',
  'referrer',
  'reservationId',
  'restaurantId',
  'restaurant_id',
  'section',
  'size',
  'source',
  'status',
  'surface',
  'type',
  'view',
]);

const QUERY_STRIPPED_PROP_KEYS = new Set(['path', 'redirectedFrom', 'route', 'referrer']);

function toAnalyticsJsonValue(value: unknown): AnalyticsJsonValue | undefined {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    const arrayValue = value
      .map((entry) => toAnalyticsJsonValue(entry))
      .filter((entry): entry is AnalyticsJsonValue => entry !== undefined);
    return arrayValue;
  }
  return undefined;
}

export function sanitizeAnalyticsProps(
  input?: Record<string, unknown>,
): AnalyticsProps | undefined {
  if (!input) return undefined;

  const props: AnalyticsProps = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (!ALLOWED_ANALYTICS_PROP_KEYS.has(key)) continue;
    const value = toAnalyticsJsonValue(rawValue);
    if (value === undefined || value === null) continue;
    props[key] =
      typeof value === 'string' && QUERY_STRIPPED_PROP_KEYS.has(key)
        ? stripUrlQueryAndHash(value)
        : value;
  }

  return Object.keys(props).length > 0 ? props : undefined;
}
