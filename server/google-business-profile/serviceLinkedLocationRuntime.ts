import { getGoogleBusinessProfileLocationProfile } from './client';
import { getUsableGoogleBusinessProfileAccessToken } from './serviceAccessRuntime';
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
  const location = await getGoogleBusinessProfileLocationProfile(accessToken, locationResourceName);

  return {
    externalProfile,
    accessToken,
    locationResourceName,
    location,
  };
}
