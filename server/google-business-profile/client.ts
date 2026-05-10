import { env } from '@/lib/env';

import { GoogleBusinessProfileError } from './errors';

import type { GoogleFoodMenusResource } from './food-menus';

const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_ACCOUNT_MANAGEMENT_BASE_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const GOOGLE_BUSINESS_INFORMATION_BASE_URL =
  'https://mybusinessbusinessinformation.googleapis.com/v1';
const GOOGLE_MY_BUSINESS_V4_BASE_URL = 'https://mybusiness.googleapis.com/v4';

const GOOGLE_BUSINESS_PROFILE_SCOPES = ['https://www.googleapis.com/auth/business.manage'] as const;

type GoogleAccountResponse = {
  accounts?: Array<{
    name: string;
    accountName?: string;
  }>;
  nextPageToken?: string;
};

type GoogleLocationResponse = {
  locations?: Array<{
    name: string;
    title?: string;
    storefrontAddress?: {
      addressLines?: string[];
      locality?: string;
      administrativeArea?: string;
      postalCode?: string;
      regionCode?: string;
    };
    metadata?: {
      placeId?: string;
      canHaveFoodMenus?: boolean;
    };
  }>;
  nextPageToken?: string;
};

type GoogleLocationSummary = NonNullable<GoogleLocationResponse['locations']>[number];

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  name?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

export type GoogleBusinessProfileTokens = {
  accessToken: string;
  expiresIn: number | null;
  refreshToken: string | null;
  grantedScopes: string[];
  tokenType: string | null;
  idToken: string | null;
};

export type GoogleBusinessProfileIdentity = {
  providerUserId: string | null;
  email: string | null;
  name: string | null;
};

export type GoogleBusinessProfileAvailableLocation = {
  accountName: string;
  accountId: string;
  accountDisplayName: string | null;
  locationName: string;
  locationId: string;
  title: string | null;
  addressText: string | null;
  placeId: string | null;
  canHaveFoodMenus: boolean | null;
};

type GoogleTimeOfDay = {
  hours?: number;
  minutes?: number;
};

type GoogleDate = {
  year?: number;
  month?: number;
  day?: number;
};

type GoogleAttributeValue = {
  boolValue?: boolean;
  stringValue?: string;
  displayName?: string;
  enumValue?: {
    displayName?: string;
    value?: string;
  };
};

type GoogleAttributeValueMetadata = {
  value?: boolean | string;
  displayName?: string;
};

export type GoogleBusinessProfileLocationProfile = {
  name: string;
  languageCode?: string;
  timezone?: string;
  timeZone?: string;
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
    languageCode?: string;
    sublocality?: string;
    organization?: string;
    recipients?: string[];
  };
  phoneNumbers?: {
    primaryPhone?: string;
    additionalPhones?: string[];
  };
  websiteUri?: string;
  categories?: {
    primaryCategory?: {
      name?: string;
      displayName?: string;
      moreHoursTypes?: Array<{
        hoursTypeId?: string;
        displayName?: string;
        localizedDisplayName?: string;
      }>;
    };
    additionalCategories?: Array<{
      name?: string;
      displayName?: string;
      moreHoursTypes?: Array<{
        hoursTypeId?: string;
        displayName?: string;
        localizedDisplayName?: string;
      }>;
    }>;
  };
  regularHours?: {
    periods?: Array<{
      openDay?: string;
      closeDay?: string;
      openTime?: string | GoogleTimeOfDay;
      closeTime?: string | GoogleTimeOfDay;
    }>;
  };
  specialHours?: {
    specialHourPeriods?: Array<{
      startDate?: GoogleDate;
      endDate?: GoogleDate;
      openTime?: string | GoogleTimeOfDay;
      closeTime?: string | GoogleTimeOfDay;
      closed?: boolean;
    }>;
  };
  serviceArea?: {
    businessType?: string;
    regionCode?: string;
    places?: {
      placeInfos?: Array<Record<string, unknown>>;
    };
  };
  latlng?: {
    latitude?: number;
    longitude?: number;
  };
  openInfo?: {
    status?: string;
    canReopen?: boolean;
    openingDate?: GoogleDate;
  };
  metadata?: {
    placeId?: string;
    mapsUri?: string;
    newReviewUri?: string;
    timezone?: string;
    timeZone?: string;
    canHaveFoodMenus?: boolean;
  };
  locationState?: {
    canHaveFoodMenu?: boolean;
    canHaveFoodMenus?: boolean;
  };
  profile?: {
    description?: string;
  };
  moreHours?: Array<{
    hoursTypeId?: string;
    periods?: Array<{
      openDay?: string;
      closeDay?: string;
      openTime?: string | GoogleTimeOfDay;
      closeTime?: string | GoogleTimeOfDay;
    }>;
  }>;
  serviceItems?: Array<Record<string, unknown>>;
};

export type GoogleBusinessProfileAttributesResponse = {
  name?: string;
  attributes?: Array<{
    name?: string;
    attributeId?: string;
    displayName?: string;
    groupDisplayName?: string;
    valueType?: string;
    values?: GoogleAttributeValue[];
    repeatedEnumValue?: {
      setValues?: string[];
      unsetValues?: string[];
    };
    uriValue?: string;
    uriValues?: Array<{
      uri?: string;
    }>;
    valueMetadata?: GoogleAttributeValueMetadata[];
    displayStrings?: {
      uiText?: string;
      standaloneText?: string;
      negativeText?: string;
    };
  }>;
};

export type GoogleBusinessProfileAttributesPatch = {
  name?: string;
  attributes?: Array<Record<string, unknown>>;
};

const REQUIRED_LOCATION_PROFILE_MASK = [
  'name',
  'languageCode',
  'title',
  'storefrontAddress',
  'phoneNumbers',
  'websiteUri',
  'categories',
  'serviceArea',
  'latlng',
  'openInfo',
  'metadata',
  'profile',
  'regularHours',
  'specialHours',
  'moreHours',
] as const;

const OPTIONAL_LOCATION_PROFILE_MASK_GROUPS = [['serviceItems']] as const;

function assertConfigured() {
  const { clientId, clientSecret, redirectUri, configured } = env.googleBusinessProfile;
  if (!configured || !clientId || !clientSecret || !redirectUri) {
    throw new GoogleBusinessProfileError(
      'Google Business Profile integration is not configured for this environment.',
      { code: 'GBP_NOT_CONFIGURED', status: 503 },
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function parseTokenError(payload: GoogleTokenResponse): GoogleBusinessProfileError {
  const code = payload.error ?? 'GBP_TOKEN_EXCHANGE_FAILED';
  if (code === 'invalid_grant') {
    return new GoogleBusinessProfileError(
      'Google authorization has expired or been revoked. Please reconnect Google Business Profile.',
      { code: 'GBP_REAUTH_REQUIRED', status: 409 },
    );
  }

  return new GoogleBusinessProfileError(
    payload.error_description ?? 'Google Business Profile authorization failed.',
    { code: 'GBP_TOKEN_EXCHANGE_FAILED', status: 502 },
  );
}

async function googleFetchJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const quotaProject = env.googleBusinessProfile.quotaProject;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(quotaProject ? { 'X-Goog-User-Project': quotaProject } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GoogleBusinessProfileError(
        'Google authorization failed while fetching Business Profile data.',
        {
          code: 'GBP_FORBIDDEN',
          status: 409,
        },
      );
    }

    throw new GoogleBusinessProfileError('Google Business Profile request failed unexpectedly.', {
      code: 'GBP_UPSTREAM_ERROR',
      status: 502,
    });
  }

  const text = await response.text();
  if (!text.trim()) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

function normalizeLocationResourceName(locationNameOrId: string): string {
  const trimmed = locationNameOrId.trim();
  if (trimmed.startsWith('locations/')) {
    return trimmed;
  }
  return `locations/${trimmed}`;
}

function normalizeAccountResourceName(accountNameOrId: string): string {
  const trimmed = accountNameOrId.trim();
  if (trimmed.startsWith('accounts/')) {
    return trimmed;
  }
  return `accounts/${trimmed}`;
}

export function buildGoogleBusinessProfileFoodMenusName(
  accountNameOrId: string,
  locationNameOrId: string,
): string {
  const accountName = normalizeAccountResourceName(accountNameOrId);
  const accountScopedLocation = locationNameOrId.trim().match(/^accounts\/[^/]+\/locations\/[^/]+$/)
    ? locationNameOrId.trim()
    : `${accountName}/${normalizeLocationResourceName(locationNameOrId)}`;

  return `${accountScopedLocation}/foodMenus`;
}

export function buildGoogleBusinessProfileAuthUrl(state: string): string {
  const { clientId, redirectUri } = assertConfigured();
  const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_BUSINESS_PROFILE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeGoogleBusinessProfileCode(
  code: string,
): Promise<GoogleBusinessProfileTokens> {
  const { clientId, clientSecret, redirectUri } = assertConfigured();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw parseTokenError(payload);
  }

  return {
    accessToken: payload.access_token,
    expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : null,
    refreshToken: payload.refresh_token ?? null,
    grantedScopes:
      typeof payload.scope === 'string' ? payload.scope.split(/\s+/).filter(Boolean) : [],
    tokenType: payload.token_type ?? null,
    idToken: payload.id_token ?? null,
  };
}

export async function refreshGoogleBusinessProfileAccessToken(
  refreshToken: string,
): Promise<GoogleBusinessProfileTokens> {
  const { clientId, clientSecret } = assertConfigured();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw parseTokenError(payload);
  }

  return {
    accessToken: payload.access_token,
    expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : null,
    refreshToken: payload.refresh_token ?? null,
    grantedScopes:
      typeof payload.scope === 'string' ? payload.scope.split(/\s+/).filter(Boolean) : [],
    tokenType: payload.token_type ?? null,
    idToken: payload.id_token ?? null,
  };
}

export async function revokeGoogleBusinessProfileToken(token: string): Promise<void> {
  const response = await fetch(GOOGLE_OAUTH_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ token }),
  });

  if (!response.ok && response.status !== 400) {
    throw new GoogleBusinessProfileError('Unable to revoke Google authorization.', {
      code: 'GBP_REVOKE_FAILED',
      status: 502,
    });
  }
}

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

export function parseGoogleAccountId(accountName: string): string {
  const match = accountName.match(/^accounts\/([^/]+)$/);
  if (!match) {
    throw new GoogleBusinessProfileError('Unexpected Google account resource name.', {
      code: 'GBP_INVALID_ACCOUNT_NAME',
      status: 400,
    });
  }

  return match[1]!;
}

export function parseGoogleLocationId(locationName: string): string {
  const accountScoped = locationName.match(/^accounts\/[^/]+\/locations\/([^/]+)$/);
  if (accountScoped) {
    return accountScoped[1]!;
  }

  const globalScoped = locationName.match(/^locations\/([^/]+)$/);
  if (globalScoped) {
    return globalScoped[1]!;
  }

  throw new GoogleBusinessProfileError('Unexpected Google location resource name.', {
    code: 'GBP_INVALID_LOCATION_NAME',
    status: 400,
  });
}

function formatAddressText(
  address: GoogleLocationSummary['storefrontAddress'] | undefined,
): string | null {
  if (!address) {
    return null;
  }

  const parts = [
    ...(address.addressLines ?? []),
    address.locality,
    address.administrativeArea,
    address.postalCode,
    address.regionCode,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

export async function listGoogleBusinessProfileAccounts(
  accessToken: string,
): Promise<Array<{ name: string; accountName: string | null }>> {
  const accounts: Array<{ name: string; accountName: string | null }> = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL(`${GOOGLE_ACCOUNT_MANAGEMENT_BASE_URL}/accounts`);
    url.searchParams.set('pageSize', '20');
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken);
    }

    const response = await googleFetchJson<GoogleAccountResponse>(url.toString(), accessToken);
    for (const account of response.accounts ?? []) {
      accounts.push({
        name: account.name,
        accountName: account.accountName?.trim() || null,
      });
    }
    nextPageToken = response.nextPageToken;
  } while (nextPageToken);

  return accounts;
}

export async function listGoogleBusinessProfileLocations(
  accessToken: string,
  accountName: string,
  accountDisplayName: string | null,
): Promise<GoogleBusinessProfileAvailableLocation[]> {
  const locations: GoogleBusinessProfileAvailableLocation[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL(`${GOOGLE_BUSINESS_INFORMATION_BASE_URL}/${accountName}/locations`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('readMask', 'name,title,storefrontAddress,metadata');
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken);
    }

    const response = await googleFetchJson<GoogleLocationResponse>(url.toString(), accessToken);
    for (const location of response.locations ?? []) {
      locations.push({
        accountName,
        accountId: parseGoogleAccountId(accountName),
        accountDisplayName,
        locationName: location.name,
        locationId: parseGoogleLocationId(location.name),
        title: location.title?.trim() || null,
        addressText: formatAddressText(location.storefrontAddress),
        placeId: location.metadata?.placeId?.trim() || null,
        canHaveFoodMenus:
          typeof location.metadata?.canHaveFoodMenus === 'boolean'
            ? location.metadata.canHaveFoodMenus
            : null,
      });
    }
    nextPageToken = response.nextPageToken;
  } while (nextPageToken);

  return locations;
}

export async function getGoogleBusinessProfileLocationProfile(
  accessToken: string,
  locationNameOrId: string,
): Promise<GoogleBusinessProfileLocationProfile> {
  const locationName = normalizeLocationResourceName(locationNameOrId);
  const baseUrl = new URL(`${GOOGLE_BUSINESS_INFORMATION_BASE_URL}/${locationName}`);
  baseUrl.searchParams.set('readMask', REQUIRED_LOCATION_PROFILE_MASK.join(','));

  const location = await googleFetchJson<GoogleBusinessProfileLocationProfile>(
    baseUrl.toString(),
    accessToken,
  );

  const optionalSegments = await Promise.all(
    OPTIONAL_LOCATION_PROFILE_MASK_GROUPS.map(async (mask) => {
      const url = new URL(`${GOOGLE_BUSINESS_INFORMATION_BASE_URL}/${locationName}`);
      url.searchParams.set('readMask', mask.join(','));
      try {
        return await googleFetchJson<GoogleBusinessProfileLocationProfile>(
          url.toString(),
          accessToken,
        );
      } catch {
        return null;
      }
    }),
  );

  return optionalSegments.reduce<GoogleBusinessProfileLocationProfile>((accumulator, segment) => {
    if (!segment) {
      return accumulator;
    }
    return {
      ...accumulator,
      ...segment,
    };
  }, location);
}

export async function getGoogleBusinessProfileLocationAttributes(
  accessToken: string,
  locationId: string,
): Promise<GoogleBusinessProfileAttributesResponse> {
  const normalizedLocationId = parseGoogleLocationId(normalizeLocationResourceName(locationId));
  return googleFetchJson<GoogleBusinessProfileAttributesResponse>(
    `${GOOGLE_BUSINESS_INFORMATION_BASE_URL}/locations/${normalizedLocationId}/attributes`,
    accessToken,
  );
}

export async function updateGoogleBusinessProfileLocationAttributes(
  accessToken: string,
  locationId: string,
  payload: GoogleBusinessProfileAttributesPatch,
  attributeMask: string[],
): Promise<GoogleBusinessProfileAttributesResponse> {
  const normalizedLocationId = parseGoogleLocationId(normalizeLocationResourceName(locationId));
  const url = new URL(
    `${GOOGLE_BUSINESS_INFORMATION_BASE_URL}/locations/${normalizedLocationId}/attributes`,
  );
  url.searchParams.set('attributeMask', attributeMask.join(','));

  return googleFetchJson<GoogleBusinessProfileAttributesResponse>(url.toString(), accessToken, {
    method: 'PATCH',
    body: JSON.stringify({
      name: `locations/${normalizedLocationId}/attributes`,
      ...payload,
    }),
  });
}

export async function patchGoogleBusinessProfileLocation(
  accessToken: string,
  locationNameOrId: string,
  payload: Record<string, unknown>,
  updateMask: string[],
  options: { validateOnly?: boolean } = {},
): Promise<GoogleBusinessProfileLocationProfile> {
  const locationName = normalizeLocationResourceName(locationNameOrId);
  const url = new URL(`${GOOGLE_BUSINESS_INFORMATION_BASE_URL}/${locationName}`);
  url.searchParams.set('updateMask', updateMask.join(','));
  if (options.validateOnly) {
    url.searchParams.set('validateOnly', 'true');
  }

  return googleFetchJson<GoogleBusinessProfileLocationProfile>(url.toString(), accessToken, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

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
