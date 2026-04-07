const ACCOUNT_MANAGEMENT_BASE_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const BUSINESS_INFORMATION_BASE_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const BUSINESS_PROFILE_V4_BASE_URL = 'https://mybusiness.googleapis.com/v4';
const BUSINESS_PROFILE_PERFORMANCE_BASE_URL = 'https://businessprofileperformance.googleapis.com/v1';

export type GoogleBusinessProfileAccount = {
  name: string;
  accountName?: string;
  type?: string;
  role?: string;
};

export type GoogleBusinessProfileLocation = {
  name: string;
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  phoneNumbers?: {
    primaryPhone?: string;
    additionalPhones?: string[];
  };
  websiteUri?: string;
  regularHours?: {
    periods?: Array<Record<string, unknown>>;
  };
  specialHours?: {
    specialHourPeriods?: Array<Record<string, unknown>>;
  };
  profile?: {
    description?: string;
  };
  primaryCategory?: {
    displayName?: string;
  };
  additionalCategories?: Array<{
    displayName?: string;
  }>;
  metadata?: {
    mapsUri?: string;
    newReviewUri?: string;
    placeId?: string;
  };
};

export type GoogleBusinessProfileAttributesResponse = {
  attributes?: Array<{
    attributeId?: string;
    name?: string;
    displayName?: string;
    valueType?: string;
    values?: Array<{
      displayName?: string;
      value?: unknown;
      boolValue?: boolean;
      uriValue?: string;
      placeActionValue?: Record<string, unknown>;
      repeatedEnumValue?: {
        setValues?: Array<{ displayName?: string }>;
      };
      enumValue?: {
        displayName?: string;
      };
    }>;
  }>;
};

export type GoogleBusinessProfileReviewsResponse = {
  reviews?: Array<{
    reviewId?: string;
    starRating?: string;
    comment?: string;
    createTime?: string;
    updateTime?: string;
    reviewer?: {
      displayName?: string;
    };
  }>;
  averageRating?: number;
  totalReviewCount?: number;
};

export type GoogleBusinessProfileMediaResponse = {
  mediaItems?: Array<{
    name?: string;
    mediaFormat?: string;
    locationAssociation?: {
      category?: string;
    };
    sourceUrl?: string;
    googleUrl?: string;
    thumbnailUrl?: string;
    description?: string;
  }>;
};

export type GoogleBusinessProfilePerformanceResponse = {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetricTimeSeries?: Array<{
      dailyMetric?: string;
      timeSeries?: {
        datedValues?: Array<{
          date?: { year?: number; month?: number; day?: number };
          value?: string;
        }>;
      };
    }>;
  }>;
};

async function googleFetch<T>(url: URL | string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as
    | ({ error?: { message?: string } } & T)
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Google Business Profile request failed (${response.status}).`);
  }

  return payload as T;
}

export async function listGoogleBusinessProfileAccounts(accessToken: string) {
  const url = new URL(`${ACCOUNT_MANAGEMENT_BASE_URL}/accounts`);
  const response = await googleFetch<{ accounts?: GoogleBusinessProfileAccount[] }>(url, accessToken);
  return response.accounts ?? [];
}

export async function listGoogleBusinessProfileLocations(
  accessToken: string,
  accountName: string,
): Promise<GoogleBusinessProfileLocation[]> {
  const items: GoogleBusinessProfileLocation[] = [];
  let pageToken: string | null = null;

  do {
    const url = new URL(`${BUSINESS_INFORMATION_BASE_URL}/${accountName}/locations`);
    url.searchParams.set(
      'readMask',
      [
        'name',
        'title',
        'storefrontAddress',
        'phoneNumbers',
        'websiteUri',
        'regularHours',
        'specialHours',
        'primaryCategory',
        'additionalCategories',
        'profile',
        'metadata',
      ].join(','),
    );
    url.searchParams.set('pageSize', '100');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await googleFetch<{
      locations?: GoogleBusinessProfileLocation[];
      nextPageToken?: string;
    }>(url, accessToken);
    items.push(...(response.locations ?? []));
    pageToken = response.nextPageToken ?? null;
  } while (pageToken);

  return items;
}

export async function getGoogleBusinessProfileLocation(
  accessToken: string,
  locationName: string,
): Promise<GoogleBusinessProfileLocation> {
  const url = new URL(`${BUSINESS_INFORMATION_BASE_URL}/${locationName}`);
  url.searchParams.set(
    'readMask',
    [
      'name',
      'title',
      'storefrontAddress',
      'phoneNumbers',
      'websiteUri',
      'regularHours',
      'specialHours',
      'primaryCategory',
      'additionalCategories',
      'profile',
      'metadata',
      'moreHours',
      'serviceItems',
      'openInfo',
    ].join(','),
  );

  return googleFetch<GoogleBusinessProfileLocation>(url, accessToken);
}

export async function getGoogleBusinessProfileAttributes(
  accessToken: string,
  locationName: string,
): Promise<GoogleBusinessProfileAttributesResponse | null> {
  try {
    return await googleFetch<GoogleBusinessProfileAttributesResponse>(
      `${BUSINESS_INFORMATION_BASE_URL}/${locationName}/attributes`,
      accessToken,
    );
  } catch (error) {
    console.warn('[google-business-profile] attributes fetch failed', error);
    return null;
  }
}

export async function listGoogleBusinessProfileReviews(
  accessToken: string,
  accountName: string,
  locationId: string,
): Promise<GoogleBusinessProfileReviewsResponse | null> {
  try {
    const url = new URL(`${BUSINESS_PROFILE_V4_BASE_URL}/${accountName}/locations/${locationId}/reviews`);
    url.searchParams.set('pageSize', '10');
    url.searchParams.set('orderBy', 'updateTime desc');
    return await googleFetch<GoogleBusinessProfileReviewsResponse>(url, accessToken);
  } catch (error) {
    console.warn('[google-business-profile] reviews fetch failed', error);
    return null;
  }
}

export async function listGoogleBusinessProfileMedia(
  accessToken: string,
  accountName: string,
  locationId: string,
): Promise<GoogleBusinessProfileMediaResponse | null> {
  try {
    const url = new URL(`${BUSINESS_PROFILE_V4_BASE_URL}/${accountName}/locations/${locationId}/media`);
    url.searchParams.set('pageSize', '10');
    return await googleFetch<GoogleBusinessProfileMediaResponse>(url, accessToken);
  } catch (error) {
    console.warn('[google-business-profile] media fetch failed', error);
    return null;
  }
}

export async function fetchGoogleBusinessProfilePerformance(
  accessToken: string,
  locationName: string,
): Promise<GoogleBusinessProfilePerformanceResponse | null> {
  try {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 30));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));

    const url = new URL(`${BUSINESS_PROFILE_PERFORMANCE_BASE_URL}/${locationName}:fetchMultiDailyMetricsTimeSeries`);
    ['WEBSITE_CLICKS', 'CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS'].forEach((metric) => {
      url.searchParams.append('dailyMetrics', metric);
    });
    url.searchParams.set('dailyRange.start_date.year', String(start.getUTCFullYear()));
    url.searchParams.set('dailyRange.start_date.month', String(start.getUTCMonth() + 1));
    url.searchParams.set('dailyRange.start_date.day', String(start.getUTCDate()));
    url.searchParams.set('dailyRange.end_date.year', String(end.getUTCFullYear()));
    url.searchParams.set('dailyRange.end_date.month', String(end.getUTCMonth() + 1));
    url.searchParams.set('dailyRange.end_date.day', String(end.getUTCDate()));

    return await googleFetch<GoogleBusinessProfilePerformanceResponse>(url, accessToken);
  } catch (error) {
    console.warn('[google-business-profile] performance fetch failed', error);
    return null;
  }
}
