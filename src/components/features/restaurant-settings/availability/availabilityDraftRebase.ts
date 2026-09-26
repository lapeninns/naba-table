/**
 * Rebasing an unsaved Availability draft onto a newer saved snapshot (another manager's save, or a
 * Google import of hours or meal times). A three-way merge of `base` (what the draft started from),
 * `mine` (the draft) and `theirs` (the newer snapshot):
 *
 * - a value staff did not touch takes the newer saved value;
 * - a value only staff changed keeps their edit;
 * - where both changed the same value differently, staff's edit is kept and the section is
 *   reported, so the page can say that saving will replace the other change.
 *
 * Weekday rows merge by `dayOfWeek`, special dates and meal rows by `id`; other lists (table-time
 * bands) are one value.
 */
import {
  AVAILABILITY_SAVE_GROUP_NAMES,
  type AvailabilityPageDraft,
  type AvailabilitySaveGroup,
} from './availabilityPageDraft';

type Path = readonly string[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

const same = (left: unknown, right: unknown) => stable(left) === stable(right);

type RowKey = 'dayOfWeek' | 'id';

function rowKeyOf(rows: readonly unknown[][]): RowKey | null {
  const all = rows.flat();
  if (all.length === 0 || !all.every(isRecord)) {
    return null;
  }
  const records = all as Record<string, unknown>[];
  if (records.every((row) => typeof row.dayOfWeek === 'number')) {
    return 'dayOfWeek';
  }
  if (records.every((row) => typeof row.id === 'string' && row.id.length > 0)) {
    return 'id';
  }
  return null;
}

function mergeRows(
  base: unknown[],
  mine: unknown[],
  theirs: unknown[],
  key: RowKey,
  path: Path,
  conflicts: Path[],
): unknown[] {
  const keyOf = (row: unknown) => String((row as Record<string, unknown>)[key]);
  const baseByKey = new Map(base.map((row) => [keyOf(row), row]));
  const theirsByKey = new Map(theirs.map((row) => [keyOf(row), row]));
  const mineKeys = new Set(mine.map(keyOf));
  const rows: unknown[] = [];

  for (const row of mine) {
    const rowKey = keyOf(row);
    const baseRow = baseByKey.get(rowKey);
    const theirRow = theirsByKey.get(rowKey);
    if (baseRow === undefined) {
      // Added by staff (or by both: staff's version wins and the section is reported).
      if (theirRow !== undefined && !same(row, theirRow)) {
        conflicts.push([...path, rowKey]);
      }
      rows.push(row);
      continue;
    }
    if (theirRow === undefined) {
      // Removed on the server. Untouched here: stays removed. Edited here: kept and reported.
      if (!same(row, baseRow)) {
        conflicts.push([...path, rowKey]);
        rows.push(row);
      }
      continue;
    }
    rows.push(mergeValue(baseRow, row, theirRow, [...path, rowKey], conflicts));
  }

  for (const theirRow of theirs) {
    const rowKey = keyOf(theirRow);
    if (mineKeys.has(rowKey)) {
      continue;
    }
    const baseRow = baseByKey.get(rowKey);
    if (baseRow === undefined) {
      // Added on the server.
      rows.push(theirRow);
    } else if (!same(baseRow, theirRow)) {
      // Removed by staff but changed on the server: the removal is kept and reported.
      conflicts.push([...path, rowKey]);
    }
  }
  return rows;
}

function mergeValue(
  base: unknown,
  mine: unknown,
  theirs: unknown,
  path: Path,
  conflicts: Path[],
): unknown {
  if (same(mine, base)) {
    return theirs;
  }
  if (same(theirs, base) || same(mine, theirs)) {
    return mine;
  }
  if (isRecord(base) && isRecord(mine) && isRecord(theirs)) {
    const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
    const merged: Record<string, unknown> = {};
    for (const key of keys) {
      merged[key] = mergeValue(base[key], mine[key], theirs[key], [...path, key], conflicts);
    }
    return merged;
  }
  if (Array.isArray(base) && Array.isArray(mine) && Array.isArray(theirs)) {
    const key = rowKeyOf([base, mine, theirs]);
    if (key) {
      return mergeRows(base, mine, theirs, key, path, conflicts);
    }
  }
  conflicts.push(path);
  return mine;
}

const DAY_HOURS_FIELDS = new Set(['opensAt', 'closesAt', 'isClosed', 'label']);

/** The page section (save group) a draft path belongs to. */
function groupOfPath(path: Path): AvailabilitySaveGroup {
  const [top, , field] = path;
  switch (top) {
    case 'weeklyRows':
    case 'overrideRows':
      return 'hours';
    case 'dayConfigs':
      return field && DAY_HOURS_FIELDS.has(field) ? 'hours' : 'meals';
    case 'customRows':
      return 'meals';
    case 'rules':
      return path[1] === 'reservationDefaultDurationMinutes' ? 'types' : 'rules';
    default:
      return 'types';
  }
}

export type AvailabilityRebaseResult = {
  draft: AvailabilityPageDraft;
  /** Sections where staff and the newer snapshot changed the same value; staff's edit was kept. */
  conflicts: AvailabilitySaveGroup[];
};

export function rebaseAvailabilityDraft({
  base,
  mine,
  theirs,
}: {
  base: AvailabilityPageDraft;
  mine: AvailabilityPageDraft;
  theirs: AvailabilityPageDraft;
}): AvailabilityRebaseResult {
  const conflictPaths: Path[] = [];
  const draft = mergeValue(base, mine, theirs, [], conflictPaths) as AvailabilityPageDraft;
  const groups = new Set(conflictPaths.map(groupOfPath));
  const order = Object.keys(AVAILABILITY_SAVE_GROUP_NAMES) as AvailabilitySaveGroup[];
  return { draft, conflicts: order.filter((group) => groups.has(group)) };
}
