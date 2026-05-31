const REDACTED_QUERY_VALUE = '[redacted]';
const REDACTED_PATH_SEGMENT = '[redacted]';

const SENSITIVE_PATH_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /^\/invite\/[^/?#]+(\/.*)?$/i,
    replacement: `/invite/${REDACTED_PATH_SEGMENT}$1`,
  },
  {
    pattern: /^\/api\/team\/invitations\/[^/?#]+(\/.*)?$/i,
    replacement: `/api/team/invitations/${REDACTED_PATH_SEGMENT}$1`,
  },
  {
    pattern: /^\/bookings\/recover\/[^/?#]+(\/.*)?$/i,
    replacement: `/bookings/recover/${REDACTED_PATH_SEGMENT}$1`,
  },
  {
    pattern: /^\/api\/bookings\/recover\/[^/?#]+(\/.*)?$/i,
    replacement: `/api/bookings/recover/${REDACTED_PATH_SEGMENT}$1`,
  },
];

function redactSensitivePathSegments(pathname: string): string {
  for (const { pattern, replacement } of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(pathname)) {
      return pathname.replace(pattern, replacement);
    }
  }
  return pathname;
}

export function stripUrlQueryAndHash(value: string): string {
  try {
    const url = new URL(value, 'https://nabatable.local');
    const path = redactSensitivePathSegments(url.pathname);
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return `${url.origin}${path}`;
    }
    return path || '/';
  } catch {
    const [withoutHash] = value.split('#', 1);
    const [withoutQuery] = withoutHash.split('?', 1);
    return redactSensitivePathSegments(withoutQuery) || value;
  }
}

export function redactUrlQuery(value: string): string {
  const looksUrlLike =
    value.includes('?') &&
    (value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://'));
  if (!looksUrlLike) return value;

  try {
    const isAbsolute = value.startsWith('http://') || value.startsWith('https://');
    const url = new URL(value, 'https://nabatable.local');
    for (const key of Array.from(url.searchParams.keys())) {
      url.searchParams.set(key, REDACTED_QUERY_VALUE);
    }
    const redacted = `${url.pathname}${url.search}${url.hash}`;
    return isAbsolute ? `${url.origin}${redacted}` : redacted;
  } catch {
    return value.replace(/([?&][^=&\s]+)=([^&\s]*)/g, `$1=${REDACTED_QUERY_VALUE}`);
  }
}
