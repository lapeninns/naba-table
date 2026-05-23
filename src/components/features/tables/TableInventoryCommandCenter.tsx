import { ClipboardList, LayoutGrid, Table2 } from 'lucide-react';
import { type ReactNode } from 'react';

import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared';

import { buildTableInventoryCommandMetrics } from './tableInventoryDisplayDomain';

import type { TableWorkspace } from './tableInventoryModel';
import type { TableInventory, TableInventorySummary } from '@/services/ops/tables';

type TableInventoryCommandCenterProps = {
  activeWorkspace: TableWorkspace;
  children: ReactNode;
  summary: TableInventorySummary | null;
  tables: TableInventory[];
  onSelectWorkspace: (workspace: TableWorkspace) => void;
};

const metricIcons = {
  'bookable-tables': Table2,
  zones: LayoutGrid,
  'inventory-total': ClipboardList,
} as const;

export function TableInventoryCommandCenter({
  activeWorkspace,
  children,
  summary,
  tables,
  onSelectWorkspace,
}: TableInventoryCommandCenterProps) {
  return (
    <RestaurantSettingsCommandCenter
      eyebrow="Tables command center"
      title="Tables"
      description="Manage seating zones, table inventory, capacity, party-size rules, and service readiness from one route."
      metrics={buildTableInventoryCommandMetrics(summary, tables).map((metric) => ({
        ...metric,
        Icon: metricIcons[metric.key],
      }))}
      railTitle="Tables workflow"
      railDescription="Set up zones first, then add or edit the tables guests can book."
      railItems={[
        {
          label: 'Capacity summary',
          description: 'Readiness, total inventory, inactive tables, and service capacities.',
          href: '#table-capacity-summary',
          Icon: ClipboardList,
          isActive: activeWorkspace === 'summary',
          onSelect: () => onSelectWorkspace('summary'),
        },
        {
          label: 'Zones',
          description: 'Floor-plan groups, seasonal toggles, and zone sorting.',
          href: '#table-zones',
          Icon: LayoutGrid,
          isActive: activeWorkspace === 'zones',
          onSelect: () => onSelectWorkspace('zones'),
        },
        {
          label: 'Inventory',
          description: 'Table numbers, covers, party sizes, seating type, and availability.',
          href: '#table-inventory',
          Icon: Table2,
          isActive: activeWorkspace === 'inventory',
          onSelect: () => onSelectWorkspace('inventory'),
        },
      ]}
      footer="Only active tables in active zones count as service-ready capacity."
    >
      {children}
    </RestaurantSettingsCommandCenter>
  );
}
