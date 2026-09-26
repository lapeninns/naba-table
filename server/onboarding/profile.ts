import 'server-only';

import { updateRestaurant } from '@/server/restaurants/update';

import type { UpdateRestaurantInput } from '@/server/restaurants/update';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

/** Another restaurant already uses the requested slug. */
export class OnboardingSlugTakenError extends Error {
  constructor() {
    super('Slug is already in use');
    this.name = 'OnboardingSlugTakenError';
  }
}

export type OnboardingProfilePatch = Pick<
  UpdateRestaurantInput,
  'name' | 'slug' | 'timezone' | 'contactEmail' | 'contactPhone' | 'bookingPolicy'
>;

export type OnboardingProfileResult = { id: string; name: string; slug: string; timezone: string };

// updateRestaurant reports a slug clash as a plain Error: its own pre-check message, or the
// unique-index violation text when a concurrent write wins the race after the pre-check.
const SLUG_PRECHECK_MESSAGE = 'Slug is already in use by another restaurant';

function isSlugConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === SLUG_PRECHECK_MESSAGE || error.message.includes('restaurants_slug_key');
}

/**
 * Onboarding profile update (Back navigation after the restaurant exists). Only the fields
 * the owner changed are sent, so an unchanged slug is never re-checked. A slug clash is
 * returned as a typed error for a 409 SLUG_TAKEN; everything else propagates as a 500.
 */
export async function updateOnboardingProfile(
  restaurantId: string,
  patch: OnboardingProfilePatch,
  client: DbClient,
): Promise<OnboardingProfileResult> {
  try {
    const restaurant = await updateRestaurant(restaurantId, patch, client);
    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      timezone: restaurant.timezone,
    };
  } catch (error) {
    if (isSlugConflict(error)) {
      throw new OnboardingSlugTakenError();
    }
    throw error;
  }
}
