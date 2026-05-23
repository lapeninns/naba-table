/**
 * Table Inventory Client Component
 * Story 4: Ops Dashboard - Tables Management
 *
 * REVISED: This component has been updated to address several potential issues,
 * including controlled form components, safer delete operations, and improved UI clarity.
 */

'use client';

import { SETTINGS_COMPACT_ROUTE_STACK_CLASS } from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { TableInventoryCommandCenter } from './TableInventoryCommandCenter';
import { TableInventoryDialogs } from './TableInventoryDialogs';
import { TableInventorySection } from './TableInventorySection';
import { TableInventorySummarySection } from './TableInventorySummarySection';
import { TableZonesSection } from './TableZonesSection';
import { useTableInventoryController } from './useTableInventoryController';

export default function TableInventoryClient() {
  const controller = useTableInventoryController();

  if (controller.memberships.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No restaurant access</AlertTitle>
        <AlertDescription>
          Your account is not linked to any restaurants yet. Ask an owner or manager to invite you
          before managing tables.
        </AlertDescription>
      </Alert>
    );
  }

  if (!controller.activeRestaurantId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (controller.isError) {
    const message =
      controller.error instanceof Error
        ? controller.error.message
        : 'Unable to load tables right now.';
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load tables</AlertTitle>
        <AlertDescription className="flex items-start justify-between gap-4">
          <span>{message}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => controller.refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <TableInventoryCommandCenter
      activeWorkspace={controller.activeWorkspace}
      summary={controller.summary}
      tables={controller.tables}
      onSelectWorkspace={controller.selectWorkspace}
    >
      <div className={SETTINGS_COMPACT_ROUTE_STACK_CLASS}>
        <TableInventorySummarySection
          isActive={controller.activeWorkspace === 'summary'}
          summaryCards={controller.summaryCards}
        />

        <TableZonesSection
          isActive={controller.activeWorkspace === 'zones'}
          zoneDeleteBlockedMessage={controller.zoneDeleteBlockedMessage}
          isLoadingZones={controller.isLoadingZones}
          isZonesError={controller.isZonesError}
          zonesError={controller.zonesError}
          zones={controller.zones}
          filteredZones={controller.filteredZones}
          selectedZoneId={controller.filterZone}
          zoneStatusFilter={controller.zoneStatusFilter}
          isZoneUpdatePending={controller.zoneUpdateMutation.isPending}
          isZoneDeletePending={controller.isZoneDeletePending}
          onZoneStatusFilterChange={controller.setZoneStatusFilter}
          onSelectZone={controller.setFilterZone}
          onAddZone={() => {
            controller.setEditingZone(null);
            controller.setIsZoneDialogOpen(true);
          }}
          onEditZone={(zone) => {
            controller.setEditingZone(zone);
            controller.setIsZoneDialogOpen(true);
          }}
          onDeleteZone={controller.handleZoneDelete}
          onToggleZoneActive={(zoneId, active) => {
            controller.zoneUpdateMutation.mutate({ zoneId, active });
          }}
        />

        <TableInventorySection
          isActive={controller.activeWorkspace === 'inventory'}
          isLoading={controller.isLoading}
          isFetching={controller.isFetching}
          isAddTableDisabled={controller.isZoneSelectDisabled && !controller.isLoadingZones}
          isDeletePending={controller.isTableDeletePending}
          canDeleteTables={controller.canDeleteTables}
          selectedZoneId={controller.filterZone}
          tableStatusFilter={controller.tableStatusFilter}
          zoneOptions={controller.zoneOptions}
          tables={controller.tables}
          filteredTables={controller.filteredTables}
          onAddTable={controller.openNewTableDialog}
          onEditTable={(table) => {
            controller.setEditingTable(table);
            controller.setIsDialogOpen(true);
          }}
          onDeleteTable={controller.setTableDeleteTarget}
          onZoneFilterChange={controller.setFilterZone}
          onTableStatusFilterChange={controller.setTableStatusFilter}
        />

        <TableInventoryDialogs
          editingTable={controller.editingTable}
          editingZone={controller.editingZone}
          isDialogOpen={controller.isDialogOpen}
          isFirstTable={!controller.editingTable && controller.tables.length === 0}
          isSavingTable={controller.isSavingTable}
          isSavingZone={controller.isSavingZone}
          isTableDeletePending={controller.isTableDeletePending}
          isZoneDeletePending={controller.isZoneDeletePending}
          isZoneDialogOpen={controller.isZoneDialogOpen}
          isZonesLoading={controller.isLoadingZones}
          onConfirmTableDelete={controller.handleConfirmTableDelete}
          onConfirmZoneDelete={controller.handleConfirmZoneDelete}
          onTableDeleteOpenChange={controller.handleTableDeleteOpenChange}
          onTableDialogOpenChange={controller.handleTableDialogOpenChange}
          onTableSubmit={controller.handleTableSubmit}
          onZoneDeleteOpenChange={controller.handleZoneDeleteOpenChange}
          onZoneDialogOpenChange={controller.handleZoneDialogOpenChange}
          onZoneSubmit={controller.handleZoneSubmit}
          tableDeleteTarget={controller.tableDeleteTarget}
          zoneDeleteTarget={controller.zoneDeleteTarget}
          zoneOptions={controller.zoneOptions}
        />
      </div>
    </TableInventoryCommandCenter>
  );
}
