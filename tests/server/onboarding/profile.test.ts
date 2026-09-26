import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateRestaurantMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/server/restaurants/update', () => ({ updateRestaurant: updateRestaurantMock }));

import { OnboardingSlugTakenError, updateOnboardingProfile } from '@/server/onboarding/profile';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT = {} as SupabaseClient<Database>;

beforeEach(() => {
  updateRestaurantMock.mockReset();
});

describe('updateOnboardingProfile @p1 @unit', () => {
  it('passes the patch through and returns the basics', async () => {
    updateRestaurantMock.mockResolvedValue({
      id: RESTAURANT_ID,
      name: 'A',
      slug: 'a',
      timezone: 'Europe/London',
      contactEmail: 'x@example.com',
    });

    await expect(updateOnboardingProfile(RESTAURANT_ID, { name: 'A' }, CLIENT)).resolves.toEqual({
      id: RESTAURANT_ID,
      name: 'A',
      slug: 'a',
      timezone: 'Europe/London',
    });
    expect(updateRestaurantMock).toHaveBeenCalledWith(RESTAURANT_ID, { name: 'A' }, CLIENT);
  });

  it.each([
    'Slug is already in use by another restaurant',
    'Failed to update restaurant: duplicate key value violates unique constraint "restaurants_slug_key"',
  ])('maps a slug clash (%s) to OnboardingSlugTakenError', async (message) => {
    updateRestaurantMock.mockRejectedValue(new Error(message));
    await expect(
      updateOnboardingProfile(RESTAURANT_ID, { slug: 'taken' }, CLIENT),
    ).rejects.toBeInstanceOf(OnboardingSlugTakenError);
  });

  it('rethrows other failures unchanged', async () => {
    const failure = new Error('Failed to update restaurant: timeout');
    updateRestaurantMock.mockRejectedValue(failure);
    await expect(updateOnboardingProfile(RESTAURANT_ID, { name: 'B' }, CLIENT)).rejects.toBe(
      failure,
    );
  });
});
