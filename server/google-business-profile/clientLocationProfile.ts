import {
  normalizeGoogleBusinessProfileLocationResourceName,
  parseGoogleLocationId,
} from './clientResourceNames';
import { googleFetchJson } from './clientTransport';

const GOOGLE_BUSINESS_INFORMATION_BASE_URL =
  'https://mybusinessbusinessinformation.googleapis.com/v1';

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

export type GoogleBusinessProfileLocationOptionalFetchStatuses = {
  serviceItems?: 'fetched' | 'unavailable';
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
  __nabatableOptionalFetchStatus?: GoogleBusinessProfileLocationOptionalFetchStatuses;
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

export async function getGoogleBusinessProfileLocationProfile(
  accessToken: string,
  locationNameOrId: string,
): Promise<GoogleBusinessProfileLocationProfile> {
  const locationName = normalizeGoogleBusinessProfileLocationResourceName(locationNameOrId);
  const baseUrl = new URL(`${GOOGLE_BUSINESS_INFORMATION_BASE_URL}/${locationName}`);
  baseUrl.searchParams.set('readMask', REQUIRED_LOCATION_PROFILE_MASK.join(','));

  const location = await googleFetchJson<GoogleBusinessProfileLocationProfile>(
    baseUrl.toString(),
    accessToken,
  );
  const optionalFetchStatus: GoogleBusinessProfileLocationOptionalFetchStatuses = {};

  const optionalSegments = await Promise.all(
    OPTIONAL_LOCATION_PROFILE_MASK_GROUPS.map(async (mask) => {
      const url = new URL(`${GOOGLE_BUSINESS_INFORMATION_BASE_URL}/${locationName}`);
      url.searchParams.set('readMask', mask.join(','));
      try {
        const segment = await googleFetchJson<GoogleBusinessProfileLocationProfile>(
          url.toString(),
          accessToken,
        );
        for (const field of mask) {
          optionalFetchStatus[field] = 'fetched';
        }
        return segment;
      } catch {
        for (const field of mask) {
          optionalFetchStatus[field] = 'unavailable';
        }
        return null;
      }
    }),
  );

  const mergedLocation = optionalSegments.reduce<GoogleBusinessProfileLocationProfile>(
    (accumulator, segment) => {
      if (!segment) {
        return accumulator;
      }
      return {
        ...accumulator,
        ...segment,
      };
    },
    location,
  );

  return {
    ...mergedLocation,
    __nabatableOptionalFetchStatus: optionalFetchStatus,
  };
}

export async function getGoogleBusinessProfileLocationAttributes(
  accessToken: string,
  locationId: string,
): Promise<GoogleBusinessProfileAttributesResponse> {
  const normalizedLocationId = parseGoogleLocationId(
    normalizeGoogleBusinessProfileLocationResourceName(locationId),
  );
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
  const normalizedLocationId = parseGoogleLocationId(
    normalizeGoogleBusinessProfileLocationResourceName(locationId),
  );
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
  const locationName = normalizeGoogleBusinessProfileLocationResourceName(locationNameOrId);
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
