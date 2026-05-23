import { GoogleBusinessProfileError } from './errors';

export function normalizeGoogleBusinessProfileLocationResourceName(
  locationNameOrId: string,
): string {
  const trimmed = locationNameOrId.trim();
  if (trimmed.startsWith('locations/')) {
    return trimmed;
  }
  return `locations/${trimmed}`;
}

export function normalizeGoogleBusinessProfileAccountResourceName(accountNameOrId: string): string {
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
  const accountName = normalizeGoogleBusinessProfileAccountResourceName(accountNameOrId);
  const accountScopedLocation = locationNameOrId.trim().match(/^accounts\/[^/]+\/locations\/[^/]+$/)
    ? locationNameOrId.trim()
    : `${accountName}/${normalizeGoogleBusinessProfileLocationResourceName(locationNameOrId)}`;

  return `${accountScopedLocation}/foodMenus`;
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
