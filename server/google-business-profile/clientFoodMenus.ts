import { googleFetchJson } from './clientTransport';

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
  const url = new URL(`${GOOGLE_MY_BUSINESS_V4_BASE_URL}/${foodMenus.name.trim()}`);
  if (options.updateMask && options.updateMask.length > 0) {
    url.searchParams.set('updateMask', options.updateMask.join(','));
  }

  return googleFetchJson<GoogleFoodMenusResource>(url.toString(), accessToken, {
    method: 'PATCH',
    body: JSON.stringify(foodMenus),
  });
}
