import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';
import {
  ensureLogoColumnOnRow,
  isLogoUrlColumnMissing,
  logLogoColumnFallback,
} from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { assertValidTimezone } from '@/server/restaurants/timezone';
import { getServiceSupabaseClient } from '@/server/supabase';

import { updateRestaurant } from './update';

import type { UpdateRestaurantInput } from './update';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
type BusinessDetailsRow = Database['public']['Tables']['restaurant_business_details']['Row'];
type DbClient = SupabaseClient<Database>;

const CORE_SOURCE = 'nabatable';
const CORE_MANAGED_BY = 'nabatable';

export type RestaurantDetails = {
  restaurantId: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  businessDescription: string | null;
  managerDailySummaryEnabled: boolean;
  managerNotificationPhone: string | null;
  googleMapUrl: string | null;
  googleReviewUrl: string | null;
  bookingPolicy: string | null;
  logoUrl: string | null;
  updatedAt: string | null;
};

export type UpdateRestaurantDetailsInput = {
  name?: string;
  slug?: string;
  timezone?: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  businessDescription?: string | null;
  managerDailySummaryEnabled?: boolean;
  managerNotificationPhone?: string | null;
  googleMapUrl?: string | null;
  googleReviewUrl?: string | null;
  bookingPolicy?: string | null;
  logoUrl?: string | null;
};

function sanitizeString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateName(value: string | undefined): string {
  const name = value?.trim() ?? '';
  if (!name) {
    throw new Error('Name is required');
  }
  return name;
}

function validateSlug(value: string | undefined): string {
  const slug = value?.trim() ?? '';
  if (!slug) {
    throw new Error('Slug is required');
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error('Slug must contain only lowercase letters, numbers, and hyphens');
  }
  return slug;
}

function validateCapacity(value: number | null | undefined): number | null {
  const capacity =
    value === null || value === undefined ? null : Number.isFinite(value) ? value : null;
  if (capacity !== null && capacity < 0) {
    throw new Error('Capacity must be a positive number');
  }
  return capacity;
}

function hasInput<K extends keyof UpdateRestaurantDetailsInput>(
  input: UpdateRestaurantDetailsInput,
  key: K,
): boolean {
  return Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined;
}

function buildRestaurantDetailsUpdatePayload(
  input: UpdateRestaurantDetailsInput,
): UpdateRestaurantInput {
  const payload: UpdateRestaurantInput = {};

  if (hasInput(input, 'name')) {
    payload.name = validateName(input.name);
  }
  if (hasInput(input, 'slug')) {
    payload.slug = validateSlug(input.slug);
  }
  if (hasInput(input, 'timezone')) {
    payload.timezone = assertValidTimezone(input.timezone);
  }
  if (hasInput(input, 'capacity')) {
    payload.capacity = validateCapacity(input.capacity);
  }
  if (hasInput(input, 'contactEmail')) {
    payload.contactEmail = sanitizeString(input.contactEmail);
  }
  if (hasInput(input, 'contactPhone')) {
    payload.contactPhone = sanitizeString(input.contactPhone);
  }
  if (hasInput(input, 'address')) {
    payload.address = sanitizeString(input.address);
  }
  if (hasInput(input, 'managerDailySummaryEnabled')) {
    payload.managerDailySummaryEnabled = input.managerDailySummaryEnabled ?? false;
  }
  if (hasInput(input, 'managerNotificationPhone')) {
    payload.managerNotificationPhone = sanitizeString(input.managerNotificationPhone);
  }
  if (hasInput(input, 'googleMapUrl')) {
    payload.googleMapUrl = safeGoogleMapsUrl(input.googleMapUrl);
  }
  if (hasInput(input, 'googleReviewUrl')) {
    payload.googleReviewUrl = safeGoogleReviewUrl(input.googleReviewUrl);
  }
  if (hasInput(input, 'bookingPolicy')) {
    payload.bookingPolicy = sanitizeString(input.bookingPolicy);
  }
  if (hasInput(input, 'logoUrl')) {
    payload.logoUrl = sanitizeString(input.logoUrl);
  }

  return payload;
}

export async function getRestaurantBusinessDescription(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<string | null> {
  const { data, error } = await client
    .from('restaurant_business_details')
    .select('description')
    .eq('restaurant_id', restaurantId)
    .eq('source', CORE_SOURCE)
    .eq('managed_by', CORE_MANAGED_BY)
    .maybeSingle<Pick<BusinessDetailsRow, 'description'>>();

  if (error) {
    throw error;
  }

  return data?.description ?? null;
}

export async function upsertRestaurantBusinessDescription(
  restaurantId: string,
  description: string | null | undefined,
  client: DbClient = getServiceSupabaseClient(),
): Promise<string | null> {
  const normalizedDescription = sanitizeString(description);
  const { error } = await client.from('restaurant_business_details').upsert(
    {
      restaurant_id: restaurantId,
      description: normalizedDescription,
      source: CORE_SOURCE,
      managed_by: CORE_MANAGED_BY,
      last_manual_override_at: new Date().toISOString(),
      change_origin: 'owner',
      changed_via: 'ops_restaurant_profile',
      change_reason: 'Owner/admin restaurant profile update.',
    },
    {
      onConflict: 'restaurant_id,source,managed_by',
    },
  );

  if (error) {
    throw error;
  }

  return normalizedDescription;
}

export async function getRestaurantDetails(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantDetails> {
  const execute = (includeLogo: boolean) =>
    client
      .from('restaurants')
      .select(restaurantSelectColumns(includeLogo))
      .eq('id', restaurantId)
      .maybeSingle<RestaurantRow>();

  let { data, error } = await execute(true);

  if (error && isLogoUrlColumnMissing(error)) {
    logLogoColumnFallback('getRestaurantDetails');
    ({ data, error } = await execute(false));
    data = ensureLogoColumnOnRow(data);
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Restaurant not found');
  }

  const restaurant = ensureLogoColumnOnRow(data);
  const businessDescription = await getRestaurantBusinessDescription(restaurantId, client);
  return {
    restaurantId: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    timezone: restaurant.timezone,
    capacity: restaurant.capacity,
    contactEmail: restaurant.contact_email,
    contactPhone: restaurant.contact_phone,
    address: restaurant.address,
    businessDescription,
    managerDailySummaryEnabled: restaurant.manager_daily_summary_enabled ?? false,
    managerNotificationPhone: restaurant.manager_notification_phone,
    googleMapUrl: safeGoogleMapsUrl(restaurant.google_map_url),
    googleReviewUrl: safeGoogleReviewUrl(restaurant.google_review_url),
    bookingPolicy: restaurant.booking_policy,
    logoUrl: restaurant.logo_url,
    updatedAt: restaurant.updated_at ?? null,
  };
}

export async function updateRestaurantDetails(
  restaurantId: string,
  input: UpdateRestaurantDetailsInput,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantDetails> {
  const payload = buildRestaurantDetailsUpdatePayload(input);
  const hasBusinessDescriptionInput = hasInput(input, 'businessDescription');

  if (Object.keys(payload).length === 0) {
    if (hasBusinessDescriptionInput) {
      await upsertRestaurantBusinessDescription(
        restaurantId,
        sanitizeString(input.businessDescription),
        client,
      );
    }
    return getRestaurantDetails(restaurantId, client);
  }

  const updated = await updateRestaurant(restaurantId, payload, client);
  const businessDescription = hasBusinessDescriptionInput
    ? await upsertRestaurantBusinessDescription(
        restaurantId,
        sanitizeString(input.businessDescription),
        client,
      )
    : await getRestaurantBusinessDescription(restaurantId, client);

  return {
    restaurantId: updated.id,
    name: updated.name,
    slug: updated.slug,
    timezone: updated.timezone,
    capacity: updated.capacity,
    contactEmail: updated.contactEmail,
    contactPhone: updated.contactPhone,
    address: updated.address,
    businessDescription,
    managerDailySummaryEnabled: updated.managerDailySummaryEnabled,
    managerNotificationPhone: updated.managerNotificationPhone,
    googleMapUrl: updated.googleMapUrl,
    googleReviewUrl: updated.googleReviewUrl,
    bookingPolicy: updated.bookingPolicy,
    logoUrl: updated.logoUrl,
    updatedAt: updated.updatedAt ?? null,
  };
}
