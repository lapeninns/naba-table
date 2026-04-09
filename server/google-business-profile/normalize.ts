import { randomUUID } from 'node:crypto';

import {
  type RestaurantSummary,
} from '@/lib/restaurants/types';

import type {
  GoogleBusinessProfileAccount,
  GoogleBusinessProfileAttributesResponse,
  GoogleBusinessProfileLocation,
  GoogleBusinessProfileMediaResponse,
  GoogleBusinessProfilePerformanceResponse,
  GoogleBusinessProfileReviewsResponse,
} from './client';
import type {
  RestaurantGoogleBusinessProfileLocationOption,
  RestaurantGoogleBusinessProfileMetricSummary,
  RestaurantGoogleBusinessProfileNormalized,
  RestaurantGoogleBusinessProfileReviewSnippet,
} from '@/lib/restaurants/google-business-profile';

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildAddressText(location: GoogleBusinessProfileLocation): string | null {
  const address = location.storefrontAddress;
  if (!address) {
    return null;
  }

  return [
    ...(address.addressLines ?? []),
    address.locality,
    address.administrativeArea,
    address.postalCode,
    address.regionCode,
  ]
    .map((part) => normalizeText(part))
    .filter((part): part is string => Boolean(part))
    .join(', ') || null;
}

function normalizeForMatch(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function calculateLocationMatchScore(restaurant: RestaurantSummary, location: GoogleBusinessProfileLocation): number {
  let score = 0;
  const restaurantName = normalizeForMatch(restaurant.name);
  const title = normalizeForMatch(location.title);
  if (restaurantName && title && (restaurantName.includes(title) || title.includes(restaurantName))) {
    score += 5;
  }

  const restaurantPhone = normalizeForMatch(restaurant.contactPhone ?? null);
  const locationPhone = normalizeForMatch(location.phoneNumbers?.primaryPhone);
  if (restaurantPhone && locationPhone && restaurantPhone.endsWith(locationPhone.slice(-8))) {
    score += 3;
  }

  const restaurantAddress = normalizeForMatch(restaurant.address ?? null);
  const locationAddress = normalizeForMatch(buildAddressText(location));
  if (restaurantAddress && locationAddress && restaurantAddress.includes(locationAddress.slice(0, 12))) {
    score += 4;
  }

  return score;
}

function extractLocationId(locationName: string): string {
  return locationName.replace(/^locations\//, '');
}

export function buildGoogleBusinessProfileLocationOptions(input: {
  restaurant: RestaurantSummary;
  account: GoogleBusinessProfileAccount;
  locations: GoogleBusinessProfileLocation[];
}): RestaurantGoogleBusinessProfileLocationOption[] {
  return input.locations
    .map((location) => ({
      accountId: input.account.name.replace(/^accounts\//, ''),
      accountName: input.account.accountName ?? input.account.name,
      locationId: extractLocationId(location.name),
      locationName: location.name,
      title: location.title ?? 'Untitled location',
      addressText: buildAddressText(location),
      primaryPhone: normalizeText(location.phoneNumbers?.primaryPhone),
      websiteUri: normalizeText(location.websiteUri),
      mapsUri: normalizeText(location.metadata?.mapsUri),
      reviewUri: normalizeText(location.metadata?.newReviewUri),
      matchScore: calculateLocationMatchScore(input.restaurant, location),
    }))
    .sort((left, right) => right.matchScore - left.matchScore || left.title.localeCompare(right.title));
}

function summarizeHours(periods: Array<Record<string, unknown>> | undefined): string[] {
  if (!Array.isArray(periods) || periods.length === 0) {
    return [];
  }

  return periods
    .slice(0, 7)
    .map((period) => {
      const openDay = normalizeText(String((period.openDay as string | undefined) ?? '')) ?? 'OPEN';
      const openTime = normalizeText(String((period.openTime as string | undefined) ?? '')) ?? '';
      const closeDay = normalizeText(String((period.closeDay as string | undefined) ?? '')) ?? openDay;
      const closeTime = normalizeText(String((period.closeTime as string | undefined) ?? '')) ?? '';
      return `${openDay} ${openTime} - ${closeDay} ${closeTime}`.trim();
    })
    .filter(Boolean);
}

function formatStructuredLabel(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return normalized
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function summarizeMoreHours(
  moreHours: GoogleBusinessProfileLocation['moreHours'] | undefined,
): string[] {
  if (!Array.isArray(moreHours) || moreHours.length === 0) {
    return [];
  }

  return moreHours
    .flatMap((entry) => {
      const label = formatStructuredLabel(entry.hoursTypeId) ?? 'Additional hours';
      const periods = summarizeHours(entry.periods);
      if (periods.length === 0) {
        return [];
      }

      return periods.map((period) => `${label}: ${period}`);
    })
    .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);
}

function extractServiceItems(location: GoogleBusinessProfileLocation): string[] {
  if (!Array.isArray(location.serviceItems) || location.serviceItems.length === 0) {
    return [];
  }

  const getCandidateValues = (value: unknown): string[] => {
    if (!value || typeof value !== 'object') {
      return [];
    }

    const record = value as Record<string, unknown>;
    const direct = [
      normalizeText(record.displayName as string | undefined),
      normalizeText(record.serviceTypeId as string | undefined),
      normalizeText(record.category as string | undefined),
      normalizeText(record.label as string | undefined),
      normalizeText(record.description as string | undefined),
    ].filter((item): item is string => Boolean(item));

    const nested = Object.values(record).flatMap((nestedValue) => getCandidateValues(nestedValue));
    return [...direct, ...nested];
  };

  return location.serviceItems
    .flatMap((entry) => getCandidateValues(entry))
    .map((item) => formatStructuredLabel(item) ?? item)
    .filter((item, index, all) => Boolean(item) && all.indexOf(item) === index)
    .slice(0, 12);
}

function extractAttributeLabels(attributes: GoogleBusinessProfileAttributesResponse | null): string[] {
  if (!attributes?.attributes?.length) {
    return [];
  }

  return attributes.attributes
    .flatMap((attribute) => {
      const baseLabel = normalizeText(attribute.displayName ?? attribute.name ?? attribute.attributeId);
      const values = Array.isArray(attribute.values) ? attribute.values : [];
      if (values.length === 0) {
        return baseLabel ? [baseLabel] : [];
      }

      const labels = values.flatMap((value) => {
        const direct =
          normalizeText(value.displayName) ??
          normalizeText(value.enumValue?.displayName) ??
          (value.boolValue === true ? 'Yes' : null);
        const repeated = value.repeatedEnumValue?.setValues?.map((item) => normalizeText(item.displayName)).filter((item): item is string => Boolean(item)) ?? [];
        return [direct, ...repeated].filter((item): item is string => Boolean(item));
      });

      if (!baseLabel) {
        return labels;
      }

      return labels.length > 0 ? labels.map((value) => `${baseLabel}: ${value}`) : [baseLabel];
    })
    .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);
}

function normalizeReviewSnippets(reviews: GoogleBusinessProfileReviewsResponse | null): RestaurantGoogleBusinessProfileReviewSnippet[] {
  return (reviews?.reviews ?? [])
    .slice(0, 8)
    .map((review) => ({
      reviewId: review.reviewId ?? randomUUID(),
      starRating: normalizeText(review.starRating),
      comment: normalizeText(review.comment),
      reviewerDisplayName: normalizeText(review.reviewer?.displayName),
      createTime: normalizeText(review.createTime),
      updateTime: normalizeText(review.updateTime),
    }));
}

function normalizeMetrics(performance: GoogleBusinessProfilePerformanceResponse | null): RestaurantGoogleBusinessProfileMetricSummary[] {
  const metricSeries = performance?.multiDailyMetricTimeSeries?.flatMap((series) => series.dailyMetricTimeSeries ?? []) ?? [];

  return metricSeries
    .map<RestaurantGoogleBusinessProfileMetricSummary | null>((entry) => {
      const metric = normalizeText(entry.dailyMetric);
      const datedValues = entry.timeSeries?.datedValues ?? [];
      if (!metric || datedValues.length === 0) {
        return null;
      }

      const total = datedValues.reduce((sum, point) => sum + Number(point.value ?? 0), 0);
      const first = datedValues[0]?.date;
      const last = datedValues[datedValues.length - 1]?.date;
      const formatDate = (date?: { year?: number; month?: number; day?: number }) =>
        date?.year && date?.month && date?.day
          ? `${date.year.toString().padStart(4, '0')}-${date.month.toString().padStart(2, '0')}-${date.day
              .toString()
              .padStart(2, '0')}`
          : '';

      return {
        metric,
        total,
        startDate: formatDate(first),
        endDate: formatDate(last),
      };
    })
    .filter((item): item is RestaurantGoogleBusinessProfileMetricSummary => Boolean(item));
}

export function normalizeGoogleBusinessProfileSnapshot(input: {
  location: GoogleBusinessProfileLocation;
  attributes: GoogleBusinessProfileAttributesResponse | null;
  reviews: GoogleBusinessProfileReviewsResponse | null;
  media: GoogleBusinessProfileMediaResponse | null;
  performance: GoogleBusinessProfilePerformanceResponse | null;
}): RestaurantGoogleBusinessProfileNormalized {
  const address = input.location.storefrontAddress;

  return {
    title: input.location.title ?? 'Untitled location',
    description: normalizeText(input.location.profile?.description),
    primaryCategory: normalizeText(input.location.primaryCategory?.displayName),
    additionalCategories: (input.location.additionalCategories ?? [])
      .map((category) => normalizeText(category.displayName))
      .filter((value): value is string => Boolean(value)),
    addressText: buildAddressText(input.location),
    locality: normalizeText(address?.locality),
    regionCode: normalizeText(address?.regionCode),
    postalCode: normalizeText(address?.postalCode),
    placeId: normalizeText(input.location.metadata?.placeId),
    openStatus: normalizeText((input.location as { openInfo?: { status?: string } }).openInfo?.status),
    primaryPhone: normalizeText(input.location.phoneNumbers?.primaryPhone),
    additionalPhones: (input.location.phoneNumbers?.additionalPhones ?? [])
      .map((phone) => normalizeText(phone))
      .filter((phone): phone is string => Boolean(phone)),
    websiteUri: normalizeText(input.location.websiteUri),
    mapsUri: normalizeText(input.location.metadata?.mapsUri),
    reviewUri: normalizeText(input.location.metadata?.newReviewUri),
    regularHoursSummary: summarizeHours(input.location.regularHours?.periods),
    moreHoursSummary: summarizeMoreHours(input.location.moreHours),
    specialHoursSummary: summarizeHours(input.location.specialHours?.specialHourPeriods as Array<Record<string, unknown>> | undefined),
    attributeLabels: extractAttributeLabels(input.attributes),
    serviceItems: extractServiceItems(input.location),
    rating: typeof input.reviews?.averageRating === 'number' ? input.reviews.averageRating : null,
    reviewCount: typeof input.reviews?.totalReviewCount === 'number' ? input.reviews.totalReviewCount : null,
    reviewSnippets: normalizeReviewSnippets(input.reviews),
    media: (input.media?.mediaItems ?? []).slice(0, 12).map((item) => ({
      name: item.name ?? randomUUID(),
      category: normalizeText(item.locationAssociation?.category),
      format: normalizeText(item.mediaFormat),
      sourceUrl: normalizeText(item.sourceUrl),
      googleUrl: normalizeText(item.googleUrl),
      thumbnailUrl: normalizeText(item.thumbnailUrl),
      description: normalizeText(item.description),
    })),
    metrics30d: normalizeMetrics(input.performance),
  };
}
