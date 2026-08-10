import { googleFetchJson } from './clientTransport';
import { GoogleBusinessProfileError } from './errors';

import type { GoogleFoodMenusResource } from './food-menus';

const GOOGLE_MY_BUSINESS_V4_BASE_URL = 'https://mybusiness.googleapis.com/v4';

export async function getGoogleBusinessProfileFoodMenus(
  accessToken: string,
  foodMenusName: string,
  options: { readMask?: Array<'name' | 'menus'> } = {},
): Promise<GoogleFoodMenusResource> {
  const url = new URL(`${GOOGLE_MY_BUSINESS_V4_BASE_URL}/${foodMenusName.trim()}`);
  if (options.readMask && options.readMask.length > 0) {
    url.searchParams.set('readMask', options.readMask.join(','));
  }

  return googleFetchJson<GoogleFoodMenusResource>(url.toString(), accessToken);
}

export async function updateGoogleBusinessProfileFoodMenus(
  accessToken: string,
  foodMenus: GoogleFoodMenusResource,
  options: { updateMask?: Array<'menus'> } = {},
): Promise<GoogleFoodMenusResource> {
  void accessToken;
  void foodMenus;
  void options;
  throw new GoogleBusinessProfileError('Legacy Google FoodMenus writes are retired.', {
    code: 'GBP_LEGACY_GOOGLE_WRITE_RETIRED',
    status: 409,
  });
}
