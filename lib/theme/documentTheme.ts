export type DocumentTheme = 'guest' | 'app';

export const APP_THEME_PATH_PATTERN = '^/app(?:/|$)';
export const APP_THEME_HOST_PATTERN = '^app(?:\\.|-)';

const appThemePathRegex = new RegExp(APP_THEME_PATH_PATTERN);
const appThemeHostRegex = new RegExp(APP_THEME_HOST_PATTERN);

export function normalizeThemePathname(pathname: string | null | undefined): string {
  const normalized = pathname?.split('?')[0]?.replace(/\/+$/, '') || '/';
  return normalized === '' ? '/' : normalized;
}

export function resolveDocumentThemeForPathname(
  pathname: string | null | undefined,
  hostname?: string | null | undefined,
): DocumentTheme {
  if (hostname && appThemeHostRegex.test(hostname)) {
    return 'app';
  }

  return appThemePathRegex.test(normalizeThemePathname(pathname)) ? 'app' : 'guest';
}
