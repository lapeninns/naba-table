'use client';

import { useEffect, useMemo } from 'react';

import {
  buildBusinessContextFamilyPayload,
  EMPTY_BUSINESS_DETAILS,
  type BusinessContextFamilyPayloadState,
  type FamilyKey,
} from '../../businessContextModel';
import { useOptionalGbpDrift } from '../../gbp-drift/useGbpDrift';
import { slugifyDualSyncDisplay } from '../../gbpDriftDomain';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type DriftFields = ReadonlyArray<DualSyncFieldSummary>;
type DraftOverrideEntries = ReadonlyArray<readonly [string, unknown]>;

type DiscoveryGbpDraftOverridesOptions = {
  editor: BusinessContextFamilyPayloadState;
  gbpDriftFieldsByFamily: Readonly<Record<FamilyKey, DriftFields>>;
};

const NO_ENTRIES: DraftOverrideEntries = [];

/** Each family payload only reads its own slice, so the rest of the state can stay empty. */
const EMPTY_PAYLOAD_STATE: BusinessContextFamilyPayloadState = {
  businessDetails: EMPTY_BUSINESS_DETAILS,
  links: [],
  categories: [],
  serviceAreas: [],
  attributes: [],
  serviceItems: [],
};

function suffixAfter(fieldKey: string, prefix: string) {
  return fieldKey.startsWith(prefix) ? fieldKey.slice(prefix.length) : null;
}

function collectEntries(
  fields: DriftFields,
  prefix: string,
  buildPayload: () => ReturnType<typeof buildBusinessContextFamilyPayload>,
  findRow: (
    payload: ReturnType<typeof buildBusinessContextFamilyPayload>,
    suffix: string,
  ) => unknown,
): DraftOverrideEntries {
  // Families without drift fields never build a payload.
  if (fields.length === 0) return NO_ENTRIES;
  try {
    const payload = buildPayload();
    const entries: Array<readonly [string, unknown]> = [];
    for (const field of fields) {
      const suffix = suffixAfter(field.fieldKey, prefix);
      if (!suffix) continue;
      entries.push([field.fieldKey, findRow(payload, suffix)]);
    }
    return entries;
  } catch {
    // Invalid in-progress editor payloads should not break the settings route.
    return NO_ENTRIES;
  }
}

export function useDiscoveryGbpDraftOverrides({
  editor,
  gbpDriftFieldsByFamily,
}: DiscoveryGbpDraftOverridesOptions) {
  const registryDrift = useOptionalGbpDrift();
  const registerDriftDraftOverride = registryDrift?.registerDraftOverride;
  const {
    categories: categoryFields,
    serviceAreas: serviceAreaFields,
    attributes: attributeFields,
    serviceItems: serviceItemFields,
  } = gbpDriftFieldsByFamily;
  const { categories, serviceAreas, attributes, serviceItems } = editor;

  // One memo per family, keyed on that family's slice, so edits elsewhere keep the entries stable.
  const categoryEntries = useMemo(
    () =>
      collectEntries(
        categoryFields,
        'businessContext.categories.',
        () =>
          buildBusinessContextFamilyPayload('categories', { ...EMPTY_PAYLOAD_STATE, categories }),
        (payload, slug) =>
          payload.categories?.find((row) => slugifyDualSyncDisplay(row.displayName) === slug),
      ),
    [categories, categoryFields],
  );
  const serviceAreaEntries = useMemo(
    () =>
      collectEntries(
        serviceAreaFields,
        'businessContext.serviceAreas.',
        () =>
          buildBusinessContextFamilyPayload('serviceAreas', {
            ...EMPTY_PAYLOAD_STATE,
            serviceAreas,
          }),
        (payload, slug) =>
          payload.serviceAreas?.find((row) => slugifyDualSyncDisplay(row.displayName) === slug),
      ),
    [serviceAreaFields, serviceAreas],
  );
  const attributeEntries = useMemo(
    () =>
      collectEntries(
        attributeFields,
        'businessContext.attributes.',
        () =>
          buildBusinessContextFamilyPayload('attributes', { ...EMPTY_PAYLOAD_STATE, attributes }),
        (payload, attributeKey) =>
          payload.attributes?.find((row) => row.attributeKey === attributeKey),
      ),
    [attributeFields, attributes],
  );
  const serviceItemEntries = useMemo(
    () =>
      collectEntries(
        serviceItemFields,
        'businessContext.serviceItems.',
        () =>
          buildBusinessContextFamilyPayload('serviceItems', {
            ...EMPTY_PAYLOAD_STATE,
            serviceItems,
          }),
        (payload, itemKey) => payload.serviceItems?.find((row) => row.itemKey === itemKey),
      ),
    [serviceItemFields, serviceItems],
  );

  useEffect(() => {
    if (!registerDriftDraftOverride) return;
    for (const entries of [
      categoryEntries,
      serviceAreaEntries,
      attributeEntries,
      serviceItemEntries,
    ]) {
      for (const [fieldKey, value] of entries) {
        registerDriftDraftOverride(fieldKey, value);
      }
    }
  }, [
    attributeEntries,
    categoryEntries,
    registerDriftDraftOverride,
    serviceAreaEntries,
    serviceItemEntries,
  ]);
}
