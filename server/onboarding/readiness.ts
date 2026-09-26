import 'server-only';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

/** A setup requirement that must be met before the restaurant leaves onboarding. */
export type OnboardingRequirement = 'operating_hours' | 'service_periods' | 'tables';

export type OnboardingReadiness = {
  ready: boolean;
  missing: OnboardingRequirement[];
};

/** Unexpected failure while reading setup state. Carries the Postgres code for logs only. */
export class OnboardingReadinessError extends Error {
  constructor(
    readonly requirement: OnboardingRequirement,
    readonly dbCode: string | undefined,
  ) {
    super('Unable to read onboarding readiness');
    this.name = 'OnboardingReadinessError';
  }
}

type CountResult = { count: number | null; error: { code?: string } | null };

function assertCount(requirement: OnboardingRequirement, result: CountResult): number {
  if (result.error) {
    throw new OnboardingReadinessError(requirement, result.error.code);
  }
  return result.count ?? 0;
}

/**
 * Checks the minimum setup a restaurant needs to take bookings: at least one open weekly
 * operating-hours row, at least one service period and at least one table. Read-only, so
 * repeated calls are safe. Every query is scoped by `restaurant_id`.
 */
export async function getOnboardingReadiness(
  client: DbClient,
  restaurantId: string,
): Promise<OnboardingReadiness> {
  const [hours, periods, tables] = await Promise.all([
    client
      .from('restaurant_operating_hours')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('is_closed', false)
      .is('effective_date', null),
    client
      .from('restaurant_service_periods')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    client
      .from('table_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
  ]);

  const missing: OnboardingRequirement[] = [];
  if (assertCount('operating_hours', hours) === 0) missing.push('operating_hours');
  if (assertCount('service_periods', periods) === 0) missing.push('service_periods');
  if (assertCount('tables', tables) === 0) missing.push('tables');

  return { ready: missing.length === 0, missing };
}
