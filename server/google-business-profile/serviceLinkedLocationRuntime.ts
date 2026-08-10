import { getGoogleBusinessProfileLocationProfile } from './client';
import {
  getUsableGoogleBusinessProfileAccessToken,
  persistGoogleProviderAccessFailure,
} from './serviceAccessRuntime';
import { resolveLinkedLocationResourceName } from './serviceConnectionContext';
import { ensureExternalProfile, type DbClient, type ExternalProfileRow } from './serviceRepository';

export async function getLinkedExternalProfileWithLocation(
  restaurantId: string,
  client: DbClient,
): Promise<{
  externalProfile: ExternalProfileRow;
  accessToken: string;
  locationResourceName: string;
  location: Awaited<ReturnType<typeof getGoogleBusinessProfileLocationProfile>>;
}> {
  const externalProfile = await ensureExternalProfile(restaurantId, client);

  const { accessToken } = await getUsableGoogleBusinessProfileAccessToken(externalProfile, client);
  const locationResourceName = resolveLinkedLocationResourceName(externalProfile);
  let location;
  try {
    location = await getGoogleBusinessProfileLocationProfile(accessToken, locationResourceName);
  } catch (error) {
    await persistGoogleProviderAccessFailure(error, externalProfile, client);
    throw error;
  }

  return {
    externalProfile,
    accessToken,
    locationResourceName,
    location,
  };
}
