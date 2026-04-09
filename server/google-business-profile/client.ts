const ACCOUNT_MANAGEMENT_BASE_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const BUSINESS_INFORMATION_BASE_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const BUSINESS_PROFILE_V4_BASE_URL = 'https://mybusiness.googleapis.com/v4';
const BUSINESS_PROFILE_PERFORMANCE_BASE_URL = 'https://businessprofileperformance.googleapis.com/v1';
const GOOGLE_BUSINESS_PROFILE_MAX_REVIEW_ITEMS = 25;
const GOOGLE_BUSINESS_PROFILE_MAX_MEDIA_ITEMS = 24;
const GOOGLE_BUSINESS_PROFILE_PERFORMANCE_METRIC_SETS = [
  [
    'WEBSITE_CLICKS',
    'CALL_CLICKS',
    'BUSINESS_DIRECTION_REQUESTS',
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'BUSINESS_CONVERSATIONS',
    'BUSINESS_BOOKINGS',
    'BUSINESS_FOOD_ORDERS',
    'BUSINESS_FOOD_MENU_CLICKS',
  ],
  ['WEBSITE_CLICKS', 'CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS'],
] as const;
const LOCATION_DETAIL_READ_MASKS = [
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
  ],
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
  ],
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
  ],
  ['name', 'title', 'storefrontAddress', 'phoneNumbers', 'websiteUri'],
] as const;

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
  moreHours?: Array<{
    hoursTypeId?: string;
    periods?: Array<Record<string, unknown>>;
  }>;
  serviceItems?: Array<Record<string, unknown>>;
  openInfo?: {
    status?: string;
    canReopen?: boolean;
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
  nextPageToken?: string;
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
  nextPageToken?: string;
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

function isInvalidArgumentError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('invalid argument');
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
  let lastError: unknown = null;

  for (const mask of LOCATION_DETAIL_READ_MASKS) {
    const url = new URL(`${BUSINESS_INFORMATION_BASE_URL}/${locationName}`);
    url.searchParams.set('readMask', mask.join(','));

    try {
      return await googleFetch<GoogleBusinessProfileLocation>(url, accessToken);
    } catch (error) {
      lastError = error;
      const isLastMask = mask === LOCATION_DETAIL_READ_MASKS[LOCATION_DETAIL_READ_MASKS.length - 1];
      if (!isInvalidArgumentError(error) || isLastMask) {
        throw error;
      }

      console.warn('[google-business-profile] location detail fetch retrying with reduced read mask', {
        locationName,
        attemptedMask: mask.join(','),
        message: error.message,
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Google Business Profile location request failed.');
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
    const reviews: NonNullable<GoogleBusinessProfileReviewsResponse['reviews']> = [];
    let pageToken: string | null = null;
    let averageRating: number | undefined;
    let totalReviewCount: number | undefined;

    do {
      const url = new URL(`${BUSINESS_PROFILE_V4_BASE_URL}/${accountName}/locations/${locationId}/reviews`);
      url.searchParams.set('pageSize', '50');
      url.searchParams.set('orderBy', 'updateTime desc');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await googleFetch<GoogleBusinessProfileReviewsResponse>(url, accessToken);
      reviews.push(...(response.reviews ?? []));
      averageRating = response.averageRating ?? averageRating;
      totalReviewCount = response.totalReviewCount ?? totalReviewCount;
      pageToken = response.nextPageToken ?? null;
    } while (pageToken && reviews.length < GOOGLE_BUSINESS_PROFILE_MAX_REVIEW_ITEMS);

    return {
      reviews: reviews.slice(0, GOOGLE_BUSINESS_PROFILE_MAX_REVIEW_ITEMS),
      averageRating,
      totalReviewCount,
    };
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
    const mediaItems: NonNullable<GoogleBusinessProfileMediaResponse['mediaItems']> = [];
    let pageToken: string | null = null;

    do {
      const url = new URL(`${BUSINESS_PROFILE_V4_BASE_URL}/${accountName}/locations/${locationId}/media`);
      url.searchParams.set('pageSize', '100');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await googleFetch<GoogleBusinessProfileMediaResponse>(url, accessToken);
      mediaItems.push(...(response.mediaItems ?? []));
      pageToken = response.nextPageToken ?? null;
    } while (pageToken && mediaItems.length < GOOGLE_BUSINESS_PROFILE_MAX_MEDIA_ITEMS);

    return {
      mediaItems: mediaItems.slice(0, GOOGLE_BUSINESS_PROFILE_MAX_MEDIA_ITEMS),
    };
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

    let lastError: unknown = null;

    for (const metricSet of GOOGLE_BUSINESS_PROFILE_PERFORMANCE_METRIC_SETS) {
      const url = new URL(`${BUSINESS_PROFILE_PERFORMANCE_BASE_URL}/${locationName}:fetchMultiDailyMetricsTimeSeries`);
      metricSet.forEach((metric) => {
        url.searchParams.append('dailyMetrics', metric);
      });
      url.searchParams.set('dailyRange.start_date.year', String(start.getUTCFullYear()));
      url.searchParams.set('dailyRange.start_date.month', String(start.getUTCMonth() + 1));
      url.searchParams.set('dailyRange.start_date.day', String(start.getUTCDate()));
      url.searchParams.set('dailyRange.end_date.year', String(end.getUTCFullYear()));
      url.searchParams.set('dailyRange.end_date.month', String(end.getUTCMonth() + 1));
      url.searchParams.set('dailyRange.end_date.day', String(end.getUTCDate()));

      try {
        return await googleFetch<GoogleBusinessProfilePerformanceResponse>(url, accessToken);
      } catch (error) {
        lastError = error;
        const isLastMetricSet = metricSet === GOOGLE_BUSINESS_PROFILE_PERFORMANCE_METRIC_SETS[GOOGLE_BUSINESS_PROFILE_PERFORMANCE_METRIC_SETS.length - 1];
        if (!isInvalidArgumentError(error) || isLastMetricSet) {
          throw error;
        }

        console.warn('[google-business-profile] performance fetch retrying with reduced metric set', {
          locationName,
          attemptedMetrics: metricSet.join(','),
          message: error.message,
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Google Business Profile performance request failed.');
  } catch (error) {
    console.warn('[google-business-profile] performance fetch failed', error);
    return null;
  }
}
