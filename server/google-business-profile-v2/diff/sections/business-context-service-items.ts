/**
 * Phase 2 of the GBP Dual-Sync V2 architecture. Service items diff adapter.
 */

import { buildDiffItem, valuesEqual } from '../util';

import type { SyncV2ServiceItemValue } from '../../snapshot/types';
import type { SyncV2DiffItem } from '../../types';

export function diffBusinessContextServiceItems(
  nabatable: ReadonlyArray<SyncV2ServiceItemValue>,
  google: ReadonlyArray<SyncV2ServiceItemValue>,
): ReadonlyArray<SyncV2DiffItem<SyncV2ServiceItemValue | null, SyncV2ServiceItemValue | null>> {
  const items: Array<SyncV2DiffItem<SyncV2ServiceItemValue | null, SyncV2ServiceItemValue | null>> =
    [];
  const keys = new Set<string>();
  for (const s of nabatable) keys.add(s.itemKey);
  for (const s of google) keys.add(s.itemKey);
  let sortOrder = 0;
  for (const key of [...keys].sort()) {
    const n = nabatable.find((s) => s.itemKey === key) ?? null;
    const g = google.find((s) => s.itemKey === key) ?? null;
    if (valuesEqual(n, g)) continue;
    const canExport = n === null || Boolean(n.payload && Object.keys(n.payload).length > 0);
    items.push(
      buildDiffItem<SyncV2ServiceItemValue | null, SyncV2ServiceItemValue | null>({
        sectionKey: 'businessContext.serviceItems',
        fieldKey: key,
        nabatable: n,
        google: g,
        canImport: g !== null,
        canExport,
        googleUpdateMask: 'serviceItems',
        blockedReasons: canExport
          ? undefined
          : ['Service-item export requires the canonical Google serviceItems payload.'],
        sortOrder,
      }),
    );
    sortOrder += 1;
  }
  return items;
}
