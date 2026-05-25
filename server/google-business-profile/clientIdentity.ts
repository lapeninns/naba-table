import { googleFetchJson } from './clientTransport';

const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  name?: string;
};

export type GoogleBusinessProfileIdentity = {
  providerUserId: string | null;
  email: string | null;
  name: string | null;
};

export async function fetchGoogleBusinessProfileIdentity(
  accessToken: string,
): Promise<GoogleBusinessProfileIdentity> {
  const payload = await googleFetchJson<GoogleUserInfo>(GOOGLE_USERINFO_URL, accessToken);

  return {
    providerUserId: payload.sub ?? null,
    email: payload.email ?? null,
    name: payload.name ?? null,
  };
}
