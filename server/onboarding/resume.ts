import 'server-only';

import { logger } from '@/lib/logger';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { getRequestUser } from '@/server/auth/request-user';
import { getOnboardingReadiness } from '@/server/onboarding/readiness';
import { getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import type { OnboardingResume } from '@/components/features/onboarding/types';

/**
 * Server facts the onboarding wizard needs to resume: who is signed in, which restaurants
 * they belong to and, for an owner whose only restaurant is still missing setup, that
 * restaurant's basics. This is how the wizard survives the signup confirmation hop: the
 * email link opens a new tab whose sessionStorage draft is empty, so the session and the
 * restaurant are read from the server instead of from persistent browser storage.
 *
 * Returns undefined when the lookup fails, so the wizard falls back to the stored draft.
 */
export async function loadOnboardingResume(): Promise<OnboardingResume | undefined> {
  try {
    const { user } = await getRequestUser();
    if (!user) {
      return { session: null, memberRestaurantIds: [], resumeRestaurant: null };
    }

    const client = getServiceSupabaseClient();
    const memberships = await fetchUserMemberships(user.id, client);
    const memberRestaurantIds = memberships
      .map((membership) => membership.restaurant_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const resume: OnboardingResume = {
      session: { email: user.email ?? null },
      memberRestaurantIds,
      resumeRestaurant: null,
    };

    const only = memberships.length === 1 ? memberships[0] : undefined;
    if (!only || !isRestaurantAdminRole(only.role) || !only.restaurant_id) {
      return resume;
    }

    const readiness = await getOnboardingReadiness(client, only.restaurant_id);
    if (readiness.ready) {
      return resume;
    }

    const { data: restaurant, error } = await client
      .from('restaurants')
      .select('id, name, slug, timezone')
      .eq('id', only.restaurant_id)
      .maybeSingle();
    if (error || !restaurant) {
      return resume;
    }

    return {
      ...resume,
      resumeRestaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        timezone: restaurant.timezone,
      },
    };
  } catch (error) {
    logger.warn('onboarding.resume_unavailable', {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return undefined;
  }
}
