import { useMemo } from 'react';


import { getDateKeyDayOfWeek } from '../lib/date';
import { parseTimeToMinutes } from '../lib/timeline';

import type { OperatingHoursSnapshot, RestaurantProfile, ServicePeriodRow } from '@/services/ops/restaurants';

export type FloorPlanTimelineConfig = {
  min: number;
  max: number;
  periods: ServicePeriodRow[];
  interval: number;
  slotTimes: number[];
};

export type FloorPlanOperatingData = {
  hours: OperatingHoursSnapshot;
  periods: ServicePeriodRow[];
  profile: RestaurantProfile;
};

export function useFloorPlanTimelineConfig(operatingData: FloorPlanOperatingData | undefined, selectedDate: string): FloorPlanTimelineConfig {
  return useMemo(() => {
    if (!operatingData) {
      return { min: 11 * 60, max: 23 * 60, periods: [], interval: 15, slotTimes: [] };
    }

    const dayOfWeek = getDateKeyDayOfWeek(selectedDate); // 0 = Sunday
    const dailyHours = operatingData.hours.weekly.find((h) => h.dayOfWeek === dayOfWeek);
    const overrideHours = operatingData.hours.overrides.find((h) => h.effectiveDate === selectedDate);
    const effectiveHours = overrideHours ?? dailyHours;
    const periods = operatingData.periods.filter((p) => p.dayOfWeek === dayOfWeek);

    let min = 11 * 60;
    let max = 23 * 60;

    if (effectiveHours && effectiveHours.opensAt && effectiveHours.closesAt) {
      min = parseTimeToMinutes(effectiveHours.opensAt);
      max = parseTimeToMinutes(effectiveHours.closesAt);
      // Handle late night closing (e.g., 01:00)
      if (max < min) max += 24 * 60;
    }

    const overrideSlotTimes = overrideHours?.reservationSlotTimes ?? [];
    const weeklySlotTimes = dailyHours?.reservationSlotTimes ?? [];
    const rawSlots = overrideSlotTimes.length > 0 ? overrideSlotTimes : weeklySlotTimes;
    const slotTimes = rawSlots
      .filter((slot) => typeof slot === 'string' && slot.trim().length > 0)
      .map((slot) => parseTimeToMinutes(slot))
      .filter((slot) => Number.isFinite(slot))
      .filter((slot) => slot >= min && slot <= max)
      .filter((slot, index, list) => list.indexOf(slot) === index)
      .sort((a, b) => a - b);

    if (slotTimes.length > 0) {
      min = slotTimes[0];
      max = slotTimes[slotTimes.length - 1];
    }

    const baseInterval =
      overrideHours?.reservationIntervalMinutes ??
      dailyHours?.reservationIntervalMinutes ??
      operatingData.profile.reservationIntervalMinutes ??
      15;

    const interval =
      slotTimes.length > 1
        ? Math.min(...slotTimes.slice(1).map((slot, index) => slot - slotTimes[index]))
        : baseInterval;

    return { min, max, periods, interval, slotTimes };
  }, [operatingData, selectedDate]);
}
