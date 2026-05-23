import { ManualSelectionInputError } from './types';

import type { ManualSelectionSummary, Table } from './types';

export function assertManualTableIds(tableIds: string[]): void {
  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    throw new ManualSelectionInputError('At least one table must be selected', 'TABLES_REQUIRED');
  }
}

export function assertManualTablesLoaded({
  loadedCount,
  message,
  requestedCount,
}: {
  loadedCount: number;
  message: string;
  requestedCount: number;
}): void {
  if (loadedCount !== requestedCount) {
    throw new ManualSelectionInputError(message, 'TABLE_LOOKUP_FAILED');
  }
}

export function assertBookingZoneAllowsManualSelection({
  assignedZoneId,
  summary,
}: {
  assignedZoneId?: string | null;
  summary: ManualSelectionSummary;
}): void {
  if (assignedZoneId && summary.zoneId && assignedZoneId !== summary.zoneId) {
    throw new ManualSelectionInputError(
      `Booking is locked to zone ${assignedZoneId}; selected zone ${summary.zoneId} is not allowed`,
      'ZONE_LOCKED',
      409,
    );
  }
}

export function assertManualSelectionTablesAvailable(tables: Table[]): void {
  const unavailableTables = tables.filter((table) => {
    const outOfService =
      typeof table.status === 'string' && table.status.toLowerCase() === 'out_of_service';
    return table.active === false || table.zoneActive === false || outOfService;
  });

  if (unavailableTables.length > 0) {
    const names = unavailableTables.map((table) => table.tableNumber || table.id).join(', ');
    throw new ManualSelectionInputError(
      `Selected tables are inactive or in a disabled zone: ${names}`,
      'RESOURCE_DISABLED',
      409,
    );
  }
}

export function resolveManualSelectionZoneId({
  summary,
  tables,
}: {
  summary: ManualSelectionSummary;
  tables: Table[];
}): string {
  const zoneId = summary.zoneId ?? tables[0]?.zoneId ?? '';
  if (!zoneId) {
    throw new ManualSelectionInputError(
      'Unable to determine zone for selected tables',
      'ZONE_REQUIRED',
    );
  }
  return zoneId;
}
