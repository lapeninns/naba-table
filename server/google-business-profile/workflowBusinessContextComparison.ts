import {
  isEqualValue,
  stableStringify,
  toJson,
} from '@/server/google-business-profile/workflowSerialization';

import type { Json } from '@/types/supabase';

type ProviderValueComparisonItem = {
  sectionKey: string;
  providerValue: unknown;
};

export function normalizeBusinessContextRowsForComparison<T>(sectionKey: string, rows: T[]): Json {
  const normalizedRows = rows
    .map((row) => normalizeBusinessContextRowForComparison(sectionKey, row))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));

  return toJson(normalizedRows);
}

export function normalizeBusinessContextRowForComparison(
  sectionKey: string,
  row: unknown,
): Record<string, unknown> | unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return row;
  }

  const omittedKeys = new Set(['id', 'source', 'managedBy', 'updatedAt']);
  if (sectionKey === 'businessContext.categories') {
    omittedKeys.add('isPrimary');
  }

  return Object.fromEntries(
    Object.entries(row as Record<string, unknown>).filter(
      ([key, value]) => !omittedKeys.has(key) && value !== undefined,
    ),
  );
}

export function normalizeProviderValueForStaleCheck(sectionKey: string, value: unknown): unknown {
  if (!sectionKey.startsWith('businessContext.') || !Array.isArray(value)) {
    return value;
  }

  return normalizeBusinessContextRowsForComparison(sectionKey, value);
}

export function providerValueChangedForStaleCheck(
  item: ProviderValueComparisonItem,
  refreshedItem: ProviderValueComparisonItem,
): boolean {
  return !isEqualValue(
    normalizeProviderValueForStaleCheck(item.sectionKey, item.providerValue),
    normalizeProviderValueForStaleCheck(refreshedItem.sectionKey, refreshedItem.providerValue),
  );
}
