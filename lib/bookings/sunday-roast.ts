import type { Json } from '@/types/supabase';

export const SUNDAY_ROAST_OCCASION = 'Sunday Roast';

export function isSundayBookingDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getUTCDay() === 0
  );
}

function asJsonObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

export function withSundayRoastDetails(details: Json | null, selected: boolean): Json | null {
  if (!selected) {
    const next = asJsonObject(details);
    delete next.sunday_roast;
    if (next.occasion === SUNDAY_ROAST_OCCASION) {
      delete next.occasion;
    }
    return Object.keys(next).length > 0 ? next : null;
  }

  return {
    ...asJsonObject(details),
    occasion: SUNDAY_ROAST_OCCASION,
    sunday_roast: true,
  };
}

export function withFallbackBookingDetail(details: Json | null): Json {
  return {
    ...asJsonObject(details),
    fallback: 'missing_rpc_booking_record',
  };
}
