import { normalizeOpsPathname } from '@/lib/url/opsHref';

import {
  getRestaurantSettingsRouteCopy,
  RESTAURANT_SETTINGS_AVAILABILITY_ALIASES,
  RESTAURANT_SETTINGS_ROUTE_MAP,
} from './routes';

const DEFAULT_DESCRIPTION =
  'Configure the restaurant profile, availability, reservation durations, menu, tables, and team access.';

export type RestaurantSettingsHeadingContext = {
  route: ReturnType<typeof getRestaurantSettingsRouteCopy>;
  pageTitle: string;
  pageDescription: string;
  /** When set, chrome shows parent › leaf instead of a single section line. */
  chromeBreadcrumb: { parentTitle: string; parentHref: string; leafTitle: string } | null;
  chromeLeafTitle: string;
  /** Hide the visible page h1; chrome carries the primary heading. */
  suppressVisiblePageTitle: boolean;
  /** Restaurant name appears in chrome; omit duplicate meta on the page header. */
  showRestaurantMetaOnPage: boolean;
  /** Route renders an in-page section nav; omit the page intro block entirely. */
  hidePageIntro: boolean;
};

function routeUsesInternalSectionNav(normalizedPathname: string) {
  const profileHref = normalizeOpsPathname(RESTAURANT_SETTINGS_ROUTE_MAP.profile.href);
  const availabilityHref = normalizeOpsPathname(RESTAURANT_SETTINGS_ROUTE_MAP.availability.href);

  if (normalizedPathname === profileHref || normalizedPathname.startsWith(`${profileHref}/`)) {
    return true;
  }

  if (normalizedPathname === availabilityHref || normalizedPathname.startsWith(`${availabilityHref}/`)) {
    return true;
  }

  return RESTAURANT_SETTINGS_AVAILABILITY_ALIASES.some(
    (item) => normalizeOpsPathname(item.href) === normalizedPathname,
  );
}

export function getRestaurantSettingsHeadingContext(pathname: string): RestaurantSettingsHeadingContext {
  const normalizedPathname = normalizeOpsPathname(pathname);
  const route = getRestaurantSettingsRouteCopy(pathname);

  const alias = RESTAURANT_SETTINGS_AVAILABILITY_ALIASES.find(
    (item) => normalizeOpsPathname(item.href) === normalizedPathname,
  );
  const availabilityParent = RESTAURANT_SETTINGS_ROUTE_MAP.availability;

  if (alias) {
    return {
      route,
      pageTitle: alias.title,
      pageDescription: alias.description,
      chromeBreadcrumb: {
        parentTitle: availabilityParent.title,
        parentHref: availabilityParent.href,
        leafTitle: alias.title,
      },
      chromeLeafTitle: alias.title,
      suppressVisiblePageTitle: true,
      showRestaurantMetaOnPage: false,
      hidePageIntro: routeUsesInternalSectionNav(normalizedPathname),
    };
  }

  const pageTitle = route?.title ?? 'Restaurant settings';
  const pageDescription = route?.description ?? DEFAULT_DESCRIPTION;
  const hidePageIntro = routeUsesInternalSectionNav(normalizedPathname);

  return {
    route,
    pageTitle,
    pageDescription,
    chromeBreadcrumb: null,
    chromeLeafTitle: pageTitle,
    suppressVisiblePageTitle: route != null,
    showRestaurantMetaOnPage: false,
    hidePageIntro,
  };
}
