/**
 * Phase 2 of the GBP Dual-Sync V2 architecture.
 *
 * Service periods diff adapter. Each diff item represents one service period
 * keyed by its stable key (day + start + end + booking option + name). Items
 * present on only one side are still emitted with `null` for the missing
 * side so operators can ignore/import/export per item.
 */

import { buildDiffItem, valuesEqual } from '../util';

import type { SyncV2ServicePeriod, SyncV2ServicePeriodsSectionValue } from '../../snapshot/types';
import type { SyncV2DiffItem } from '../../types';

export function diffServicePeriods(
  nabatable: SyncV2ServicePeriodsSectionValue,
  google: SyncV2ServicePeriodsSectionValue,
): ReadonlyArray<SyncV2DiffItem<SyncV2ServicePeriod | null, SyncV2ServicePeriod | null>> {
  const items: Array<SyncV2DiffItem<SyncV2ServicePeriod | null, SyncV2ServicePeriod | null>> = [];
  const keys = new Set<string>();
  for (const p of nabatable.periods) keys.add(p.stableKey);
  for (const p of google.periods) keys.add(p.stableKey);

  let sortOrder = 0;
  for (const key of [...keys].sort()) {
    const nab = nabatable.periods.find((p) => p.stableKey === key) ?? null;
    const gle = google.periods.find((p) => p.stableKey === key) ?? null;
    if (valuesEqual(nab, gle)) continue;
    items.push(
      buildDiffItem<SyncV2ServicePeriod | null, SyncV2ServicePeriod | null>({
        sectionKey: 'servicePeriods',
        fieldKey: key,
        nabatable: nab,
        google: gle,
        canImport: gle !== null,
        canExport: true,
        googleUpdateMask: 'moreHours',
        sortOrder,
      }),
    );
    sortOrder += 1;
  }
  return items;
}
