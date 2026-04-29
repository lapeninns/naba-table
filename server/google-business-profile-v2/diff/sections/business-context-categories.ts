/**
 * Phase 2 of the GBP Dual-Sync V2 architecture.
 *
 * Categories diff adapter. Each diff item is keyed by `categoryCode` if
 * present, else by `displayName`. Export is supported when the final publish
 * plan can produce a valid primary/additional Google categories patch.
 */

import { buildDiffItem, valuesEqual } from '../util';

import type { SyncV2CategoryValue } from '../../snapshot/types';
import type { SyncV2DiffItem } from '../../types';

function categoryKey(c: SyncV2CategoryValue): string {
  return c.categoryCode ?? c.displayName.toLowerCase();
}

export function diffBusinessContextCategories(
  nabatable: ReadonlyArray<SyncV2CategoryValue>,
  google: ReadonlyArray<SyncV2CategoryValue>,
): ReadonlyArray<SyncV2DiffItem<SyncV2CategoryValue | null, SyncV2CategoryValue | null>> {
  const items: Array<SyncV2DiffItem<SyncV2CategoryValue | null, SyncV2CategoryValue | null>> = [];
  const keys = new Set<string>();
  for (const c of nabatable) keys.add(categoryKey(c));
  for (const c of google) keys.add(categoryKey(c));
  let sortOrder = 0;
  for (const key of [...keys].sort()) {
    const n = nabatable.find((c) => categoryKey(c) === key) ?? null;
    const g = google.find((c) => categoryKey(c) === key) ?? null;
    if (valuesEqual(n, g)) continue;
    const canExport = n === null || Boolean(n.categoryCode);
    items.push(
      buildDiffItem<SyncV2CategoryValue | null, SyncV2CategoryValue | null>({
        sectionKey: 'businessContext.categories',
        fieldKey: key,
        nabatable: n,
        google: g,
        canImport: g !== null,
        canExport,
        googleUpdateMask: 'categories',
        blockedReasons: canExport
          ? undefined
          : ['Category export requires a Google category code.'],
        sortOrder,
      }),
    );
    sortOrder += 1;
  }
  return items;
}
