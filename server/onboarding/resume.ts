import 'server-only';

import { logger } from '@/lib/logger';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { getRequestUser } from '@/server/auth/request-user';
import { getOnboardingReadiness } from '@/server/onboarding/readiness';
import { canonicalizeFromDb } from '@/server/restaurants/timeNormalization';
import { getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import type {
  OnboardingResume,
  OnboardingSavedSetup,
  OperatingHour,
} from '@/components/features/onboarding/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

const DAYS_IN_WEEK = 7;

function toTime(value: string | null | undefined): string | null {
  return canonicalizeFromDb(value) ?? null;
}

/**
 * The hours, service periods, zones and tables already saved for the restaurant. Without
 * this a resumed wizard would show client defaults and saving would overwrite (and, for the
 * replace-style layout, delete) the owner's earlier work. Every read is scoped by
 * restaurant_id. Returns null when any read fails, and the caller logs it.
 */
export async function loadOnboardingSavedSetup(
  client: DbClient,
  restaurantId: string,
): Promise<OnboardingSavedSetup | null> {
  const [hours, periods, zones, tables] = await Promise.all([
    client
      .from('restaurant_operating_hours')
      .select('day_of_week, opens_at, closes_at, is_closed, notes')
      .eq('restaurant_id', restaurantId)
      .is('effective_date', null)
      .order('day_of_week', { ascending: true }),
    client
      .from('restaurant_service_periods')
      .select('id, name, day_of_week, start_time, end_time, booking_option')
      .eq('restaurant_id', restaurantId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true }),
    client
      .from('zones')
      .select('id, name, sort_order, active')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    client
      .from('table_inventory')
      .select('id, table_number, capacity, zone_id')
      .eq('restaurant_id', restaurantId)
      .order('table_number', { ascending: true }),
  ]);

  const failed = [hours, periods, zones, tables].find((result) => result.error);
  if (failed) {
    logger.warn('onboarding.resume_setup_unavailable', {
      restaurantId,
      dbCode: failed.error?.code,
    });
    return null;
  }

  const byDay = new Map<number, OperatingHour>();
  for (const row of hours.data ?? []) {
    if (row.day_of_week === null || byDay.has(row.day_of_week)) continue;
    byDay.set(row.day_of_week, {
      dayOfWeek: row.day_of_week,
      opensAt: row.is_closed ? null : toTime(row.opens_at),
      closesAt: row.is_closed ? null : toTime(row.closes_at),
      isClosed: row.is_closed,
      notes: row.notes ?? null,
    });
  }
  const operatingHours = Array.from({ length: DAYS_IN_WEEK }, (_, day) => {
    return (
      byDay.get(day) ?? { dayOfWeek: day, opensAt: null, closesAt: null, isClosed: true, notes: null }
    );
  });

  return {
    operatingHours,
    servicePeriods: (periods.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      dayOfWeek: row.day_of_week,
      startTime: toTime(row.start_time) ?? '',
      endTime: toTime(row.end_time) ?? '',
      bookingOption: row.booking_option,
    })),
    zones: (zones.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order,
      active: row.active,
    })),
    tables: (tables.data ?? []).map((row) => ({
      id: row.id,
      tableNumber: row.table_number,
      capacity: row.capacity,
      zoneId: row.zone_id,
    })),
  };
}

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
        setup: await loadOnboardingSavedSetup(client, restaurant.id),
      },
    };
  } catch (error) {
    logger.warn('onboarding.resume_unavailable', {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return undefined;
  }
}
