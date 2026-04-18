import { randomBytes } from 'node:crypto';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getRestaurantDetails, updateRestaurantDetails } from '@/server/restaurants/details';
import { getOperatingHours, updateOperatingHours } from '@/server/restaurants/operatingHours';
import { getServicePeriods, updateServicePeriods } from '@/server/restaurants/servicePeriods';
import { getServiceSupabaseClient } from '@/server/supabase';

import {
  readGoogleBusinessProfileBusinessInfo,
  syncGoogleBusinessProfileCanonicalBusinessInfo,
  type GoogleBusinessProfileBusinessInfo,
} from './business-info';
import {
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
  type GoogleBusinessProfileAvailableLocation,
  type GoogleBusinessProfileAttributesResponse,
  type GoogleBusinessProfileIdentity,
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

const PROVIDER = 'google_business_profile';
const DEFAULT_RETURN_PATH = '/settings/restaurant/google-business-profile';
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60_000;
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const gbpLogger = logger.child({ module: 'gbp' });

export type GoogleBusinessProfileConnectionState = {
  isConfigured: boolean;
  provider: 'google_business_profile';
  status: 'pending_auth' | 'authorized' | 'linked' | 'unlinked' | 'reauth_required' | 'sync_error';
  connectedGoogleEmail: string | null;
  connectedGoogleName: string | null;
  externalAccountId: string | null;
  externalAccountName: string | null;
  externalLocationId: string | null;
  externalLocationName: string | null;
  externalLocationTitle: string | null;
  externalPlaceId: string | null;
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

function getClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

function nowIso(): string {
  return new Date().toISOString();
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

  const expiresAt =
    typeof tokens.expiresIn === 'number'
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null;

  const { error } = await client.from('restaurant_external_profile_credentials').upsert({
    external_profile_id: externalProfile.id,
    provider_user_id: identity.providerUserId,
    connected_google_email: identity.email,
    connected_google_name: identity.name,
    access_token_encrypted: encryptGoogleBusinessProfileSecret(tokens.accessToken),
    refresh_token_encrypted: encryptGoogleBusinessProfileSecret(refreshToken),
    access_token_expires_at: expiresAt,
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
    return_path: returnPath,
    expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }

  return stateToken;
}

async function consumeOAuthStateRecord(
  stateToken: string,
  client: DbClient,
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

  const { error: updateError } = await client
    .from('restaurant_external_profile_oauth_states')
    .update({ consumed_at: nowIso() })
    .eq('id', data.id);

  if (updateError) {
    throw updateError;
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

  const accessTokenStillValid =
    credential.access_token_encrypted &&
    credential.access_token_expires_at &&
    new Date(credential.access_token_expires_at).getTime() >
      Date.now() + ACCESS_TOKEN_EXPIRY_SKEW_MS;

  if (accessTokenStillValid) {
    return {
      accessToken: decryptGoogleBusinessProfileSecret(credential.access_token_encrypted!),
      credential,
    };
  }

  try {
    const refreshed = await refreshGoogleBusinessProfileAccessToken(
      decryptGoogleBusinessProfileSecret(credential.refresh_token_encrypted),
    );

    const updatedAccessTokenEncrypted = encryptGoogleBusinessProfileSecret(refreshed.accessToken);
    const updatedRefreshTokenEncrypted = refreshed.refreshToken
      ? encryptGoogleBusinessProfileSecret(refreshed.refreshToken)
      : credential.refresh_token_encrypted;
    const refreshedExpiresAt =
      typeof refreshed.expiresIn === 'number'
        ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
        : null;

    const { error } = await client
      .from('restaurant_external_profile_credentials')
      .update({
        access_token_encrypted: updatedAccessTokenEncrypted,
        refresh_token_encrypted: updatedRefreshTokenEncrypted,
        access_token_expires_at: refreshedExpiresAt,
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
        access_token_encrypted: updatedAccessTokenEncrypted,
        refresh_token_encrypted: updatedRefreshTokenEncrypted,
        access_token_expires_at: refreshedExpiresAt,
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

async function discoverLocationsForProfile(
  externalProfile: ExternalProfileRow,
  client: DbClient,
): Promise<{
  credential: CredentialRow | null;
  availableLocations: GoogleBusinessProfileAvailableLocation[];
}> {
  const { accessToken, credential } = await getUsableAccessToken(externalProfile, client);
  const accounts = await listGoogleBusinessProfileAccounts(accessToken);
  const batches = await Promise.all(
    accounts.map((account) =>
      listGoogleBusinessProfileLocations(accessToken, account.name, account.accountName),
    ),
  );

  return {
    credential,
    availableLocations: batches.flat(),
  };
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
    connectedGoogleEmail: credential?.connected_google_email ?? null,
    connectedGoogleName: credential?.connected_google_name ?? null,
    externalAccountId: externalProfile?.external_account_id ?? null,
    externalAccountName: externalProfile?.external_account_name ?? null,
    externalLocationId: externalProfile?.external_location_id ?? null,
    externalLocationName: externalProfile?.external_location_name ?? null,
    externalLocationTitle: externalProfile?.external_location_title ?? null,
    externalPlaceId: externalProfile?.external_place_id ?? null,
    lastPullAt: externalProfile?.last_pull_at ?? null,
    lastPushAt: externalProfile?.last_push_at ?? null,
    lastError: externalProfile?.last_error ?? null,
    availableLocations,
    businessInfo,
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
  externalProfile:
    | Pick<ExternalProfileRow, 'last_pull_at' | 'last_push_at'>
    | null
    | undefined,
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

export async function createGoogleBusinessProfileAuthorizationUrl(params: {
  restaurantId: string;
  requestedByUserId: string;
  returnPath?: string;
  client?: DbClient;
}): Promise<string> {
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

  return buildGoogleBusinessProfileAuthUrl(stateToken);
}

export async function completeGoogleBusinessProfileAuthorization(params: {
  stateToken: string;
  code: string;
  client?: DbClient;
}): Promise<{ restaurantId: string; returnPath: string }> {
  const client = getClient(params.client);
  const state = await consumeOAuthStateRecord(params.stateToken, client);
  const externalProfile = await ensureExternalProfile(state.restaurant_id, client);

  try {
    const tokens = await exchangeGoogleBusinessProfileCode(params.code);
    const identity = await fetchGoogleBusinessProfileIdentity(tokens.accessToken);

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
      returnPath: state.return_path || DEFAULT_RETURN_PATH,
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
    returnPath: state.return_path || DEFAULT_RETURN_PATH,
  };
}

export async function getGoogleBusinessProfileConnectionState(
  restaurantId: string,
  client?: DbClient,
): Promise<GoogleBusinessProfileConnectionState> {
  const resolvedClient = getClient(client);
  const businessInfo = await readGoogleBusinessProfileBusinessInfo(restaurantId, resolvedClient);
  const externalProfile = await findExternalProfile(restaurantId, resolvedClient);

  if (!externalProfile) {
    return buildConnectionState(null, null, [], businessInfo);
  }

  const credential = await getCredentialRow(externalProfile.id, resolvedClient);

  if (!isConfigured() || !credential) {
    return buildConnectionState(externalProfile, credential, [], businessInfo);
  }

  try {
    const discovery = await discoverLocationsForProfile(externalProfile, resolvedClient);
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

export async function syncGoogleBusinessProfileBusinessInformation(
  restaurantId: string,
  client?: DbClient,
): Promise<GoogleBusinessProfileConnectionState> {
  const resolvedClient = getClient(client);
  const externalProfile = await ensureExternalProfile(restaurantId, resolvedClient);

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
        connection_status: 'linked',
        last_pull_at: syncedAt,
        last_error: attributeWarning,
      },
      resolvedClient,
    );

    return getGoogleBusinessProfileConnectionState(restaurantId, resolvedClient);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Google Business Profile sync failed unexpectedly.';

    if (!isGoogleBusinessProfileError(error) || error.code !== 'GBP_REAUTH_REQUIRED') {
      await updateExternalProfile(
        externalProfile.id,
        {
          connection_status: 'sync_error',
          last_error: message,
        },
        resolvedClient,
      );
    }

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
  );

  const pushedAt = nowIso();
  await markGooglePushSuccess(externalProfile.id, pushedAt, resolvedClient);
  await syncGoogleBusinessProfileBusinessInformation(params.restaurantId, resolvedClient);

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
  );

  const pushedAt = nowIso();
  await markGooglePushSuccess(externalProfile.id, pushedAt, resolvedClient);
  await syncGoogleBusinessProfileBusinessInformation(params.restaurantId, resolvedClient);

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
  );

  const pushedAt = nowIso();
  await markGooglePushSuccess(externalProfile.id, pushedAt, resolvedClient);
  await syncGoogleBusinessProfileBusinessInformation(params.restaurantId, resolvedClient);

  return getServicePeriods(params.restaurantId, resolvedClient);
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
