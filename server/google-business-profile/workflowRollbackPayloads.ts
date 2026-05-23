import type {
  RestaurantBusinessContextSnapshot,
  UpdateRestaurantBusinessContextInput,
} from '@/server/restaurants/businessContext';
import type { RestaurantDetails, UpdateRestaurantDetailsInput } from '@/server/restaurants/details';
import type {
  OperatingHoursSnapshot,
  UpdateOperatingHoursPayload,
} from '@/server/restaurants/operatingHours';
import type { ServicePeriod, UpdateServicePeriod } from '@/server/restaurants/servicePeriods';

export type PublishRollbackResult = {
  status: 'restored' | 'failed';
  errors: string[];
};

function describeRollbackError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.details === 'string' && record.details.trim()) {
      return record.details;
    }
  }

  return fallback;
}

export function restoreProfilePayload(profile: RestaurantDetails): UpdateRestaurantDetailsInput {
  return {
    name: profile.name,
    slug: profile.slug,
    timezone: profile.timezone,
    capacity: profile.capacity,
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    address: profile.address,
    managerDailySummaryEnabled: profile.managerDailySummaryEnabled,
    managerNotificationPhone: profile.managerNotificationPhone,
    googleMapUrl: profile.googleMapUrl,
    googleReviewUrl: profile.googleReviewUrl,
    bookingPolicy: profile.bookingPolicy,
    logoUrl: profile.logoUrl,
  };
}

export function restoreOperatingHoursPayload(
  operatingHours: OperatingHoursSnapshot,
): UpdateOperatingHoursPayload {
  return {
    weekly: operatingHours.weekly.map((entry) => ({ ...entry })),
    overrides: operatingHours.overrides.map((entry) => ({ ...entry })),
  };
}

export function restoreServicePeriodsPayload(
  servicePeriods: ServicePeriod[],
): UpdateServicePeriod[] {
  return servicePeriods.map((period) => ({
    id: period.id,
    name: period.name,
    dayOfWeek: period.dayOfWeek,
    startTime: period.startTime,
    endTime: period.endTime,
    bookingOption: period.bookingOption,
  }));
}

export function restoreBusinessContextPayload(
  businessContext: RestaurantBusinessContextSnapshot,
  sections: Set<string>,
): UpdateRestaurantBusinessContextInput {
  return {
    ...(sections.has('businessContext.categories')
      ? { categories: businessContext.core.categories }
      : {}),
    ...(sections.has('businessContext.serviceAreas')
      ? { serviceAreas: businessContext.core.serviceAreas }
      : {}),
    ...(sections.has('businessContext.attributes')
      ? { attributes: businessContext.core.attributes }
      : {}),
    ...(sections.has('businessContext.serviceItems')
      ? { serviceItems: businessContext.core.serviceItems }
      : {}),
  };
}

export function buildFailedPublishErrors(input: {
  publishError: unknown;
  rollback: PublishRollbackResult;
}) {
  return [
    {
      message: describeRollbackError(input.publishError, 'Unable to publish selected draft items.'),
      rollback: input.rollback,
    },
  ];
}
