import type { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '@/server/supabase';
import type { Database } from '@/types/supabase';

type DbClient = SupabaseClient<Database, 'public', any>;

export type RestaurantDetails = {
  restaurantId: string;
  name: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export type UpdateRestaurantDetailsInput = {
  name?: string;
  timezone: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

function sanitizeString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateDetailsInput(input: UpdateRestaurantDetailsInput): Required<UpdateRestaurantDetailsInput> {
  const timezone = input.timezone?.trim();
  if (!timezone) {
    throw new Error('Timezone is required');
  }

  const name = input.name?.trim() ?? '';
  if (name.length === 0) {
    throw new Error('Name is required');
  }

  const capacity =
    input.capacity === undefined || input.capacity === null ? null : Number.isFinite(input.capacity) ? input.capacity : null;
  if (capacity !== null && capacity < 0) {
    throw new Error('Capacity must be a positive number');
  }

  return {
    name,
    timezone,
    capacity,
    contactEmail: sanitizeString(input.contactEmail ?? null),
    contactPhone: sanitizeString(input.contactPhone ?? null),
  };
}

export async function getRestaurantDetails(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantDetails> {
  const { data, error } = await client
    .from('restaurants')
    .select('id, name, timezone, capacity, contact_email, contact_phone')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Restaurant not found');
  }

  return {
    restaurantId: data.id,
    name: data.name,
    timezone: data.timezone,
    capacity: data.capacity,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
  };
}

export async function updateRestaurantDetails(
  restaurantId: string,
  input: UpdateRestaurantDetailsInput,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantDetails> {
  const validated = validateDetailsInput(input);

  const { error } = await client
    .from('restaurants')
    .update({
      name: validated.name,
      timezone: validated.timezone,
      capacity: validated.capacity,
      contact_email: validated.contactEmail,
      contact_phone: validated.contactPhone,
    })
    .eq('id', restaurantId);

  if (error) {
    throw error;
  }

  return getRestaurantDetails(restaurantId, client);
}
