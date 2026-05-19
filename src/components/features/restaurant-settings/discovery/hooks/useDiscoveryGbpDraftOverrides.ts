'use client';

import { useEffect, useMemo } from 'react';

import { buildBusinessContextFamilyPayload, type FamilyKey } from '../../businessContextModel';
import { useOptionalGbpDrift } from '../../gbp-drift/useGbpDrift';
import { slugifyDualSyncDisplay } from '../../gbpDriftBadges';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type DiscoveryGbpDraftOverridesOptions = {
  editor: RestaurantBusinessContextEditor;
  gbpDriftFieldsByFamily: Readonly<Record<FamilyKey, ReadonlyArray<DualSyncFieldSummary>>>;
};

function suffixAfter(fieldKey: string, prefix: string) {
  return fieldKey.startsWith(prefix) ? fieldKey.slice(prefix.length) : null;
}

export function useDiscoveryGbpDraftOverrides({
  editor,
  gbpDriftFieldsByFamily,
}: DiscoveryGbpDraftOverridesOptions) {
  const registryDrift = useOptionalGbpDrift();
  const registerDriftDraftOverride = registryDrift?.registerDraftOverride;
  const discoveryDraftOverrides = useMemo(() => {
    const entries: Array<readonly [string, unknown]> = [];
    const payloadState = {
      businessDetails: editor.businessDetails,
      links: editor.links,
      categories: editor.categories,
      serviceAreas: editor.serviceAreas,
      attributes: editor.attributes,
      serviceItems: editor.serviceItems,
    };

    try {
      const payload = buildBusinessContextFamilyPayload('categories', payloadState);
      for (const field of gbpDriftFieldsByFamily.categories) {
        const slug = suffixAfter(field.fieldKey, 'businessContext.categories.');
        if (!slug) continue;
        entries.push([
          field.fieldKey,
          payload.categories?.find((row) => slugifyDualSyncDisplay(row.displayName) === slug),
        ]);
      }
    } catch {
      // Invalid in-progress editor payloads should not break the settings route.
    }

    try {
      const payload = buildBusinessContextFamilyPayload('serviceAreas', payloadState);
      for (const field of gbpDriftFieldsByFamily.serviceAreas) {
        const slug = suffixAfter(field.fieldKey, 'businessContext.serviceAreas.');
        if (!slug) continue;
        entries.push([
          field.fieldKey,
          payload.serviceAreas?.find((row) => slugifyDualSyncDisplay(row.displayName) === slug),
        ]);
      }
    } catch {
      // Invalid in-progress editor payloads should not break the settings route.
    }

    try {
      const payload = buildBusinessContextFamilyPayload('attributes', payloadState);
      for (const field of gbpDriftFieldsByFamily.attributes) {
        const attributeKey = suffixAfter(field.fieldKey, 'businessContext.attributes.');
        if (!attributeKey) continue;
        entries.push([
          field.fieldKey,
          payload.attributes?.find((row) => row.attributeKey === attributeKey),
        ]);
      }
    } catch {
      // Invalid in-progress editor payloads should not break the settings route.
    }

    try {
      const payload = buildBusinessContextFamilyPayload('serviceItems', payloadState);
      for (const field of gbpDriftFieldsByFamily.serviceItems) {
        const itemKey = suffixAfter(field.fieldKey, 'businessContext.serviceItems.');
        if (!itemKey) continue;
        entries.push([
          field.fieldKey,
          payload.serviceItems?.find((row) => row.itemKey === itemKey),
        ]);
      }
    } catch {
      // Invalid in-progress editor payloads should not break the settings route.
    }

    return entries;
  }, [
    editor.attributes,
    editor.businessDetails,
    editor.categories,
    editor.links,
    editor.serviceAreas,
    editor.serviceItems,
    gbpDriftFieldsByFamily.attributes,
    gbpDriftFieldsByFamily.categories,
    gbpDriftFieldsByFamily.serviceAreas,
    gbpDriftFieldsByFamily.serviceItems,
  ]);

  useEffect(() => {
    if (!registerDriftDraftOverride) return;
    for (const [fieldKey, value] of discoveryDraftOverrides) {
      registerDriftDraftOverride(fieldKey, value);
    }
  }, [discoveryDraftOverrides, registerDriftDraftOverride]);
}
