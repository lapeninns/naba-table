import { formatGoogleBusinessProfileLabel } from '@/lib/restaurants/google-business-profile-format';

import type {
  RestaurantGoogleBusinessProfileChangeFamily,
  RestaurantGoogleBusinessProfileChangeHighlight,
  RestaurantGoogleBusinessProfileChangeSummary,
  RestaurantGoogleBusinessProfileMetricSummary,
  RestaurantGoogleBusinessProfileNormalized,
} from '@/lib/restaurants/google-business-profile';

const MAX_CHANGE_HIGHLIGHTS = 10;

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeList(values: string[] | null | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function appendValueChange(
  changes: RestaurantGoogleBusinessProfileChangeHighlight[],
  input: {
    key: string;
    label: string;
    family: RestaurantGoogleBusinessProfileChangeFamily;
    before: string | null;
    after: string | null;
  },
) {
  if (input.before === input.after) {
    return;
  }

  const kind =
    input.before && input.after ? 'updated' : input.after ? 'added' : 'removed';

  changes.push({
    key: input.key,
    label: input.label,
    family: input.family,
    kind,
    before: input.before,
    after: input.after,
  });
}

function joinList(values: string[] | null | undefined) {
  const normalized = normalizeList(values);
  return normalized.length > 0 ? normalized.join(' | ') : null;
}

function compareMetricSummaries(
  before: RestaurantGoogleBusinessProfileMetricSummary[],
  after: RestaurantGoogleBusinessProfileMetricSummary[],
  changes: RestaurantGoogleBusinessProfileChangeHighlight[],
) {
  const beforeMap = new Map(before.map((metric) => [metric.metric, metric]));
  const afterMap = new Map(after.map((metric) => [metric.metric, metric]));
  const metricKeys = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort();

  for (const metricKey of metricKeys) {
    const previous = beforeMap.get(metricKey) ?? null;
    const next = afterMap.get(metricKey) ?? null;

    appendValueChange(changes, {
      key: `metric:${metricKey}`,
      label: formatGoogleBusinessProfileLabel(metricKey) ?? metricKey,
      family: 'performance',
      before: previous ? `${previous.total} (${previous.startDate} to ${previous.endDate})` : null,
      after: next ? `${next.total} (${next.startDate} to ${next.endDate})` : null,
    });
  }
}

export function summarizeGoogleBusinessProfileChanges(
  before: RestaurantGoogleBusinessProfileNormalized | null,
  after: RestaurantGoogleBusinessProfileNormalized,
  generatedAt = new Date().toISOString(),
): RestaurantGoogleBusinessProfileChangeSummary {
  if (!before) {
    return {
      generatedAt,
      hasBaseline: false,
      totalChanges: 0,
      remainingChanges: 0,
      highlights: [],
    };
  }

  const changes: RestaurantGoogleBusinessProfileChangeHighlight[] = [];

  appendValueChange(changes, {
    key: 'title',
    label: 'Title',
    family: 'location',
    before: normalizeText(before.title),
    after: normalizeText(after.title),
  });
  appendValueChange(changes, {
    key: 'description',
    label: 'Description',
    family: 'location',
    before: normalizeText(before.description),
    after: normalizeText(after.description),
  });
  appendValueChange(changes, {
    key: 'primaryCategory',
    label: 'Primary category',
    family: 'location',
    before: normalizeText(before.primaryCategory),
    after: normalizeText(after.primaryCategory),
  });
  appendValueChange(changes, {
    key: 'additionalCategories',
    label: 'Additional categories',
    family: 'location',
    before: joinList(before.additionalCategories),
    after: joinList(after.additionalCategories),
  });
  appendValueChange(changes, {
    key: 'addressText',
    label: 'Address',
    family: 'location',
    before: normalizeText(before.addressText),
    after: normalizeText(after.addressText),
  });
  appendValueChange(changes, {
    key: 'openStatus',
    label: 'Open status',
    family: 'location',
    before: normalizeText(before.openStatus),
    after: normalizeText(after.openStatus),
  });
  appendValueChange(changes, {
    key: 'primaryPhone',
    label: 'Primary phone',
    family: 'location',
    before: normalizeText(before.primaryPhone),
    after: normalizeText(after.primaryPhone),
  });
  appendValueChange(changes, {
    key: 'websiteUri',
    label: 'Website',
    family: 'location',
    before: normalizeText(before.websiteUri),
    after: normalizeText(after.websiteUri),
  });
  appendValueChange(changes, {
    key: 'mapsUri',
    label: 'Maps link',
    family: 'location',
    before: normalizeText(before.mapsUri),
    after: normalizeText(after.mapsUri),
  });
  appendValueChange(changes, {
    key: 'reviewUri',
    label: 'Review link',
    family: 'location',
    before: normalizeText(before.reviewUri),
    after: normalizeText(after.reviewUri),
  });
  appendValueChange(changes, {
    key: 'regularHoursSummary',
    label: 'Regular hours',
    family: 'hours',
    before: joinList(before.regularHoursSummary),
    after: joinList(after.regularHoursSummary),
  });
  appendValueChange(changes, {
    key: 'moreHoursSummary',
    label: 'Additional hours',
    family: 'hours',
    before: joinList(before.moreHoursSummary),
    after: joinList(after.moreHoursSummary),
  });
  appendValueChange(changes, {
    key: 'specialHoursSummary',
    label: 'Special hours',
    family: 'hours',
    before: joinList(before.specialHoursSummary),
    after: joinList(after.specialHoursSummary),
  });
  appendValueChange(changes, {
    key: 'attributeLabels',
    label: 'Attributes',
    family: 'attributes',
    before: joinList(before.attributeLabels),
    after: joinList(after.attributeLabels),
  });
  appendValueChange(changes, {
    key: 'serviceItems',
    label: 'Service items',
    family: 'attributes',
    before: joinList(before.serviceItems),
    after: joinList(after.serviceItems),
  });
  appendValueChange(changes, {
    key: 'rating',
    label: 'Average rating',
    family: 'reviews',
    before: before.rating === null ? null : before.rating.toFixed(1),
    after: after.rating === null ? null : after.rating.toFixed(1),
  });
  appendValueChange(changes, {
    key: 'reviewCount',
    label: 'Review count',
    family: 'reviews',
    before: before.reviewCount === null ? null : String(before.reviewCount),
    after: after.reviewCount === null ? null : String(after.reviewCount),
  });
  appendValueChange(changes, {
    key: 'reviewSnippets',
    label: 'Imported review snippets',
    family: 'reviews',
    before: String(before.reviewSnippets.length),
    after: String(after.reviewSnippets.length),
  });
  appendValueChange(changes, {
    key: 'media',
    label: 'Imported media items',
    family: 'media',
    before: String(before.media.length),
    after: String(after.media.length),
  });

  compareMetricSummaries(before.metrics30d, after.metrics30d, changes);

  return {
    generatedAt,
    hasBaseline: true,
    totalChanges: changes.length,
    remainingChanges: Math.max(0, changes.length - MAX_CHANGE_HIGHLIGHTS),
    highlights: changes.slice(0, MAX_CHANGE_HIGHLIGHTS),
  };
}
