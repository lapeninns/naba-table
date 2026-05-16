import { randomBytes } from 'node:crypto';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';
import { getRestaurantDetails, updateRestaurantDetails } from '@/server/restaurants/details';
import { getOperatingHours, updateOperatingHours } from '@/server/restaurants/operatingHours';
import { getServicePeriods, updateServicePeriods } from '@/server/restaurants/servicePeriods';
import { getServiceSupabaseClient } from '@/server/supabase';
import { MembershipAccessError, requireAdminMembership } from '@/server/team/access';

import {
  readGoogleBusinessProfileBusinessInfo,
  syncGoogleBusinessProfileCanonicalBusinessInfo,
  type GoogleBusinessProfileBusinessInfo,
} from './business-info';
import {
  buildGoogleBusinessProfileFoodMenusName,
  buildGoogleBusinessProfileAuthUrl,
  patchGoogleBusinessProfileLocation,
  exchangeGoogleBusinessProfileCode,
  fetchGoogleBusinessProfileIdentity,
  getGoogleBusinessProfileLocationAttributes,
  getGoogleBusinessProfileLocationProfile,
  listGoogleBusinessProfileAccounts,
  listGoogleBusinessProfileLocations,
  parseGoogleLocationId,
  refreshGoogleBusinessProfileAccessToken,
  revokeGoogleBusinessProfileToken,
  updateGoogleBusinessProfileLocationAttributes,
  type GoogleBusinessProfileAvailableLocation,
  type GoogleBusinessProfileAttributesResponse,
  type GoogleBusinessProfileIdentity,
  type GoogleBusinessProfileLocationProfile,
} from './client';
import {
  buildPullOperatingHoursPayload,
  buildPullProfilePatch,
  buildPullServicePeriodsPayload,
  buildPushOperatingHoursLocationPatch,
  buildPushProfileLocationPatch,
  buildPushServicePeriodsLocationPatch,
  canPushServicePeriodsToGoogle,
  type CoreSyncDirection,
  type OperatingHoursSyncSelection,
  type ServicePeriodsSyncSelection,
} from './core-sync';
import { decryptGoogleBusinessProfileSecret, encryptGoogleBusinessProfileSecret } from './crypto';
import { GoogleBusinessProfileError, isGoogleBusinessProfileError } from './errors';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type ExternalProfileRow = Database['public']['Tables']['restaurant_external_profiles']['Row'];
type CredentialRow = Database['public']['Tables']['restaurant_external_profile_credentials']['Row'];
type OAuthStateRow =
  Database['public']['Tables']['restaurant_external_profile_oauth_states']['Row'];
type SyncRunInsert =
  Database['public']['Tables']['restaurant_external_profile_sync_runs']['Insert'];

const PROVIDER = 'google_business_profile';
const DEFAULT_RETURN_PATH = '/app/settings/restaurant/google-business-profile';
const GBP_RETURN_PATH_PREFIXES = ['/app/settings/restaurant/google-business-profile'] as const;
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const LOCATION_DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000;
const gbpLogger = logger.child({ module: 'gbp' });

type LocationDiscoveryCacheEntry = {
  expiresAt: number;
  credential: CredentialRow;
  availableLocations: GoogleBusinessProfileAvailableLocation[];
};

const locationDiscoveryCache = new Map<string, LocationDiscoveryCacheEntry>();

function sanitizeOAuthReturnPath(returnPath: string | null | undefined): string {
  return sanitizeLocalRedirectPath(returnPath, {
    fallback: DEFAULT_RETURN_PATH,
    allowedPrefixes: GBP_RETURN_PATH_PREFIXES,
    allowAbsolute: true,
  });
}

export type GoogleBusinessProfileConnectionState = {
  isConfigured: boolean;
  provider: 'google_business_profile';
  status: 'pending_auth' | 'authorized' | 'linked' | 'unlinked' | 'reauth_required' | 'sync_error';
  pushEnabled: boolean;
  connectedGoogleEmail: string | null;
  connectedGoogleName: string | null;
  externalAccountId: string | null;
  externalAccountName: string | null;
  externalLocationId: string | null;
  externalLocationName: string | null;
  externalLocationTitle: string | null;
  externalPlaceId: string | null;
  providerTimezone: string | null;
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastError: string | null;
  availableLocations: GoogleBusinessProfileAvailableLocation[];
  businessInfo: GoogleBusinessProfileBusinessInfo;
};

export type LinkGoogleBusinessProfileLocationInput = {
  accountName: string;
  accountId: string;
  locationName: string;
  locationId: string;
};

export type GoogleBusinessProfileFieldDiff = {
  field: 'name' | 'contactPhone' | 'address' | 'googleMapUrl' | 'googleReviewUrl';
  label: string;
  localValue: string | null;
  googleValue: string | null;
  status: 'matches' | 'different' | 'missing_google' | 'missing_local' | 'unavailable';
  suggestion: string | null;
};

export type GoogleBusinessProfileBusinessDetailsStatus = {
  connection: {
    isConfigured: boolean;
    provider: 'google_business_profile';
    status: 'not_connected' | 'connected' | 'pending_auth' | 'needs_reauth' | 'sync_failed';
    rawStatus: GoogleBusinessProfileConnectionState['status'];
    connectedGoogleEmail: string | null;
    connectedGoogleName: string | null;
    lastError: string | null;
  };
  selectedLocation: {
    accountId: string | null;
    accountName: string | null;
    locationId: string | null;
    locationName: string | null;
    title: string | null;
    address: string | null;
    phone: string | null;
    websiteUri: string | null;
    primaryCategory: string | null;
    placeId: string | null;
    mapsUri: string | null;
    newReviewUri: string | null;
  } | null;
  lastSync: {
    pulledAt: string | null;
    pushedAt: string | null;
  };
  fieldDiffs: GoogleBusinessProfileFieldDiff[];
  availableLocations: GoogleBusinessProfileAvailableLocation[];
};

export type GoogleBusinessProfileFoodMenusContext = {
  externalProfileId: string;
  accessToken: string;
  foodMenusName: string;
  canHaveFoodMenus: boolean | null;
};

function getClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickProviderTimezone(location: GoogleBusinessProfileLocationProfile): string | null {
  return (
    normalizeText(location.timezone) ??
    normalizeText(location.timeZone) ??
    normalizeText(location.metadata?.timezone) ??
    normalizeText(location.metadata?.timeZone)
  );
}

function isConfigured(): boolean {
  return env.googleBusinessProfile.configured;
}

async function findExternalProfile(
  restaurantId: string,
  client: DbClient,
): Promise<ExternalProfileRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profiles')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', PROVIDER)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function ensureExternalProfile(
  restaurantId: string,
  client: DbClient,
): Promise<ExternalProfileRow> {
  const existing = await findExternalProfile(restaurantId, client);
  if (existing) {
    return existing;
  }

  const { data, error } = await client
    .from('restaurant_external_profiles')
    .insert({
      restaurant_id: restaurantId,
      provider: PROVIDER,
      connection_status: 'unlinked',
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getCredentialRow(
  externalProfileId: string,
  client: DbClient,
): Promise<CredentialRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profile_credentials')
    .select('*')
    .eq('external_profile_id', externalProfileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function updateExternalProfile(
  externalProfileId: string,
  payload: Database['public']['Tables']['restaurant_external_profiles']['Update'],
  client: DbClient,
): Promise<void> {
  const { error } = await client
    .from('restaurant_external_profiles')
    .update(payload)
    .eq('id', externalProfileId);

  if (error) {
    throw error;
  }
}

async function saveCredentials(
  externalProfile: ExternalProfileRow,
  tokens: Awaited<ReturnType<typeof exchangeGoogleBusinessProfileCode>>,
  identity: GoogleBusinessProfileIdentity,
  client: DbClient,
): Promise<void> {
  const existing = await getCredentialRow(externalProfile.id, client);
  const refreshToken =
    tokens.refreshToken ??
    (existing?.refresh_token_encrypted
      ? decryptGoogleBusinessProfileSecret(existing.refresh_token_encrypted)
      : null);

  if (!refreshToken) {
    throw new GoogleBusinessProfileError(
      'Google did not provide a refresh token. Please try reconnecting and grant offline access.',
      { code: 'GBP_REFRESH_TOKEN_MISSING', status: 409 },
    );
  }

  const { error } = await client.from('restaurant_external_profile_credentials').upsert({
    external_profile_id: externalProfile.id,
    provider_user_id: identity.providerUserId,
    connected_google_email: identity.email,
    connected_google_name: identity.name,
    refresh_token_encrypted: encryptGoogleBusinessProfileSecret(refreshToken),
    granted_scopes: tokens.grantedScopes,
    token_type: tokens.tokenType,
    last_refreshed_at: nowIso(),
    last_error: null,
  });

  if (error) {
    throw error;
  }
}

async function createOAuthStateRecord(
  restaurantId: string,
  requestedByUserId: string,
  client: DbClient,
  returnPath: string = DEFAULT_RETURN_PATH,
): Promise<string> {
  const stateToken = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();

  const { error } = await client.from('restaurant_external_profile_oauth_states').insert({
    restaurant_id: restaurantId,
    provider: PROVIDER,
    requested_by_user_id: requestedByUserId,
    state_token: stateToken,
    return_path: sanitizeOAuthReturnPath(returnPath),
    expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }

  return stateToken;
}

function createOAuthStateMismatchError(message: string, status = 400): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError(message, {
    code: 'GBP_INVALID_STATE',
    status,
  });
}

async function assertOAuthStateCanBeCompleted(
  state: OAuthStateRow,
  params: {
    requestedByUserId: string;
    expectedRestaurantId?: string;
    client: DbClient;
  },
): Promise<void> {
  if (state.requested_by_user_id !== params.requestedByUserId) {
    throw createOAuthStateMismatchError(
      'Google authorization state did not match this session. Start the connection again from Nabatable.',
      403,
    );
  }

  if (params.expectedRestaurantId && state.restaurant_id !== params.expectedRestaurantId) {
    throw createOAuthStateMismatchError(
      'Google authorization state did not match this restaurant.',
    );
  }

  try {
    await requireAdminMembership({
      userId: params.requestedByUserId,
      restaurantId: state.restaurant_id,
      client: params.client,
    });
  } catch (error) {
    if (error instanceof MembershipAccessError) {
      throw new GoogleBusinessProfileError(
        'You no longer have permission to connect Google Business Profile for this restaurant.',
        { code: 'GBP_STATE_RESTAURANT_FORBIDDEN', status: error.status },
      );
    }
    throw error;
  }
}

async function consumeOAuthStateRecord(
  stateToken: string,
  client: DbClient,
  options: {
    requestedByUserId: string;
    expectedRestaurantId?: string;
  },
): Promise<OAuthStateRow> {
  const { data, error } = await client
    .from('restaurant_external_profile_oauth_states')
    .select('*')
    .eq('state_token', stateToken)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new GoogleBusinessProfileError('Google authorization state was not found.', {
      code: 'GBP_INVALID_STATE',
      status: 400,
    });
  }

  if (data.consumed_at) {
    throw new GoogleBusinessProfileError('Google authorization state has already been used.', {
      code: 'GBP_INVALID_STATE',
      status: 400,
    });
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new GoogleBusinessProfileError('Google authorization state has expired.', {
      code: 'GBP_STATE_EXPIRED',
      status: 400,
    });
  }

  await assertOAuthStateCanBeCompleted(data, {
    requestedByUserId: options.requestedByUserId,
    expectedRestaurantId: options.expectedRestaurantId,
    client,
  });

  const { data: consumedState, error: updateError } = await client
    .from('restaurant_external_profile_oauth_states')
    .update({ consumed_at: nowIso() })
    .eq('id', data.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!consumedState) {
    throw new GoogleBusinessProfileError('Google authorization state has already been used.', {
      code: 'GBP_INVALID_STATE',
      status: 400,
    });
  }

  return data;
}

async function getUsableAccessToken(
  externalProfile: ExternalProfileRow,
  client: DbClient,
): Promise<{
  accessToken: string;
  credential: CredentialRow;
}> {
  const credential = await getCredentialRow(externalProfile.id, client);
  if (!credential) {
    throw new GoogleBusinessProfileError(
      'Google Business Profile is not connected for this restaurant.',
      { code: 'GBP_NOT_CONNECTED', status: 404 },
    );
  }

  try {
    const refreshed = await refreshGoogleBusinessProfileAccessToken(
      decryptGoogleBusinessProfileSecret(credential.refresh_token_encrypted),
    );

    const updatedRefreshTokenEncrypted = refreshed.refreshToken
      ? encryptGoogleBusinessProfileSecret(refreshed.refreshToken)
      : credential.refresh_token_encrypted;

    const { error } = await client
      .from('restaurant_external_profile_credentials')
      .update({
        refresh_token_encrypted: updatedRefreshTokenEncrypted,
        granted_scopes:
          refreshed.grantedScopes.length > 0 ? refreshed.grantedScopes : credential.granted_scopes,
        token_type: refreshed.tokenType ?? credential.token_type,
        last_refreshed_at: nowIso(),
        last_error: null,
      })
      .eq('external_profile_id', externalProfile.id);

    if (error) {
      throw error;
    }

    if (externalProfile.connection_status === 'reauth_required') {
      await updateExternalProfile(
        externalProfile.id,
        {
          connection_status: externalProfile.external_location_id ? 'linked' : 'authorized',
          last_error: null,
        },
        client,
      );
    }

    return {
      accessToken: refreshed.accessToken,
      credential: {
        ...credential,
        refresh_token_encrypted: updatedRefreshTokenEncrypted,
        granted_scopes:
          refreshed.grantedScopes.length > 0 ? refreshed.grantedScopes : credential.granted_scopes,
        token_type: refreshed.tokenType ?? credential.token_type,
        last_refreshed_at: nowIso(),
        last_error: null,
      },
    };
  } catch (error) {
    if (isGoogleBusinessProfileError(error) && error.code === 'GBP_REAUTH_REQUIRED') {
      await updateExternalProfile(
        externalProfile.id,
        {
          connection_status: 'reauth_required',
          last_error: error.message,
        },
        client,
      );
    }
    throw error;
  }
}

async function recordSyncRun(
  payload: Omit<SyncRunInsert, 'id' | 'created_at' | 'updated_at'>,
  client: DbClient,
): Promise<void> {
  const { error } = await client.from('restaurant_external_profile_sync_runs').insert(payload);
  if (error) {
    gbpLogger.warn('sync run audit insert failed', { error });
  }
}

async function discoverLocationsForProfile(
  externalProfile: ExternalProfileRow,
  client: DbClient,
  options: { forceRefresh?: boolean } = {},
): Promise<{
  credential: CredentialRow | null;
  availableLocations: GoogleBusinessProfileAvailableLocation[];
}> {
  const cached = locationDiscoveryCache.get(externalProfile.id);
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return {
      credential: cached.credential,
      availableLocations: cached.availableLocations,
    };
  }

  const { accessToken, credential } = await getUsableAccessToken(externalProfile, client);
  const accounts = await listGoogleBusinessProfileAccounts(accessToken);
  const batches = await Promise.all(
    accounts.map((account) =>
      listGoogleBusinessProfileLocations(accessToken, account.name, account.accountName),
    ),
  );

  const discovery = {
    credential,
    availableLocations: batches.flat(),
  };

  locationDiscoveryCache.set(externalProfile.id, {
    ...discovery,
    expiresAt: Date.now() + LOCATION_DISCOVERY_CACHE_TTL_MS,
  });

  return discovery;
}

function assertGooglePushEnabled(externalProfile: ExternalProfileRow): void {
  if (externalProfile.push_enabled) {
    return;
  }

  throw new GoogleBusinessProfileError(
    'Optional Nabatable -> Google sync is disabled for this linked Google Business Profile location. Enable GBP push before choosing Google sync.',
    { code: 'GBP_GOOGLE_PUSH_DISABLED', status: 409 },
  );
}

function resolveCanHaveFoodMenus(location: GoogleBusinessProfileLocationProfile): boolean | null {
  if (typeof location.metadata?.canHaveFoodMenus === 'boolean') {
    return location.metadata.canHaveFoodMenus;
  }

  if (typeof location.locationState?.canHaveFoodMenu === 'boolean') {
    return location.locationState.canHaveFoodMenu;
  }

  if (typeof location.locationState?.canHaveFoodMenus === 'boolean') {
    return location.locationState.canHaveFoodMenus;
  }

  return null;
}

function assertGoogleFoodMenusEligible(
  location: GoogleBusinessProfileLocationProfile,
): boolean | null {
  const canHaveFoodMenus = resolveCanHaveFoodMenus(location);
  if (canHaveFoodMenus === false) {
    throw new GoogleBusinessProfileError(
      'The linked Google Business Profile location is not eligible for FoodMenus.',
      { code: 'GBP_FOOD_MENUS_NOT_ELIGIBLE', status: 409 },
    );
  }
  return canHaveFoodMenus;
}

function buildConnectionState(
  externalProfile: ExternalProfileRow | null,
  credential: CredentialRow | null,
  availableLocations: GoogleBusinessProfileAvailableLocation[],
  businessInfo: GoogleBusinessProfileBusinessInfo,
): GoogleBusinessProfileConnectionState {
  return {
    isConfigured: isConfigured(),
    provider: 'google_business_profile',
    status:
      (externalProfile?.connection_status as GoogleBusinessProfileConnectionState['status']) ??
      'unlinked',
    pushEnabled: Boolean(externalProfile?.push_enabled),
    connectedGoogleEmail: credential?.connected_google_email ?? null,
    connectedGoogleName: credential?.connected_google_name ?? null,
    externalAccountId: externalProfile?.external_account_id ?? null,
    externalAccountName: externalProfile?.external_account_name ?? null,
    externalLocationId: externalProfile?.external_location_id ?? null,
    externalLocationName: externalProfile?.external_location_name ?? null,
    externalLocationTitle: externalProfile?.external_location_title ?? null,
    externalPlaceId: externalProfile?.external_place_id ?? null,
    providerTimezone: externalProfile?.provider_timezone ?? null,
    lastPullAt: externalProfile?.last_pull_at ?? null,
    lastPushAt: externalProfile?.last_push_at ?? null,
    lastError: externalProfile?.last_error ?? null,
    availableLocations,
    businessInfo,
  };
}

function mapBusinessDetailsConnectionStatus(
  status: GoogleBusinessProfileConnectionState['status'],
): GoogleBusinessProfileBusinessDetailsStatus['connection']['status'] {
  switch (status) {
    case 'pending_auth':
      return 'pending_auth';
    case 'authorized':
    case 'linked':
      return 'connected';
    case 'reauth_required':
      return 'needs_reauth';
    case 'sync_error':
      return 'sync_failed';
    case 'unlinked':
    default:
      return 'not_connected';
  }
}

function normalizeComparableText(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function buildFieldDiff(params: {
  field: GoogleBusinessProfileFieldDiff['field'];
  label: string;
  localValue: string | null;
  googleValue: string | null;
}): GoogleBusinessProfileFieldDiff {
  const localComparable = normalizeComparableText(params.localValue);
  const googleComparable = normalizeComparableText(params.googleValue);

  if (!localComparable && !googleComparable) {
    return {
      ...params,
      status: 'unavailable',
      suggestion: null,
    };
  }

  if (!googleComparable) {
    return {
      ...params,
      status: 'missing_google',
      suggestion: null,
    };
  }

  if (!localComparable) {
    return {
      ...params,
      status: 'missing_local',
      suggestion: params.googleValue,
    };
  }

  if (localComparable === googleComparable) {
    return {
      ...params,
      status: 'matches',
      suggestion: null,
    };
  }

  return {
    ...params,
    status: 'different',
    suggestion: params.googleValue,
  };
}

function getPrimaryBusinessInfoValues(state: GoogleBusinessProfileConnectionState) {
  const primaryAddress =
    state.businessInfo.addresses.find((address) => address.isPrimary) ??
    state.businessInfo.addresses[0] ??
    null;
  const primaryPhone =
    state.businessInfo.phoneNumbers.find((phone) => phone.isPrimary) ??
    state.businessInfo.phoneNumbers[0] ??
    null;
  const primaryCategory =
    state.businessInfo.categories.find((category) => category.isPrimary) ??
    state.businessInfo.categories[0] ??
    null;
  const websiteLink = state.businessInfo.links.find((link) => link.linkType === 'website');
  const mapsLink = state.businessInfo.links.find((link) => link.linkType === 'google_map');
  const reviewLink = state.businessInfo.links.find((link) => link.linkType === 'google_review');

  return {
    address: primaryAddress?.formattedAddress ?? null,
    phone: primaryPhone?.phoneNumber ?? null,
    primaryCategory: primaryCategory?.displayName ?? null,
    websiteUri: websiteLink?.url ?? null,
    mapsUri: mapsLink?.url ?? null,
    newReviewUri: reviewLink?.url ?? null,
  };
}

function buildSelectedLocation(
  state: GoogleBusinessProfileConnectionState,
): GoogleBusinessProfileBusinessDetailsStatus['selectedLocation'] {
  if (!state.externalLocationId && !state.externalLocationName) {
    return null;
  }

  const values = getPrimaryBusinessInfoValues(state);
  return {
    accountId: state.externalAccountId,
    accountName: state.externalAccountName,
    locationId: state.externalLocationId,
    locationName: state.externalLocationName,
    title: state.externalLocationTitle,
    address: values.address,
    phone: values.phone,
    websiteUri: values.websiteUri,
    primaryCategory: values.primaryCategory,
    placeId: state.externalPlaceId,
    mapsUri: values.mapsUri,
    newReviewUri: values.newReviewUri,
  };
}

export async function getGoogleBusinessProfileBusinessDetailsStatus(
  restaurantId: string,
  client?: DbClient,
): Promise<GoogleBusinessProfileBusinessDetailsStatus> {
  const resolvedClient = getClient(client);
  const [state, profile] = await Promise.all([
    getGoogleBusinessProfileConnectionState(restaurantId, resolvedClient),
    getRestaurantDetails(restaurantId, resolvedClient),
  ]);
  const values = getPrimaryBusinessInfoValues(state);
  const googleName =
    state.externalLocationTitle ?? state.businessInfo.details?.businessName ?? null;

  return {
    connection: {
      isConfigured: state.isConfigured,
      provider: state.provider,
      status: mapBusinessDetailsConnectionStatus(state.status),
      rawStatus: state.status,
      connectedGoogleEmail: state.connectedGoogleEmail,
      connectedGoogleName: state.connectedGoogleName,
      lastError: state.lastError,
    },
    selectedLocation: buildSelectedLocation(state),
    lastSync: {
      pulledAt: state.lastPullAt,
      pushedAt: state.lastPushAt,
    },
    fieldDiffs: [
      buildFieldDiff({
        field: 'name',
        label: 'Business name',
        localValue: profile.name,
        googleValue: googleName,
      }),
      buildFieldDiff({
        field: 'contactPhone',
        label: 'Phone',
        localValue: profile.contactPhone,
        googleValue: values.phone,
      }),
      buildFieldDiff({
        field: 'address',
        label: 'Address',
        localValue: profile.address,
        googleValue: values.address,
      }),
      buildFieldDiff({
        field: 'googleMapUrl',
        label: 'Google Maps URL',
        localValue: profile.googleMapUrl,
        googleValue: values.mapsUri,
      }),
      buildFieldDiff({
        field: 'googleReviewUrl',
        label: 'Google review URL',
        localValue: profile.googleReviewUrl,
        googleValue: values.newReviewUri,
      }),
    ],
    availableLocations: state.availableLocations,
  };
}

async function getLinkedExternalProfileWithLocation(
  restaurantId: string,
  client: DbClient,
): Promise<{
  externalProfile: ExternalProfileRow;
  accessToken: string;
  locationResourceName: string;
  location: Awaited<ReturnType<typeof getGoogleBusinessProfileLocationProfile>>;
}> {
  const externalProfile = await ensureExternalProfile(restaurantId, client);
  if (!externalProfile.external_location_id && !externalProfile.external_resource_name) {
    throw new GoogleBusinessProfileError(
      'Link a Google Business Profile location before syncing business information.',
      { code: 'GBP_LOCATION_NOT_LINKED', status: 409 },
    );
  }

  const { accessToken } = await getUsableAccessToken(externalProfile, client);
  const locationResourceName =
    externalProfile.external_resource_name ??
    externalProfile.external_location_name ??
    `locations/${externalProfile.external_location_id}`;
  const location = await getGoogleBusinessProfileLocationProfile(accessToken, locationResourceName);

  return {
    externalProfile,
    accessToken,
    locationResourceName,
    location,
  };
}

export async function getGoogleBusinessProfileFoodMenusContext(params: {
  restaurantId: string;
  client?: DbClient;
  requirePushEnabled?: boolean;
}): Promise<GoogleBusinessProfileFoodMenusContext> {
  const resolvedClient = getClient(params.client);
  const { externalProfile, accessToken, locationResourceName, location } =
    await getLinkedExternalProfileWithLocation(params.restaurantId, resolvedClient);
  if (params.requirePushEnabled) {
    assertGooglePushEnabled(externalProfile);
  }
  const canHaveFoodMenus = assertGoogleFoodMenusEligible(location);

  const accountNameOrId =
    normalizeText(externalProfile.external_account_name) ??
    normalizeText(externalProfile.external_account_id);
  if (!accountNameOrId) {
    throw new GoogleBusinessProfileError(
      'Link a Google Business Profile account before syncing food menus.',
      { code: 'GBP_ACCOUNT_NOT_LINKED', status: 409 },
    );
  }

  return {
    externalProfileId: externalProfile.id,
    accessToken,
    foodMenusName: buildGoogleBusinessProfileFoodMenusName(accountNameOrId, locationResourceName),
    canHaveFoodMenus,
  };
}

function resolveRequestedDirection(params: {
  requestedDirection?: CoreSyncDirection;
  coreUpdatedAt: string | null;
  providerUpdatedAt: string | null;
}): CoreSyncDirection {
  if (params.requestedDirection) {
    return params.requestedDirection;
  }

  const coreTime = params.coreUpdatedAt ? new Date(params.coreUpdatedAt).getTime() : Number.NaN;
  const providerTime = params.providerUpdatedAt
    ? new Date(params.providerUpdatedAt).getTime()
    : Number.NaN;

  if (Number.isFinite(coreTime) && Number.isFinite(providerTime)) {
    return coreTime > providerTime ? 'push_to_gbp' : 'pull_from_gbp';
  }

  if (Number.isFinite(coreTime)) {
    return 'push_to_gbp';
  }

  return 'pull_from_gbp';
}

export function getProviderReferenceUpdatedAt(
  externalProfile: Pick<ExternalProfileRow, 'last_pull_at' | 'last_push_at'> | null | undefined,
): string | null {
  const timestamps = [externalProfile?.last_pull_at ?? null, externalProfile?.last_push_at ?? null]
    .map((value) => ({
      value,
      time: value ? new Date(value).getTime() : Number.NaN,
    }))
    .filter((entry) => Number.isFinite(entry.time));

  if (timestamps.length === 0) {
    return null;
  }

  timestamps.sort((left, right) => right.time - left.time);
  return timestamps[0]?.value ?? null;
}

async function markGooglePushSuccess(
  externalProfileId: string,
  pushedAt: string,
  client: DbClient,
): Promise<void> {
  await updateExternalProfile(
    externalProfileId,
    {
      last_push_at: pushedAt,
      last_error: null,
      connection_status: 'linked',
    },
    client,
  );
}

export async function createGoogleBusinessProfileAuthorization(params: {
  restaurantId: string;
  requestedByUserId: string;
  returnPath?: string;
  client?: DbClient;
}): Promise<{ authorizationUrl: string; stateToken: string }> {
  const client = getClient(params.client);
  const externalProfile = await ensureExternalProfile(params.restaurantId, client);
  const stateToken = await createOAuthStateRecord(
    params.restaurantId,
    params.requestedByUserId,
    client,
    params.returnPath,
  );

  await updateExternalProfile(
    externalProfile.id,
    {
      connection_status: 'pending_auth',
      last_error: null,
    },
    client,
  );

  return {
    authorizationUrl: buildGoogleBusinessProfileAuthUrl(stateToken),
    stateToken,
  };
}

export async function createGoogleBusinessProfileAuthorizationUrl(params: {
  restaurantId: string;
  requestedByUserId: string;
  returnPath?: string;
  client?: DbClient;
}): Promise<string> {
  const result = await createGoogleBusinessProfileAuthorization(params);
  return result.authorizationUrl;
}

export async function completeGoogleBusinessProfileAuthorization(params: {
  stateToken: string;
  code: string;
  requestedByUserId: string;
  expectedRestaurantId?: string;
  client?: DbClient;
}): Promise<{ restaurantId: string; returnPath: string }> {
  const client = getClient(params.client);
  const state = await consumeOAuthStateRecord(params.stateToken, client, {
    requestedByUserId: params.requestedByUserId,
    expectedRestaurantId: params.expectedRestaurantId,
  });
  const externalProfile = await ensureExternalProfile(state.restaurant_id, client);

  try {
    const tokens = await exchangeGoogleBusinessProfileCode(params.code);
    let identity: GoogleBusinessProfileIdentity = {
      providerUserId: null,
      email: null,
      name: null,
    };

    try {
      identity = await fetchGoogleBusinessProfileIdentity(tokens.accessToken);
    } catch (error) {
      gbpLogger.warn('oauth identity lookup skipped', {
        restaurantId: state.restaurant_id,
        error,
      });
    }

    await saveCredentials(externalProfile, tokens, identity, client);
    await updateExternalProfile(
      externalProfile.id,
      {
        connection_status: externalProfile.external_location_id ? 'linked' : 'authorized',
        last_error: null,
      },
      client,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Google Business Profile authorization failed unexpectedly.';

    gbpLogger.error('oauth completion failed', {
      restaurantId: state.restaurant_id,
      returnPath: sanitizeOAuthReturnPath(state.return_path),
      error,
    });

    await updateExternalProfile(
      externalProfile.id,
      {
        connection_status: 'sync_error',
        last_error: message,
      },
      client,
    );
    throw error;
  }

  return {
    restaurantId: state.restaurant_id,
    returnPath: sanitizeOAuthReturnPath(state.return_path),
  };
}

export async function getGoogleBusinessProfileConnectionState(
  restaurantId: string,
  client?: DbClient,
  options: { includeAvailableLocations?: boolean; forceRefreshLocations?: boolean } = {},
): Promise<GoogleBusinessProfileConnectionState> {
  const resolvedClient = getClient(client);
  const businessInfo = await readGoogleBusinessProfileBusinessInfo(restaurantId, resolvedClient);
  const externalProfile = await findExternalProfile(restaurantId, resolvedClient);

  if (!externalProfile) {
    return buildConnectionState(null, null, [], businessInfo);
  }

  const credential = await getCredentialRow(externalProfile.id, resolvedClient);

  if (!isConfigured() || !credential || !options.includeAvailableLocations) {
    return buildConnectionState(externalProfile, credential, [], businessInfo);
  }

  try {
    const discovery = await discoverLocationsForProfile(externalProfile, resolvedClient, {
      forceRefresh: options.forceRefreshLocations,
    });
    const refreshedExternalProfile = await findExternalProfile(restaurantId, resolvedClient);
    return buildConnectionState(
      refreshedExternalProfile ?? externalProfile,
      discovery.credential,
      discovery.availableLocations,
      businessInfo,
    );
  } catch {
    const refreshedExternalProfile = await findExternalProfile(restaurantId, resolvedClient);
    const refreshedCredential = refreshedExternalProfile
      ? await getCredentialRow(refreshedExternalProfile.id, resolvedClient)
      : null;
    return buildConnectionState(
      refreshedExternalProfile ?? externalProfile,
      refreshedCredential ?? credential,
      [],
      businessInfo,
    );
  }
}

export async function getGoogleBusinessProfileAvailableLocations(
  restaurantId: string,
  client?: DbClient,
  options: { forceRefresh?: boolean } = {},
): Promise<GoogleBusinessProfileAvailableLocation[]> {
  const state = await getGoogleBusinessProfileConnectionState(restaurantId, client, {
    includeAvailableLocations: true,
    forceRefreshLocations: options.forceRefresh,
  });
  return state.availableLocations;
}

export async function syncGoogleBusinessProfileBusinessInformation(
  restaurantId: string,
  client?: DbClient,
  options: { runKind?: 'manual' | 'location_selection' | 'core_sync' } = {},
): Promise<GoogleBusinessProfileConnectionState> {
  const resolvedClient = getClient(client);
  const externalProfile = await ensureExternalProfile(restaurantId, resolvedClient);
  const startedAt = nowIso();

  if (!externalProfile.external_location_id && !externalProfile.external_resource_name) {
    throw new GoogleBusinessProfileError(
      'Link a Google Business Profile location before syncing business information.',
      { code: 'GBP_LOCATION_NOT_LINKED', status: 409 },
    );
  }

  const { accessToken } = await getUsableAccessToken(externalProfile, resolvedClient);
  const locationResourceName =
    externalProfile.external_resource_name ??
    externalProfile.external_location_name ??
    `locations/${externalProfile.external_location_id}`;

  let attributes: GoogleBusinessProfileAttributesResponse | null = null;
  let attributeWarning: string | null = null;

  try {
    const location = await getGoogleBusinessProfileLocationProfile(
      accessToken,
      locationResourceName,
    );

    try {
      attributes = await getGoogleBusinessProfileLocationAttributes(
        accessToken,
        externalProfile.external_location_id ?? parseGoogleLocationId(location.name),
      );
    } catch (error) {
      attributeWarning =
        error instanceof Error
          ? `Google attributes could not be refreshed: ${error.message}`
          : 'Google attributes could not be refreshed.';
      gbpLogger.warn('attribute sync skipped', {
        restaurantId,
        externalProfileId: externalProfile.id,
        error,
      });
    }

    const syncedAt = nowIso();
    await syncGoogleBusinessProfileCanonicalBusinessInfo({
      restaurantId,
      externalProfile,
      location,
      attributes,
      client: resolvedClient,
      syncedAt,
      syncAttributes: attributes !== null,
    });

    await updateExternalProfile(
      externalProfile.id,
      {
        external_location_id:
          externalProfile.external_location_id ?? parseGoogleLocationId(location.name),
        external_location_name: location.name,
        external_location_title: location.title?.trim() || externalProfile.external_location_title,
        external_place_id: location.metadata?.placeId?.trim() || externalProfile.external_place_id,
        external_resource_name: location.name,
        provider_timezone: pickProviderTimezone(location) ?? externalProfile.provider_timezone,
        connection_status: 'linked',
        last_pull_at: syncedAt,
        last_error: attributeWarning,
      },
      resolvedClient,
    );

    await recordSyncRun(
      {
        external_profile_id: externalProfile.id,
        restaurant_id: restaurantId,
        provider: PROVIDER,
        run_kind: options.runKind ?? 'manual',
        status: 'success',
        started_at: startedAt,
        finished_at: syncedAt,
        error_code: null,
        error_message: attributeWarning,
        metadata: {
          locationName: location.name,
          attributeSyncSkipped: attributes === null,
        },
      },
      resolvedClient,
    );

    return getGoogleBusinessProfileConnectionState(restaurantId, resolvedClient);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Google Business Profile sync failed unexpectedly.';
    const errorCode = isGoogleBusinessProfileError(error) ? error.code : null;

    if (
      isGoogleBusinessProfileError(error) &&
      (error.code === 'GBP_REAUTH_REQUIRED' || error.code === 'GBP_FORBIDDEN')
    ) {
      await updateExternalProfile(
        externalProfile.id,
        {
          connection_status: 'reauth_required',
          last_error: message,
        },
        resolvedClient,
      );
    } else {
      await updateExternalProfile(
        externalProfile.id,
        {
          connection_status: 'sync_error',
          last_error: message,
        },
        resolvedClient,
      );
    }

    await recordSyncRun(
      {
        external_profile_id: externalProfile.id,
        restaurant_id: restaurantId,
        provider: PROVIDER,
        run_kind: options.runKind ?? 'manual',
        status: 'failed',
        started_at: startedAt,
        finished_at: nowIso(),
        error_code: errorCode,
        error_message: message,
        metadata: null,
      },
      resolvedClient,
    );

    throw error;
  }
}

export async function syncRestaurantProfileWithGoogleBusinessProfile(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  fields?: Array<'name' | 'contactPhone' | 'address' | 'googleMapUrl' | 'googleReviewUrl'>;
  client?: DbClient;
}) {
  const resolvedClient = getClient(params.client);
  const [profile, refreshedState, existingExternalProfile] = await Promise.all([
    getRestaurantDetails(params.restaurantId, resolvedClient),
    syncGoogleBusinessProfileBusinessInformation(params.restaurantId, resolvedClient),
    findExternalProfile(params.restaurantId, resolvedClient),
  ]);

  const direction = resolveRequestedDirection({
    requestedDirection: params.direction,
    coreUpdatedAt: profile.updatedAt,
    providerUpdatedAt: getProviderReferenceUpdatedAt(existingExternalProfile),
  });

  if (direction === 'pull_from_gbp') {
    const payload = {
      timezone: profile.timezone,
      ...buildPullProfilePatch({
        businessInfo: refreshedState.businessInfo,
        externalLocationTitle:
          refreshedState.externalLocationTitle ?? refreshedState.externalLocationName ?? null,
        fields: params.fields,
      }),
    };

    return updateRestaurantDetails(params.restaurantId, payload, resolvedClient);
  }

  const { externalProfile, accessToken, locationResourceName, location } =
    await getLinkedExternalProfileWithLocation(params.restaurantId, resolvedClient);
  assertGooglePushEnabled(externalProfile);
  const patch = buildPushProfileLocationPatch({
    profile,
    location,
    fields: params.fields,
  });

  if (patch.updateMask.length === 0) {
    return profile;
  }

  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
    { validateOnly: true },
  );
  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
  );

  const pushedAt = nowIso();
  await markGooglePushSuccess(externalProfile.id, pushedAt, resolvedClient);
  await syncGoogleBusinessProfileBusinessInformation(params.restaurantId, resolvedClient, {
    runKind: 'core_sync',
  });

  return getRestaurantDetails(params.restaurantId, resolvedClient);
}

export async function syncRestaurantOperatingHoursWithGoogleBusinessProfile(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  selection?: OperatingHoursSyncSelection;
  client?: DbClient;
}) {
  const resolvedClient = getClient(params.client);
  const [snapshot, refreshedState, existingExternalProfile] = await Promise.all([
    getOperatingHours(params.restaurantId, resolvedClient),
    syncGoogleBusinessProfileBusinessInformation(params.restaurantId, resolvedClient),
    findExternalProfile(params.restaurantId, resolvedClient),
  ]);

  const direction = resolveRequestedDirection({
    requestedDirection: params.direction,
    coreUpdatedAt: snapshot.updatedAt,
    providerUpdatedAt: getProviderReferenceUpdatedAt(existingExternalProfile),
  });

  if (direction === 'pull_from_gbp') {
    const payload = buildPullOperatingHoursPayload({
      currentSnapshot: snapshot,
      businessInfo: refreshedState.businessInfo,
      selection: params.selection,
    });
    return updateOperatingHours(params.restaurantId, payload, resolvedClient);
  }

  const { externalProfile, accessToken, locationResourceName, location } =
    await getLinkedExternalProfileWithLocation(params.restaurantId, resolvedClient);
  assertGooglePushEnabled(externalProfile);
  const patch = buildPushOperatingHoursLocationPatch({
    snapshot,
    location,
    selection: params.selection,
  });

  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
    { validateOnly: true },
  );
  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
  );

  const pushedAt = nowIso();
  await markGooglePushSuccess(externalProfile.id, pushedAt, resolvedClient);
  await syncGoogleBusinessProfileBusinessInformation(params.restaurantId, resolvedClient, {
    runKind: 'core_sync',
  });

  return getOperatingHours(params.restaurantId, resolvedClient);
}

export async function syncRestaurantServicePeriodsWithGoogleBusinessProfile(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  selection?: ServicePeriodsSyncSelection;
  client?: DbClient;
}) {
  const resolvedClient = getClient(params.client);
  const [periods, refreshedState, existingExternalProfile] = await Promise.all([
    getServicePeriods(params.restaurantId, resolvedClient),
    syncGoogleBusinessProfileBusinessInformation(params.restaurantId, resolvedClient),
    findExternalProfile(params.restaurantId, resolvedClient),
  ]);

  const periodsUpdatedAt =
    periods
      .map((period) => period.updatedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  const direction = resolveRequestedDirection({
    requestedDirection: params.direction,
    coreUpdatedAt: periodsUpdatedAt,
    providerUpdatedAt: getProviderReferenceUpdatedAt(existingExternalProfile),
  });

  if (direction === 'pull_from_gbp') {
    const payload = buildPullServicePeriodsPayload({
      currentPeriods: periods,
      businessInfo: refreshedState.businessInfo,
      selection: params.selection,
    });

    return updateServicePeriods(params.restaurantId, payload, resolvedClient);
  }

  const { externalProfile, accessToken, locationResourceName, location } =
    await getLinkedExternalProfileWithLocation(params.restaurantId, resolvedClient);
  assertGooglePushEnabled(externalProfile);

  if (!canPushServicePeriodsToGoogle(location)) {
    throw new GoogleBusinessProfileError(
      'This Google Business Profile location does not expose a writable kitchen more-hours type yet, so service periods can only be pulled from GBP for now.',
      { code: 'GBP_SERVICE_PERIODS_PUSH_UNAVAILABLE', status: 409 },
    );
  }

  const patch = buildPushServicePeriodsLocationPatch({
    periods,
    location,
    selection: params.selection,
  });

  if (!patch) {
    throw new GoogleBusinessProfileError(
      'This Google Business Profile location does not expose a writable kitchen more-hours type yet, so service periods can only be pulled from GBP for now.',
      { code: 'GBP_SERVICE_PERIODS_PUSH_UNAVAILABLE', status: 409 },
    );
  }

  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
    { validateOnly: true },
  );
  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
  );

  const pushedAt = nowIso();
  await markGooglePushSuccess(externalProfile.id, pushedAt, resolvedClient);
  await syncGoogleBusinessProfileBusinessInformation(params.restaurantId, resolvedClient, {
    runKind: 'core_sync',
  });

  return getServicePeriods(params.restaurantId, resolvedClient);
}

export async function patchRestaurantGoogleBusinessProfileLocationFields(params: {
  restaurantId: string;
  locationPatch?: Record<string, unknown>;
  updateMask?: string[];
  attributesPatch?: {
    attributes: Array<Record<string, unknown>>;
    attributeMask: string[];
  };
  client?: DbClient;
}) {
  const resolvedClient = getClient(params.client);
  const { externalProfile, accessToken, locationResourceName } =
    await getLinkedExternalProfileWithLocation(params.restaurantId, resolvedClient);
  assertGooglePushEnabled(externalProfile);

  const updateMask = [...new Set(params.updateMask ?? [])].filter(Boolean);
  if (params.locationPatch && updateMask.length > 0) {
    await patchGoogleBusinessProfileLocation(
      accessToken,
      locationResourceName,
      params.locationPatch,
      updateMask,
      { validateOnly: true },
    );
    await patchGoogleBusinessProfileLocation(
      accessToken,
      locationResourceName,
      params.locationPatch,
      updateMask,
    );
  }

  const attributeMask = [...new Set(params.attributesPatch?.attributeMask ?? [])].filter(Boolean);
  if (params.attributesPatch && attributeMask.length > 0) {
    await updateGoogleBusinessProfileLocationAttributes(
      accessToken,
      locationResourceName,
      { attributes: params.attributesPatch.attributes },
      attributeMask,
    );
  }

  const pushedAt = nowIso();
  await markGooglePushSuccess(externalProfile.id, pushedAt, resolvedClient);
  await syncGoogleBusinessProfileBusinessInformation(params.restaurantId, resolvedClient, {
    runKind: 'core_sync',
  });

  return readGoogleBusinessProfileBusinessInfo(params.restaurantId, resolvedClient);
}

export async function linkGoogleBusinessProfileLocation(
  restaurantId: string,
  input: LinkGoogleBusinessProfileLocationInput,
  client?: DbClient,
): Promise<GoogleBusinessProfileConnectionState> {
  const resolvedClient = getClient(client);
  const externalProfile = await ensureExternalProfile(restaurantId, resolvedClient);
  const { availableLocations } = await discoverLocationsForProfile(externalProfile, resolvedClient);
  const selected = availableLocations.find(
    (location) =>
      location.accountName === input.accountName &&
      location.accountId === input.accountId &&
      location.locationName === input.locationName &&
      location.locationId === input.locationId,
  );

  if (!selected) {
    throw new GoogleBusinessProfileError(
      'The selected Google Business Profile location is no longer available.',
      { code: 'GBP_LOCATION_NOT_FOUND', status: 404 },
    );
  }

  await updateExternalProfile(
    externalProfile.id,
    {
      external_account_id: selected.accountId,
      external_account_name: selected.accountName,
      external_location_id: selected.locationId,
      external_location_name: selected.locationName,
      external_location_title: selected.title,
      external_place_id: selected.placeId,
      external_resource_name: selected.locationName,
      connection_status: 'linked',
      last_error: null,
    },
    resolvedClient,
  );

  return getGoogleBusinessProfileConnectionState(restaurantId, resolvedClient);
}

export async function disconnectGoogleBusinessProfileConnection(
  restaurantId: string,
  client?: DbClient,
): Promise<GoogleBusinessProfileConnectionState> {
  const resolvedClient = getClient(client);
  const externalProfile = await ensureExternalProfile(restaurantId, resolvedClient);
  const credential = await getCredentialRow(externalProfile.id, resolvedClient);

  if (credential?.refresh_token_encrypted) {
    try {
      await revokeGoogleBusinessProfileToken(
        decryptGoogleBusinessProfileSecret(credential.refresh_token_encrypted),
      );
    } catch (error) {
      console.warn('[gbp] failed to revoke Google token during disconnect', error);
    }
  }

  const { error: deleteCredentialError } = await resolvedClient
    .from('restaurant_external_profile_credentials')
    .delete()
    .eq('external_profile_id', externalProfile.id);

  if (deleteCredentialError) {
    throw deleteCredentialError;
  }

  await updateExternalProfile(
    externalProfile.id,
    {
      external_account_id: null,
      external_account_name: null,
      external_location_id: null,
      external_location_name: null,
      external_location_title: null,
      external_place_id: null,
      external_resource_name: null,
      connection_status: 'unlinked',
      last_error: null,
      last_pull_at: null,
      last_push_at: null,
    },
    resolvedClient,
  );

  return getGoogleBusinessProfileConnectionState(restaurantId, resolvedClient);
}
