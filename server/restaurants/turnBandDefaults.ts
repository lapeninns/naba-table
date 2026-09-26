import { inferMealTypeFromTime } from '@/server/bookings';
import { getVenuePolicy, type ServiceKey, type TurnBand } from '@/server/capacity/policy';

import type { TurnBandsByOption } from '@/server/capacity/policy';
import type { ServicePeriod } from '@/server/restaurants/servicePeriods';
import type { TurnBandInput, TurnBandsPayload } from '@/server/restaurants/turnBands';

/** What the turn-bands GET/PUT routes and the availability command return for turn bands. */
export type TurnBandsSnapshot = {
  restaurantId: string;
  bands: TurnBandsByOption;
  defaults: TurnBandsPayload;
};

function cloneBands(bands: TurnBand[]): TurnBandInput[] {
  return bands.map((band) => ({
    maxPartySize: band.maxPartySize,
    durationMinutes: band.durationMinutes,
  }));
}

function resolveServiceKey(optionKey: string, startTime: string | null): ServiceKey {
  if (optionKey === 'lunch' || optionKey === 'dinner') {
    return optionKey;
  }
  return inferMealTypeFromTime(startTime ?? '18:00');
}

/**
 * The platform default table times for every booking option the restaurant uses: options with
 * service periods, options with their own bands, and always Lunch and Dinner. An option's
 * default follows the meal its earliest period starts in.
 */
export function deriveTurnBandDefaults(
  bands: TurnBandsByOption,
  periods: readonly Pick<ServicePeriod, 'bookingOption' | 'startTime'>[],
): TurnBandsPayload {
  const optionKeys = new Set<string>();
  const optionStartTimes = new Map<string, string>();

  periods.forEach((period) => {
    const optionKey = period.bookingOption;
    optionKeys.add(optionKey);
    const existingStart = optionStartTimes.get(optionKey);
    if (!existingStart || period.startTime < existingStart) {
      optionStartTimes.set(optionKey, period.startTime);
    }
  });

  Object.keys(bands).forEach((optionKey) => optionKeys.add(optionKey));
  optionKeys.add('lunch');
  optionKeys.add('dinner');

  const policy = getVenuePolicy();
  const defaults: TurnBandsPayload = {};
  optionKeys.forEach((optionKey) => {
    const serviceKey = resolveServiceKey(optionKey, optionStartTimes.get(optionKey) ?? null);
    const service = policy.services[serviceKey];
    if (service?.turnBands?.length) {
      defaults[optionKey] = cloneBands(service.turnBands);
    }
  });

  return defaults;
}

export function buildTurnBandsSnapshot(
  restaurantId: string,
  bands: TurnBandsByOption,
  periods: readonly Pick<ServicePeriod, 'bookingOption' | 'startTime'>[],
): TurnBandsSnapshot {
  return { restaurantId, bands, defaults: deriveTurnBandDefaults(bands, periods) };
}
