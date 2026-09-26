import type { RestaurantSettingsView } from '../types';

/**
 * Settings routes that render Google drift (field badges, compare dialog, drift strip or the
 * GBP workspace itself). Only these fetch the Google connection and dual-sync state; other
 * settings routes (overview, tables, team, staff communications) read whatever is already
 * cached so the sidebar badges and status pill stay populated without a Google request.
 */
export const GBP_DRIFT_ROUTE_VIEWS: ReadonlySet<RestaurantSettingsView> = new Set([
  'profile',
  'availability',
  'discovery',
  'menu',
  'google-business-profile',
]);

export function isGbpDriftRouteView(routeView: string | null | undefined): boolean {
  return routeView != null && (GBP_DRIFT_ROUTE_VIEWS as ReadonlySet<string>).has(routeView);
}
