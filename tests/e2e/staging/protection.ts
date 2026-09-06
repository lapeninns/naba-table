import type { APIRequestContext } from '@playwright/test';

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'fetch']);

/** Playwright transport errors include full headers and URLs even when tracing is off. */
export async function safeStagingTransport<T>(
  method: string,
  origin: string,
  operation: () => T | Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch {
    // Never retain the original exception, stack or cause: each may contain credentials.
    throw new Error(`Staging ${method} request to ${origin} failed; transport details suppressed.`);
  }
}

/** Header credentials never follow redirects or leave the two configured Vercel origins. */
export function withStagingProtection(
  context: APIRequestContext,
  publicUrl: string,
  opsUrl: string,
  secret: string | undefined,
): APIRequestContext {
  const allowed = new Set([new URL(publicUrl).origin, new URL(opsUrl).origin]);
  return new Proxy(context, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property);
      if (typeof value !== 'function') return value;
      if (typeof property !== 'string' || !METHODS.has(property)) return value.bind(target);
      return (url: string, options: Record<string, unknown> = {}) => {
        const destination = new URL(url, publicUrl);
        const headers = { ...(options.headers as Record<string, string> | undefined) };
        delete headers['x-vercel-protection-bypass'];
        if (secret && allowed.has(destination.origin)) {
          headers['x-vercel-protection-bypass'] = secret;
          // Playwright otherwise forwards custom headers to redirected origins.
          return safeStagingTransport(property.toUpperCase(), destination.origin, () =>
            Reflect.apply(value, target, [
              destination.href,
              { ...options, headers, maxRedirects: 0 },
            ]),
          );
        }
        return safeStagingTransport(property.toUpperCase(), destination.origin, () =>
          Reflect.apply(value, target, [destination.href, { ...options, headers }]),
        );
      };
    },
  });
}
