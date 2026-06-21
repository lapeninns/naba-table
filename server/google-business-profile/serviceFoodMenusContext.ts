import { buildGoogleBusinessProfileFoodMenusName } from './client';
import {
  assertGoogleFoodMenusEligible,
  assertGooglePushEnabled,
  resolveGoogleBusinessProfileAccountNameOrId,
} from './serviceConnectionContext';
import { getLinkedExternalProfileWithLocation } from './serviceLinkedLocationRuntime';

import type { DbClient } from './serviceRepository';

export type GoogleBusinessProfileFoodMenusContext = {
  externalProfileId: string;
  accessToken: string;
  foodMenusName: string;
  canHaveFoodMenus: boolean | null;
};

export async function getGoogleBusinessProfileFoodMenusContext(params: {
  restaurantId: string;
  client: DbClient;
  requirePushEnabled?: boolean;
}): Promise<GoogleBusinessProfileFoodMenusContext> {
  const { externalProfile, accessToken, locationResourceName, location } =
    await getLinkedExternalProfileWithLocation(params.restaurantId, params.client);
  if (params.requirePushEnabled) {
    assertGooglePushEnabled(externalProfile);
  }
  const canHaveFoodMenus = assertGoogleFoodMenusEligible(location);
  const accountNameOrId = resolveGoogleBusinessProfileAccountNameOrId(externalProfile);

  return {
    externalProfileId: externalProfile.id,
    accessToken,
    foodMenusName: buildGoogleBusinessProfileFoodMenusName(accountNameOrId, locationResourceName),
    canHaveFoodMenus,
  };
}
