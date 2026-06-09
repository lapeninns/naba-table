import { DateTime } from 'luxon';

import {
  bandDuration,
  getBufferConfig,
  getVenuePolicy,
  serviceEnd,
  whichService,
  ServiceNotFoundError,
  ServiceOverrunError,
  type ServiceKey,
  type VenuePolicy,
} from '@/server/capacity/policy';
import { isAllocatorServiceFailHard } from '@/server/runtime-policy';

import { ManualSelectionInputError, type BookingWindow } from './types';

export type ComputeWindowArgs = {
  startISO?: string | null;
  bookingDate?: string | null;
  startTime?: string | null;
  partySize: number;
  bookingOption?: string | null;
  policy?: VenuePolicy;
  serviceHint?: ServiceKey | null;
};

export type BookingWindowWithFallback = {
  window: BookingWindow;
  usedFallback: boolean;
  fallbackService: ServiceKey | null;
};

export function computeBookingWindow(args: ComputeWindowArgs): BookingWindow {
  const policy = args.policy ?? getVenuePolicy();
  const baseStart = resolveStartDateTime(args, policy);
  const service = resolveService(baseStart, args.serviceHint ?? null, policy);
  const serviceConfig = policy.services[service];
  const allowOverrun = Boolean(serviceConfig?.allowOverrun);

  const diningMinutes = bandDuration(service, args.partySize, policy, args.bookingOption);
  const buffer = getBufferConfig(service, policy);
  const diningStart = baseStart;
  let diningEnd = diningStart.plus({ minutes: diningMinutes });
  const blockStart = diningStart.minus({ minutes: buffer.pre ?? 0 });
  let blockEnd = diningEnd.plus({ minutes: buffer.post ?? 0 });
  let clampedToServiceEnd = false;

  const serviceEndBoundary = serviceEnd(service, diningStart, policy);
  if (!allowOverrun) {
    if (blockEnd > serviceEndBoundary) {
      blockEnd = serviceEndBoundary;
      diningEnd = blockEnd.minus({ minutes: buffer.post ?? 0 });
      if (diningEnd <= diningStart) {
        throw new ServiceOverrunError(service, blockEnd, serviceEndBoundary);
      }
      clampedToServiceEnd = true;
    }
  }

  return {
    service,
    durationMinutes: Math.max(1, Math.round(diningEnd.diff(diningStart, 'minutes').minutes)),
    dining: {
      start: diningStart,
      end: diningEnd,
    },
    block: {
      start: blockStart,
      end: blockEnd,
    },
    clampedToServiceEnd,
  };
}

export function computeBookingWindowWithFallback(
  args: ComputeWindowArgs,
): BookingWindowWithFallback {
  const policy = args.policy ?? getVenuePolicy();
  try {
    const window = computeBookingWindow({ ...args, policy });
    return {
      window,
      usedFallback: false,
      fallbackService: null,
    };
  } catch (error) {
    if (error instanceof ServiceNotFoundError) {
      const serviceOrderCandidates = policy.serviceOrder.filter((key) =>
        Boolean(policy.services[key]),
      );
      const servicesFallback = (Object.keys(policy.services) as ServiceKey[]).filter((key) =>
        Boolean(policy.services[key]),
      );
      const fallbackService = resolveFallbackService(
        args,
        policy,
        serviceOrderCandidates,
        servicesFallback,
      );

      if (!fallbackService || !policy.services[fallbackService]) {
        throw error;
      }

      if (isAllocatorServiceFailHard()) {
        throw error;
      }

      const fallbackPolicy = allowFallbackServiceOverrun(policy, fallbackService);
      const fallbackWindow = computeBookingWindow({
        ...args,
        policy: fallbackPolicy,
        serviceHint: fallbackService,
      });

      console.warn('[capacity][window][fallback] service not found, using fallback service', {
        start: fallbackWindow.dining.start.toISO(),
        fallbackService,
        clamped: fallbackWindow.clampedToServiceEnd,
      });

      return {
        window: fallbackWindow,
        usedFallback: true,
        fallbackService,
      };
    }

    throw error;
  }
}

function normalizeServiceKey(value: string | null | undefined): ServiceKey | null {
  const normalized = value?.toString().trim().toLowerCase();
  return normalized === 'lunch' || normalized === 'dinner' ? normalized : null;
}

function resolveFallbackService(
  args: ComputeWindowArgs,
  policy: VenuePolicy,
  serviceOrderCandidates: ServiceKey[],
  servicesFallback: ServiceKey[],
): ServiceKey | undefined {
  const bookingOptionService = normalizeServiceKey(args.bookingOption);

  if (args.serviceHint && policy.services[args.serviceHint]) {
    return args.serviceHint;
  }

  if (bookingOptionService && policy.services[bookingOptionService]) {
    return bookingOptionService;
  }

  return serviceOrderCandidates[0] ?? servicesFallback[0];
}

function allowFallbackServiceOverrun(policy: VenuePolicy, serviceKey: ServiceKey): VenuePolicy {
  const service = policy.services[serviceKey];
  if (!service || service.allowOverrun) {
    return policy;
  }

  return {
    ...policy,
    services: {
      ...policy.services,
      [serviceKey]: {
        ...service,
        allowOverrun: true,
      },
    },
  };
}

function resolveStartDateTime(
  args: {
    startISO?: string | null;
    bookingDate?: string | null;
    startTime?: string | null;
  },
  policy: VenuePolicy,
): DateTime {
  if (args.startISO) {
    const parsed = DateTime.fromISO(args.startISO);
    if (!parsed.isValid) {
      throw new ManualSelectionInputError('Invalid start ISO timestamp provided', 'INVALID_START');
    }
    return parsed.setZone(policy.timezone, { keepLocalTime: false });
  }

  const { bookingDate, startTime } = args;
  if (!bookingDate || !startTime) {
    throw new ManualSelectionInputError(
      'Booking date and start time are required',
      'START_TIME_REQUIRED',
    );
  }

  const composed = DateTime.fromISO(`${bookingDate}T${startTime}`, { zone: policy.timezone });
  if (!composed.isValid) {
    throw new ManualSelectionInputError('Invalid booking date/time', 'INVALID_START');
  }
  return composed;
}

function resolveService(start: DateTime, hint: ServiceKey | null, policy: VenuePolicy): ServiceKey {
  if (hint) {
    return hint;
  }
  const found = whichService(start, policy);
  if (!found) {
    throw new ServiceNotFoundError(start);
  }
  return found;
}
