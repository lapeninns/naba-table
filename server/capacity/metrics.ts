import { getServiceSupabaseClient } from '@/server/supabase';

export type CapacityMetricType = 'success' | 'conflict' | 'capacity_exceeded';

export type RecordCapacityMetricParams = {
  restaurantId: string;
  bookingDate: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM(:SS)?
  metric: CapacityMetricType;
};

function buildWindowStart(date: string, time?: string | null): string {
  const normalizedTime = time && time.length > 0 ? time : '00:00';
  // Ensure seconds for ISO compliance
  const timeWithSeconds = normalizedTime.length === 5 ? `${normalizedTime}:00` : normalizedTime;
  const iso = `${date}T${timeWithSeconds}Z`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(`${date}T00:00:00Z`).toISOString();
  }
  return parsed.toISOString();
}

export async function recordCapacityMetric({ restaurantId, bookingDate, startTime, metric }: RecordCapacityMetricParams): Promise<void> {
  try {
    if (!restaurantId || !bookingDate) {
      return;
    }

    const supabase = getServiceSupabaseClient();
    const windowStart = buildWindowStart(bookingDate, startTime);

    const payload = {
      p_restaurant_id: restaurantId,
      p_window_start: windowStart,
      p_success_delta: metric === 'success' ? 1 : 0,
      p_conflict_delta: metric === 'conflict' ? 1 : 0,
      p_capacity_exceeded_delta: metric === 'capacity_exceeded' ? 1 : 0,
    } as const;

    await supabase.rpc('increment_capacity_metrics', payload);
  } catch (error) {
    console.error('[capacity-metrics] failed to record metric', {
      restaurantId,
      bookingDate,
      startTime,
      metric,
      error,
    });
  }
}
