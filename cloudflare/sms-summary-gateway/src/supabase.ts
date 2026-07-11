import { createClient } from '@supabase/supabase-js';

import {
  computeServiceBreakdown,
  formatDailyBookingSummaryMessage,
} from '../../../lib/ops/daily-booking-summary';

import type { DailySummaryPreview, RestaurantDailySummaryTarget } from './contracts';

type WorkerEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type RestaurantRow = {
  id: string;
  name: string | null;
  timezone: string | null;
  is_active: boolean | null;
  manager_daily_summary_enabled: boolean | null;
  manager_notification_phone: string | null;
  manager_whatsapp_enabled: boolean | null;
  manager_whatsapp_consent_phone: string | null;
};

type BookingRow = {
  status: string;
  booking_type: string | null;
  party_size: number | null;
};

function createSupabaseAdminClient(env: WorkerEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function mapRestaurantTarget(row: RestaurantRow): RestaurantDailySummaryTarget | null {
  if (!row.id || !row.timezone || row.is_active === false || !row.manager_notification_phone) {
    return null;
  }

  return {
    restaurantId: row.id,
    timezone: row.timezone,
    enabled: row.manager_daily_summary_enabled === true,
    recipient: row.manager_notification_phone,
    whatsappFirst:
      row.manager_whatsapp_enabled === true &&
      row.manager_whatsapp_consent_phone === row.manager_notification_phone,
  };
}

export async function listRestaurantDailySummaryTargets(
  env: WorkerEnv,
): Promise<RestaurantDailySummaryTarget[]> {
  const supabase = createSupabaseAdminClient(env);
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'id, timezone, is_active, manager_daily_summary_enabled, manager_notification_phone, manager_whatsapp_enabled, manager_whatsapp_consent_phone',
    )
    .eq('is_active', true)
    .eq('manager_daily_summary_enabled', true)
    .not('manager_notification_phone', 'is', null);

  if (error) {
    throw new Error(`Failed to load manager daily summary targets: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => mapRestaurantTarget(row as RestaurantRow))
    .filter((row): row is RestaurantDailySummaryTarget => row !== null);
}

export async function getRestaurantDailySummaryTarget(
  env: WorkerEnv,
  restaurantId: string,
): Promise<RestaurantDailySummaryTarget | null> {
  const supabase = createSupabaseAdminClient(env);
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'id, timezone, is_active, manager_daily_summary_enabled, manager_notification_phone, manager_whatsapp_enabled, manager_whatsapp_consent_phone',
    )
    .eq('id', restaurantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load manager daily summary target: ${error.message}`);
  }

  return data ? mapRestaurantTarget(data as RestaurantRow) : null;
}

export async function buildDailySummaryPreview(
  env: WorkerEnv,
  params: {
    restaurantId: string;
    localDate: string;
    timezone: string;
  },
): Promise<DailySummaryPreview> {
  const supabase = createSupabaseAdminClient(env);
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('name')
    .eq('id', params.restaurantId)
    .maybeSingle();

  if (restaurantError) {
    throw new Error(`Failed to load restaurant for summary: ${restaurantError.message}`);
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('status, booking_type, party_size')
    .eq('restaurant_id', params.restaurantId)
    .eq('booking_date', params.localDate);

  if (error) {
    throw new Error(`Failed to load bookings for summary: ${error.message}`);
  }

  const bookings = (data ?? []) as BookingRow[];
  const serviceBreakdown = computeServiceBreakdown(
    bookings.map((booking) => ({
      status: booking.status as never,
      bookingType: booking.booking_type,
      partySize: booking.party_size ?? 0,
    })),
  );

  const summary = { serviceBreakdown };

  return {
    date: params.localDate,
    timezone: params.timezone,
    restaurantId: params.restaurantId,
    summary,
    message: formatDailyBookingSummaryMessage(summary, {
      venueName: restaurant?.name?.trim() || 'Restaurant',
    }),
  };
}
