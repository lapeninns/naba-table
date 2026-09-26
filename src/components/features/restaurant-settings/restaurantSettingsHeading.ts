import { getRestaurantSettingsRouteCopy } from './routes';

const DEFAULT_DESCRIPTION =
  'Configure the restaurant profile, availability, dining durations, menu, tables, and team access.';

export type RestaurantSettingsHeadingContext = {
  route: ReturnType<typeof getRestaurantSettingsRouteCopy>;
  pageTitle: string;
  pageDescription: string;
  /** Title of the chrome's only h1. */
  chromeLeafTitle: string;
  /**
   * True when the route's content opens with its own purpose line (every settings route does,
   * through `RestaurantSettingsCommandCenter`), so the shell must not repeat it.
   */
  hidePageIntro: boolean;
};

export function getRestaurantSettingsHeadingContext(
  pathname: string,
): RestaurantSettingsHeadingContext {
  const route = getRestaurantSettingsRouteCopy(pathname);
  const pageTitle = route?.title ?? 'Restaurant settings';

  return {
    route,
    pageTitle,
    pageDescription: route?.description ?? DEFAULT_DESCRIPTION,
    chromeLeafTitle: pageTitle,
    hidePageIntro: route != null,
  };
}
