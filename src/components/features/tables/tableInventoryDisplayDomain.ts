import type { TableInventory, TableInventorySummary } from '@/services/ops/tables';

export type TableInventorySummaryCardDescriptor = {
  key: string;
  label: string;
  value: string;
  description?: string;
};

export type TableInventoryMetricDescriptor = {
  key: 'bookable-tables' | 'zones' | 'inventory-total';
  label: string;
  value: string;
  description: string;
  variant: 'secondary' | 'outline' | 'metric';
};

export function isTableServiceReady(table: Pick<TableInventory, 'active' | 'zoneActive'>): boolean {
  return table.active && table.zoneActive !== false;
}

export function getTableInventoryEmptyMessage(totalTables: number): string {
  return totalTables === 0
    ? 'Add your first tables. Start with table number and capacity; advanced details can come later.'
    : 'No tables match this filter. Try showing all zones or tables.';
}

export function getTableInventoryDesktopEmptyMessage(totalTables: number): string {
  return totalTables === 0
    ? 'No table records yet. Add tables with number and capacity first; advanced details can come later.'
    : getTableInventoryEmptyMessage(totalTables);
}

export function formatTablePartySize(table: Pick<TableInventory, 'minPartySize' | 'maxPartySize'>) {
  return `${table.minPartySize}${table.maxPartySize ? `–${table.maxPartySize}` : '+'}`;
}

export function formatTableStatus(status: TableInventory['status']): string {
  return status.replaceAll('_', ' ');
}

export function formatTableSeatingType(seatingType: TableInventory['seatingType']): string {
  return seatingType.replaceAll('_', ' ');
}

export function getTableAvailabilityLabel(
  table: Pick<TableInventory, 'active' | 'zoneActive'>,
): 'Active' | 'Blocked by zone' | 'Inactive' {
  if (isTableServiceReady(table)) return 'Active';
  return table.active ? 'Blocked by zone' : 'Inactive';
}

export function buildTableInventoryCommandMetrics(
  summary: TableInventorySummary | null,
  tables: TableInventory[],
): TableInventoryMetricDescriptor[] {
  const bookableTables = tables.filter(isTableServiceReady);
  const bookableCovers = bookableTables.reduce((total, table) => total + table.capacity, 0);

  return [
    {
      key: 'bookable-tables',
      label: 'Bookable tables',
      value: summary ? `${bookableTables.length} tables` : 'Loading',
      description: summary ? `${bookableCovers} covers` : 'capacity',
      variant: 'secondary',
    },
    {
      key: 'zones',
      label: 'Zones',
      value: summary ? summary.zones.length.toLocaleString() : 'Loading',
      description: 'floor-plan groups',
      variant: 'outline',
    },
    {
      key: 'inventory-total',
      label: 'Inventory total',
      value: summary ? `${summary.totalTables.toLocaleString()} tables` : 'Loading',
      description: summary ? `${summary.totalCapacity.toLocaleString()} planned covers` : '',
      variant: 'metric',
    },
  ];
}

export function buildTableInventorySummaryCards(
  summary: TableInventorySummary,
  tables: TableInventory[],
): TableInventorySummaryCardDescriptor[] {
  const serviceReadyTables = tables.filter(isTableServiceReady).length;
  const serviceReadyCovers = tables
    .filter(isTableServiceReady)
    .reduce((total, table) => total + table.capacity, 0);
  const inactiveTables = Math.max(summary.totalTables - serviceReadyTables, 0);
  const inactiveZones = summary.zones.filter((zone) => zone.active === false).length;

  const cards: TableInventorySummaryCardDescriptor[] = [
    {
      key: 'ready-for-bookings',
      label: 'Ready for bookings',
      value: `${serviceReadyTables.toLocaleString()} active tables, ${serviceReadyCovers.toLocaleString()} covers`,
      description:
        serviceReadyTables > 0
          ? 'Active tables in active zones can be booked.'
          : 'Add an active table before guests can book seats.',
    },
    {
      key: 'inventory-total',
      label: 'Inventory total',
      value: `${summary.totalTables.toLocaleString()} tables`,
      description: `${summary.totalCapacity.toLocaleString()} planned covers across all table records`,
    },
    {
      key: 'inactive-tables',
      label: 'Needs attention',
      value: `${inactiveTables.toLocaleString()} tables`,
      description: inactiveTables > 0 ? `${inactiveTables.toLocaleString()} inactive` : undefined,
    },
    {
      key: 'zones-configured',
      label: 'Zones configured',
      value: summary.zones.length.toLocaleString(),
      description: inactiveZones > 0 ? `${inactiveZones} inactive` : undefined,
    },
  ];

  summary.serviceCapacities.forEach((service) => {
    const turns = service.turnsPerTable;
    cards.push({
      key: `service-${service.key}`,
      label: service.label,
      value: `${service.capacity.toLocaleString()} covers`,
      description:
        turns > 0
          ? `≈${turns} turns across ${service.tablesConsidered} tables`
          : 'Insufficient window for additional turns',
    });
  });

  return cards;
}
