import { createGoogleUpdatesClient } from '@/server/google-business-profile/googleUpdates';

export function getGoogleUpdatesClient(accessToken: string) {
  return createGoogleUpdatesClient({ accessToken });
}
