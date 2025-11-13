const PLACEHOLDER_ORIGIN = 'https://sajiloreservex.local';

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

type ExtraParams = Record<string, string | null | undefined>;

/**
 * Returns a path (relative or absolute) that appends/updates the `redirectedFrom` query parameter.
 * Existing query parameters on the base path are preserved, and new extras can be supplied.
 */
export function withRedirectedFrom(basePath: string, redirectedFrom: string, extras?: ExtraParams): string {
  const isAbsolute = ABSOLUTE_URL_PATTERN.test(basePath);
  const url = new URL(basePath, isAbsolute ? undefined : PLACEHOLDER_ORIGIN);

  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (typeof value === 'string' && value.length > 0) {
        url.searchParams.set(key, value);
      }
    }
  }

  url.searchParams.set('redirectedFrom', redirectedFrom);

  if (isAbsolute) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
