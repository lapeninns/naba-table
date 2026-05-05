const REDACTED_QUERY_VALUE = '[redacted]';

export function stripUrlQueryAndHash(value: string): string {
  try {
    const url = new URL(value, 'https://nabatable.local');
    const path = `${url.pathname}${url.hash ? '' : ''}`;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return `${url.origin}${path}`;
    }
    return path || '/';
  } catch {
    const [withoutHash] = value.split('#', 1);
    const [withoutQuery] = withoutHash.split('?', 1);
    return withoutQuery || value;
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
