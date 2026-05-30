import { sanitizeLocalRedirectPath } from './safe-local-path';

export const APP_REQUEST_PATH_HEADER = 'x-nabatable-request-path';

export function buildAppRequestPath(pathname: string, searchParams: string): string {
  const normalizedPathname =
    pathname === '/app' || pathname.startsWith('/app/')
      ? pathname
      : pathname === '/'
        ? '/app'
        : `/app${pathname}`;

  return `${normalizedPathname}${searchParams ? `?${searchParams}` : ''}`;
}

export function sanitizeAppRequestPath(value: string | null | undefined, fallback: string): string {
  return sanitizeLocalRedirectPath(value, {
    fallback,
    allowedPrefixes: ['/app/settings/restaurant'],
  });
}
