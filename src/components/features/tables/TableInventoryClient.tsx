/**
 * Tables settings: one screen with the capacity summary, zones and the tables list.
 */

'use client';

import { Plus } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from '@/components/features/restaurant-settings/routes';
import {
  getSettingsSaveReasonCode,
  RestaurantSettingsCommandCenter,
  SETTINGS_COMPACT_ROUTE_STACK_CLASS,
} from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';

import { TableInventoryDialogs } from './TableInventoryDialogs';
import { TableInventoryMetrics } from './TableInventoryMetrics';
import { TABLE_TOUCH_TARGET_CLASS } from './TableInventoryParts';
import { TableInventorySection } from './TableInventorySection';
import { TableZonesSection } from './TableZonesSection';
import {
  TABLE_INVENTORY_ADD_BUTTON_ID,
  useTableInventoryController,
} from './useTableInventoryController';

const TABLES_ROUTE = RESTAURANT_SETTINGS_ROUTE_MAP.tables;

export default function TableInventoryClient() {
  const controller = useTableInventoryController();

  if (controller.memberships.length === 0) {
    return (
      <OpsEmptyState
        title="No restaurant access"
        description="Your account is not linked to any restaurants yet. Ask an owner or manager to invite you before managing tables."
      />
    );
  }

  if (!controller.activeRestaurantId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (controller.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Tables couldn’t be loaded</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>
            Saved settings are unchanged. Reason code{' '}
            <span className="font-mono">{getSettingsSaveReasonCode(controller.error)}</span>
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => controller.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const openZoneDialog = () => controller.openZoneDialog(null);

  return (
    <TooltipProvider>
      <RestaurantSettingsCommandCenter
        title={TABLES_ROUTE.title}
        description={TABLES_ROUTE.description}
        primaryAction={
          <Button
            id={TABLE_INVENTORY_ADD_BUTTON_ID}
            type="button"
            onClick={controller.openAddTable}
            aria-busy={controller.isLoading || undefined}
            className={TABLE_TOUCH_TARGET_CLASS}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Add table
          </Button>
        }
      >
        <div className={SETTINGS_COMPACT_ROUTE_STACK_CLASS}>
          <TableInventoryMetrics
            isLoading={controller.isLoading}
            overview={controller.overview}
            serviceCapacityLines={controller.serviceCapacityLines}
            hasSummary={controller.summary !== null}
          />

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
            <TableZonesSection
              isLoadingZones={controller.isLoadingZones}
              isZonesError={controller.isZonesError}
              onRetryZones={() => {
                void controller.refetchZones();
              }}
              zones={controller.zones}
              tables={controller.tables}
              selectedZoneId={controller.filters.zoneId}
              isZoneDeletePending={controller.isZoneDeletePending}
              onSelectZone={controller.toggleZoneFilter}
              onAddZone={openZoneDialog}
              onEditZone={(zone) => controller.openZoneDialog(zone)}
              onDeleteZone={controller.handleZoneDelete}
              onToggleZoneActive={controller.toggleZoneActive}
            />

            <TableInventorySection
              isLoading={controller.isLoading}
              isDeletePending={controller.isTableDeletePending}
              canDeleteTables={controller.canDeleteTables}
              filters={controller.filters}
              zoneOptions={controller.zoneOptions}
              zoneLookup={controller.zoneLookup}
              totalTables={controller.tables.length}
              shownTables={controller.filteredTables.length}
              groups={controller.tableGroups}
              onAddTable={controller.openAddTable}
              onClearFilters={controller.clearFilters}
              onEditTable={(table) => controller.openTableDialog(table)}
              onDeleteTable={controller.setTableDeleteTarget}
              onSearchChange={controller.setSearchQuery}
              onZoneFilterChange={controller.setZoneFilter}
              onBookableFilterChange={controller.setBookableFilter}
            />
          </div>

          <TableInventoryDialogs
            editingTable={controller.editingTable}
            editingZone={controller.editingZone}
            isDialogOpen={controller.isDialogOpen}
            isSavingTable={controller.isSavingTable}
            isSavingZone={controller.isSavingZone}
            isTableDeletePending={controller.isTableDeletePending}
            isZoneDeletePending={controller.isZoneDeletePending}
            isZoneDialogOpen={controller.isZoneDialogOpen}
            isZonesLoading={controller.isLoadingZones}
            nextZoneSortOrder={controller.zones.length}
            onConfirmTableDelete={controller.handleConfirmTableDelete}
            onConfirmZoneDelete={controller.handleConfirmZoneDelete}
            onShowZoneTables={controller.showZoneTables}
            onTableDeleteOpenChange={controller.handleTableDeleteOpenChange}
            onTableDialogOpenChange={controller.handleTableDialogOpenChange}
            onTableSubmit={controller.handleTableSubmit}
            onZoneDeleteOpenChange={controller.handleZoneDeleteOpenChange}
            onZoneDialogOpenChange={controller.handleZoneDialogOpenChange}
            onZoneSubmit={controller.handleZoneSubmit}
            onZoneWithTablesOpenChange={controller.handleZoneWithTablesOpenChange}
            preferredZoneId={controller.preferredZoneId}
            tableDeleteTarget={controller.tableDeleteTarget}
            tableDialogSession={controller.tableDialogSession}
            tableNumberConflict={controller.tableNumberConflict}
            zoneDeleteTarget={controller.zoneDeleteTarget}
            zoneDialogContinuesToTable={controller.zoneDialogContinuesToTable}
            zoneOptions={controller.zoneOptions}
            zoneWithTables={controller.zoneWithTables}
          />
        </div>
      </RestaurantSettingsCommandCenter>
    </TooltipProvider>
  );
}
