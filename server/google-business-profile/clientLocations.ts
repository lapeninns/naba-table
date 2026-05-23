import { parseGoogleAccountId, parseGoogleLocationId } from './clientResourceNames';
import { googleFetchJson } from './clientTransport';

const GOOGLE_ACCOUNT_MANAGEMENT_BASE_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const GOOGLE_BUSINESS_INFORMATION_BASE_URL =
  'https://mybusinessbusinessinformation.googleapis.com/v1';

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
