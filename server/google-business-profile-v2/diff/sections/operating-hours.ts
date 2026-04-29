/**
 * Phase 2 of the GBP Dual-Sync V2 architecture.
 *
 * Operating hours diff adapter. Each weekday becomes one diff item. Both
 * directions are capability-supported for weekly hours; Google update mask
 * is `regularHours`.
 */

import { buildDiffItem, valuesEqual } from '../util';

import type {
  SyncV2OperatingHoursDay,
  SyncV2OperatingHoursSectionValue,
} from '../../snapshot/types';
import type { SyncV2DiffItem } from '../../types';

const DAY_LABELS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export function diffOperatingHours(
  nabatable: SyncV2OperatingHoursSectionValue,
  google: SyncV2OperatingHoursSectionValue,
): ReadonlyArray<SyncV2DiffItem<SyncV2OperatingHoursDay, SyncV2OperatingHoursDay>> {
  const items: Array<SyncV2DiffItem<SyncV2OperatingHoursDay, SyncV2OperatingHoursDay>> = [];
  for (let day = 0; day < 7; day += 1) {
    const nabDay = findDay(nabatable.weekly, day);
    const gDay = findDay(google.weekly, day);
    if (valuesEqual(nabDay, gDay)) continue;
    items.push(
      buildDiffItem<SyncV2OperatingHoursDay, SyncV2OperatingHoursDay>({
        sectionKey: 'operatingHours',
        fieldKey: DAY_LABELS[day],
        nabatable: nabDay,
        google: gDay,
        canImport: true,
        canExport: true,
        googleUpdateMask: 'regularHours',
        sortOrder: day,
      }),
    );
  }
  return items;
}

function findDay(
  weekly: ReadonlyArray<SyncV2OperatingHoursDay>,
  dayOfWeek: number,
): SyncV2OperatingHoursDay {
  return (
    weekly.find((d) => d.dayOfWeek === dayOfWeek) ?? {
      dayOfWeek,
      opensAt: null,
      closesAt: null,
      isClosed: true,
    }
  );
}
