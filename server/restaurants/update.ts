import { ensureLogoColumnOnRow, isLogoUrlColumnMissing, logLogoColumnFallback } from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { assertValidTimezone } from '@/server/restaurants/timezone';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
type RestaurantUpdate = Database['public']['Tables']['restaurants']['Update'];
type PublicSchema = Database['public'];
type DbClient = SupabaseClient<Database, 'public', PublicSchema>;

export type UpdateRestaurantInput = {
  name?: string;
  slug?: string;
  timezone?: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  bookingPolicy?: string | null;
  logoUrl?: string | null;
  reservationIntervalMinutes?: number;
  reservationDefaultDurationMinutes?: number;
  reservationLastSeatingBufferMinutes?: number;
};

export type UpdatedRestaurant = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  bookingPolicy: string | null;
  logoUrl: string | null;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export async function updateRestaurant(
  restaurantId: string,
  input: UpdateRestaurantInput,
  client: DbClient = getServiceSupabaseClient(),
): Promise<UpdatedRestaurant> {
  if (Object.keys(input).length === 0) {
    throw new Error('No fields to update');
  }

  const updateData: RestaurantUpdate = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  if (input.slug !== undefined) {
    const { data: existingSlug, error: slugCheckError } = await client
      .from('restaurants')
      .select('id')
      .eq('slug', input.slug)
      .neq('id', restaurantId)
      .maybeSingle();

    if (slugCheckError) {
      throw new Error(`Failed to check slug uniqueness: ${slugCheckError.message}`);
    }

    if (existingSlug) {
      throw new Error('Slug is already in use by another restaurant');
    }

    updateData.slug = input.slug;
  }

  if (input.timezone !== undefined) {
    updateData.timezone = assertValidTimezone(input.timezone);
  }

  if (input.capacity !== undefined) {
    updateData.capacity = input.capacity;
  }

  if (input.contactEmail !== undefined) {
    updateData.contact_email = input.contactEmail;
  }

  if (input.contactPhone !== undefined) {
    updateData.contact_phone = input.contactPhone;
  }

  if (input.address !== undefined) {
    updateData.address = input.address;
  }

  if (input.bookingPolicy !== undefined) {
    updateData.booking_policy = input.bookingPolicy;
  }

  if (input.logoUrl !== undefined) {
    const trimmed = input.logoUrl?.trim();
    updateData.logo_url = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  if (input.reservationIntervalMinutes !== undefined) {
    const value = input.reservationIntervalMinutes;
    if (!Number.isInteger(value) || value < 1 || value > 180) {
      throw new Error('Reservation interval must be an integer between 1 and 180 minutes.');
    }
    updateData.reservation_interval_minutes = value;
  }

  if (input.reservationDefaultDurationMinutes !== undefined) {
    const value = input.reservationDefaultDurationMinutes;
    if (!Number.isInteger(value) || value < 15 || value > 300) {
      throw new Error('Reservation duration must be an integer between 15 and 300 minutes.');
    }
    updateData.reservation_default_duration_minutes = value;
  }

  if (input.reservationLastSeatingBufferMinutes !== undefined) {
    const value = input.reservationLastSeatingBufferMinutes;
    if (!Number.isInteger(value) || value < 15 || value > 300) {
      throw new Error('Last seating buffer must be an integer between 15 and 300 minutes.');
    }
    updateData.reservation_last_seating_buffer_minutes = value;
  }

  const runUpdate = (includeLogo: boolean, payload: RestaurantUpdate) =>
    client
      .from('restaurants')
      .update(payload)
      .eq('id', restaurantId)
      .select(restaurantSelectColumns(includeLogo))
      .single<RestaurantRow>();

  let { data, error } = await runUpdate(true, updateData);

  if (error && isLogoUrlColumnMissing(error)) {
    logLogoColumnFallback('updateRestaurant');
    const fallbackPayload: RestaurantUpdate = { ...updateData };
    delete fallbackPayload.logo_url;
    ({ data, error } = await runUpdate(false, fallbackPayload));
    data = ensureLogoColumnOnRow(data);
  }

  if (error) {
    console.error('[updateRestaurant] Update failed', error);
    throw new Error(`Failed to update restaurant: ${error.message}`);
  }

  if (!data) {
    throw new Error('Restaurant not found');
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    timezone: data.timezone,
    capacity: data.capacity,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    address: data.address,
    bookingPolicy: data.booking_policy,
    logoUrl: data.logo_url,
    reservationIntervalMinutes: data.reservation_interval_minutes,
    reservationDefaultDurationMinutes: data.reservation_default_duration_minutes,
    reservationLastSeatingBufferMinutes: data.reservation_last_seating_buffer_minutes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
