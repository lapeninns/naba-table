/**
 * Phase 2 of the GBP Dual-Sync V2 architecture. Service areas diff adapter.
 */

import { buildDiffItem, valuesEqual } from '../util';

import type { SyncV2ServiceAreaValue } from '../../snapshot/types';
import type { SyncV2DiffItem } from '../../types';

function serviceAreaKey(s: SyncV2ServiceAreaValue): string {
  return [s.areaType, s.regionCode ?? '', s.displayName.toLowerCase()].join('|');
}

export function diffBusinessContextServiceAreas(
  nabatable: ReadonlyArray<SyncV2ServiceAreaValue>,
  google: ReadonlyArray<SyncV2ServiceAreaValue>,
): ReadonlyArray<SyncV2DiffItem<SyncV2ServiceAreaValue | null, SyncV2ServiceAreaValue | null>> {
  const items: Array<SyncV2DiffItem<SyncV2ServiceAreaValue | null, SyncV2ServiceAreaValue | null>> =
    [];
  const keys = new Set<string>();
  for (const s of nabatable) keys.add(serviceAreaKey(s));
  for (const s of google) keys.add(serviceAreaKey(s));
  let sortOrder = 0;
  for (const key of [...keys].sort()) {
    const n = nabatable.find((s) => serviceAreaKey(s) === key) ?? null;
    const g = google.find((s) => serviceAreaKey(s) === key) ?? null;
    if (valuesEqual(n, g)) continue;
    const canExport =
      n === null ||
      Boolean(
        n.regionCode ||
        (n.placeData &&
          (n.areaType === 'place' ||
            n.areaType === 'places' ||
            Object.keys(n.placeData).length > 0)),
      );
    items.push(
      buildDiffItem<SyncV2ServiceAreaValue | null, SyncV2ServiceAreaValue | null>({
        sectionKey: 'businessContext.serviceAreas',
        fieldKey: key,
        nabatable: n,
        google: g,
        canImport: g !== null,
        canExport,
        googleUpdateMask: 'serviceArea',
        blockedReasons: canExport
          ? undefined
          : ['Service-area export requires a region code or Google place payload.'],
        sortOrder,
      }),
    );
    sortOrder += 1;
  }
  return items;
}
