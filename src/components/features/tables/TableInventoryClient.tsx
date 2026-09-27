/**
 * Tables settings: the room zone by zone, with a side panel for the room overview or the
 * selected table. Below the side-panel breakpoint (`TABLE_INSPECTOR_QUERY`, `xl`) the capacity
 * summary sits above the room and tables open in a sheet.
 */

'use client';

import { Check, Plus, Search, X } from 'lucide-react';
import { useMemo } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from '@/components/features/restaurant-settings/routes';
import {
  RestaurantSettingsCommandCenter,
  SETTINGS_ASIDE_GRID_CLASS,
  SETTINGS_COMPACT_ROUTE_STACK_CLASS,
  SettingsCard,
  SettingsDialog,
  SettingsLoadErrorAlert,
  SettingsNoRestaurantState,
  SettingsRefreshErrorAlert,
  SettingsSectionStates,
  SettingsSegmentedControl,
  SettingsStatusFacts,
  type SettingsSegmentedOption,
} from '@/components/features/restaurant-settings/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';

import { TableCapacityCard } from './TableCapacitySummary';
import { TableEditorFooter, TableEditorForm } from './TableEditorForm';
import { TableInventoryConfirmDialogs } from './TableInventoryConfirmDialogs';
import { getTableBookingStatus } from './tableInventoryDisplayDomain';
import { getShortBlockLabel, hasRoomFilters, type RoomShowFilter } from './tableRoomDomain';
import { TableRoomList } from './TableRoomList';
import { TableRoomOverview } from './TableRoomOverview';
import {
  LINK_BUTTON_CLASS,
  LockIcon,
  MiniTile,
  SeatDots,
  TABLE_TOUCH_TARGET_CLASS,
} from './TableRoomParts';
import { TableRoomZones } from './TableRoomZones';
import { TableZoneDialog } from './TableZoneDialog';
import {
  TABLE_INVENTORY_ADD_BUTTON_ID,
  useTableInventoryController,
  zoneDomId,
  type TableRoomView,
} from './useTableInventoryController';

const TABLES_ROUTE = RESTAURANT_SETTINGS_ROUTE_MAP.tables;

/**
 * The sticky aside of `SETTINGS_ASIDE_CLASS`, hidden below `xl` (the table inspector's breakpoint,
 * `TABLE_INSPECTOR_QUERY`) so the inline editor and the sheet switch at the same width.
 */
const TABLES_ASIDE_CLASS = 'hidden min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:flex';
/** The side panel fits the viewport and scrolls inside its card. */
const TABLES_ASIDE_CARD_CLASS = 'flex max-h-[calc(100dvh-7rem)] flex-col';

const SHOW_OPTIONS: ReadonlyArray<SettingsSegmentedOption<RoomShowFilter>> = [
  { value: 'all', label: 'All' },
  { value: 'bookable', label: 'Bookable' },
  { value: 'not-bookable', label: 'Not bookable' },
];
const VIEW_OPTIONS: ReadonlyArray<SettingsSegmentedOption<TableRoomView>> = [
  { value: 'room', label: 'Room' },
  { value: 'list', label: 'List' },
];

function RoomKey() {
  return (
    <div
      aria-label="Key"
      data-testid="room-key"
      className="-mt-0.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground"
    >
      <span className="inline-flex items-center gap-1.5">
        <MiniTile variant="ok" />
        Bookable
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MiniTile variant="no" />
        Not bookable
      </span>
      <span className="inline-flex items-center gap-1.5">
        <SeatDots dots={[true, true, false]} className="max-w-none" />
        Filled dot = a party size it takes
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LockIcon /> Fixed: never joined
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MiniTile variant="join" />
        Can join the selected table
      </span>
      <span className="ml-auto hidden [@media(pointer:fine)_and_(min-width:80rem)]:inline-flex">
        Arrow keys move between tables
      </span>
    </div>
  );
}

export default function TableInventoryClient() {
  const c = useTableInventoryController();
  const { editor, editorState } = c;

  const zoneStats = useMemo(() => {
    const stats = new Map<string, { bookableSeats: number; totalSeats: number }>();
    for (const table of c.tables) {
      const entry = stats.get(table.zoneId) ?? { bookableSeats: 0, totalSeats: 0 };
      entry.totalSeats += table.capacity;
      if (getTableBookingStatus(table, c.zoneLookup).bookable)
        entry.bookableSeats += table.capacity;
      stats.set(table.zoneId, entry);
    }
    return stats;
  }, [c.tables, c.zoneLookup]);

  const blockedReasons = useMemo(() => {
    const reasons: Record<string, number> = {};
    for (const table of c.tables) {
      const status = getTableBookingStatus(table, c.zoneLookup);
      if (status.bookable) continue;
      const label = getShortBlockLabel(status.reason);
      reasons[label] = (reasons[label] ?? 0) + 1;
    }
    return reasons;
  }, [c.tables, c.zoneLookup]);

  const goToZone = (zoneId: string) => {
    const section = document.getElementById(zoneDomId(zoneId));
    if (!section) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    section.querySelector<HTMLElement>('[data-tile], button')?.focus({ preventScroll: true });
  };

  const hasFilters = hasRoomFilters(c.filters);
  const savedTable = editor?.table
    ? (c.tables.find((table) => table.id === editor.table?.id) ?? editor.table)
    : null;
  const editorTitle = editor
    ? editor.table
      ? `Table ${editor.table.tableNumber}`
      : `New table in ${c.zones.find((zone) => zone.id === editor.draft.zoneId)?.name ?? ''}`
    : '';
  const editorHint = editor?.table
    ? 'Changes save when you select Save table.'
    : 'Saves when you select Add table.';

  const editorForm = editor ? (
    <TableEditorForm
      key={editor.session}
      editor={editor}
      savedTable={savedTable}
      tables={c.tables}
      zones={c.zoneOptions}
      lookup={c.zoneLookup}
      onChange={editorState.updateDraft}
      onSubmit={c.saveTable}
    />
  ) : null;
  const editorFooter = editor ? (
    <TableEditorFooter
      isNew={editor.table === null}
      canDelete={c.canDeleteTables}
      isSaving={c.isSavingTable}
      onDelete={c.requestDeleteTable}
      onClose={editorState.close}
    />
  ) : null;

  const headStatus =
    c.tables.length > 0 && !c.isError ? (
      <SettingsStatusFacts
        live
        badge={{
          label: `${c.seatStats.bookableSeats} of ${c.seatStats.totalSeats} seats bookable`,
          variant: c.notBookableCount > 0 ? 'status-pending' : 'status-confirmed',
        }}
      >
        {c.notBookableCount > 0 ? (
          <Button
            variant="ghost"
            type="button"
            onClick={c.showIssues}
            className={`${LINK_BUTTON_CLASS} text-xs`}
          >
            {c.notBookableCount === 1
              ? '1 table needs a look'
              : `${c.notBookableCount} tables need a look`}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Check className="size-3.5" aria-hidden /> Every table can be booked
          </span>
        )}
      </SettingsStatusFacts>
    ) : null;

  const isLoading = c.isLoading || c.isLoadingZones;

  return (
    <TooltipProvider>
      <RestaurantSettingsCommandCenter
        title={TABLES_ROUTE.title}
        description={TABLES_ROUTE.description}
        status={headStatus}
        primaryAction={
          c.activeRestaurantId && !c.isError ? (
            <Button
              id={TABLE_INVENTORY_ADD_BUTTON_ID}
              type="button"
              onClick={() => c.openAddTable()}
              aria-busy={isLoading || undefined}
              className={TABLE_TOUCH_TARGET_CLASS}
            >
              <Plus data-icon="inline-start" aria-hidden />
              Add table
            </Button>
          ) : undefined
        }
      >
        <SettingsSectionStates
          restaurantId={c.activeRestaurantId}
          // The room keeps its toolbar while loading and shows its own skeleton below it.
          isLoading={false}
          // Only a failure with nothing loaded blocks the page (see useTableInventoryDataState).
          error={c.error}
          noRestaurant={<SettingsNoRestaurantState task="manage its tables" />}
          loading={null}
          errorState={(loadError) => (
            <SettingsLoadErrorAlert
              title="Couldn’t load tables"
              error={loadError}
              retrying={c.isFetching}
              onRetry={() => void c.refetch()}
            />
          )}
        >
          {() => (
            <div className={SETTINGS_COMPACT_ROUTE_STACK_CLASS}>
              {c.refreshError ? (
                <SettingsRefreshErrorAlert
                  error={c.refreshError}
                  onRetry={() => void c.refetch()}
                />
              ) : null}
              {isLoading ? null : (
                <TableCapacityCard
                  stats={c.seatStats}
                  blockedReasons={blockedReasons}
                  coverage={c.coverage}
                  serviceCapacityLines={c.serviceCapacityLines}
                  hasSummary={c.summary !== null}
                />
              )}

              <div className={SETTINGS_ASIDE_GRID_CLASS}>
                <div className="grid min-w-0 grid-cols-1 gap-3">
                  <div className="flex flex-wrap items-center gap-2" data-testid="tables-toolbar">
                    <Label className="relative min-w-0 flex-[1_1_220px]">
                      <span className="sr-only">Find a table</span>
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        id="tables-search"
                        type="search"
                        value={c.filters.query}
                        onChange={(event) => c.setQuery(event.target.value)}
                        placeholder="Find a table or note"
                        className={`pl-8 ${TABLE_TOUCH_TARGET_CLASS}`}
                      />
                    </Label>
                    {/* The two controls wrap onto their own rows rather than hiding options (RR2). */}
                    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                      <SettingsSegmentedControl
                        ariaLabel="Show"
                        value={c.filters.show}
                        options={SHOW_OPTIONS}
                        onValueChange={c.setShow}
                      />
                      <SettingsSegmentedControl
                        ariaLabel="View"
                        value={c.view}
                        options={VIEW_OPTIONS}
                        onValueChange={c.setView}
                      />
                    </div>
                  </div>
                  <RoomKey />

                  <div aria-live="polite" data-testid="room">
                    {isLoading ? (
                      <div className="grid gap-3" aria-busy="true">
                        <Skeleton className="h-40 w-full rounded-xl" />
                        <Skeleton className="h-40 w-full rounded-xl" />
                        <span className="sr-only">Loading tables</span>
                      </div>
                    ) : c.isZonesError ? (
                      <SettingsLoadErrorAlert
                        title="Couldn’t load zones"
                        error={c.zonesError}
                        onRetry={() => void c.refetchZones()}
                      />
                    ) : c.zones.length === 0 ? (
                      <OpsEmptyState
                        title="Start with a zone"
                        description="Zones are areas of your room, such as Main dining room, Bar or Terrace. Every table belongs to one."
                        className="min-h-0 py-6"
                        action={
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => c.openZoneDialog(null)}
                          >
                            <Plus data-icon="inline-start" aria-hidden />
                            Add your first zone
                          </Button>
                        }
                      />
                    ) : c.view === 'list' ? (
                      <TableRoomList
                        zones={c.zones}
                        tables={c.tables}
                        lookup={c.zoneLookup}
                        filters={c.filters}
                        selectedTableId={c.selectedTableId}
                        onSelectTable={c.selectTable}
                        onClearFilters={c.clearFilters}
                      />
                    ) : (
                      <TableRoomZones
                        zones={c.zones}
                        tables={c.tables}
                        lookup={c.zoneLookup}
                        filters={c.filters}
                        selectedTableId={c.selectedTableId}
                        joinPartnerIds={c.joinPartnerIds}
                        onSelectTable={c.selectTable}
                        onAddTable={(zoneId) => c.openAddTable(zoneId)}
                        onAddZone={() => c.openZoneDialog(null)}
                        onEditZone={(zone) => c.openZoneDialog(zone)}
                        onDeleteZone={c.handleZoneDelete}
                        onToggleZone={c.toggleZoneActive}
                        onClearFilters={c.clearFilters}
                        hasFilters={hasFilters}
                      />
                    )}
                  </div>
                </div>

                <aside
                  aria-label="Table details"
                  data-testid="table-inspector"
                  className={TABLES_ASIDE_CLASS}
                >
                  {c.isWide && editor ? (
                    <SettingsCard
                      titleId="inspector-title"
                      title={editorTitle}
                      description={editorHint}
                      className={TABLES_ASIDE_CARD_CLASS}
                      contentClassName="min-h-0 flex-1 overflow-y-auto"
                      headerAction={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Close details"
                          onClick={editorState.close}
                          className="-my-1 -mr-1.5 min-h-0 min-w-0 [@media(pointer:coarse)]:size-11"
                        >
                          <X aria-hidden />
                        </Button>
                      }
                      footer={
                        <div className="flex w-full flex-wrap items-center justify-between gap-2">
                          {editorFooter}
                        </div>
                      }
                    >
                      {editorForm}
                    </SettingsCard>
                  ) : (
                    <TableRoomOverview
                      className={TABLES_ASIDE_CARD_CLASS}
                      tables={c.tables}
                      zones={c.zones}
                      stats={c.seatStats}
                      zoneStats={zoneStats}
                      needsLook={c.needsLook}
                      coverage={c.coverage}
                      serviceCapacityLines={c.serviceCapacityLines}
                      hasSummary={c.summary !== null}
                      onSelectTable={c.selectTable}
                      onGoToZone={goToZone}
                      onFix={c.fixNeedsLook}
                    />
                  )}
                </aside>
              </div>

              <SettingsDialog
                open={Boolean(editor) && !c.isWide}
                onOpenChange={(open) => {
                  if (!open) editorState.close();
                }}
                title={editorTitle}
                description={editorHint}
                size="md"
                testId="table-editor-sheet"
                footer={
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    {editorFooter}
                  </div>
                }
              >
                {editor && !c.isWide ? (
                  <TableEditorForm
                    key={editor.session}
                    editor={editor}
                    savedTable={savedTable}
                    tables={c.tables}
                    zones={c.zoneOptions}
                    lookup={c.zoneLookup}
                    onChange={editorState.updateDraft}
                    onSubmit={c.saveTable}
                  />
                ) : null}
              </SettingsDialog>

              <TableZoneDialog
                key={c.zoneDialogSession}
                open={c.isZoneDialogOpen}
                editingZone={c.editingZone}
                zones={c.zones}
                isSaving={c.isSavingZone}
                continuesToTable={c.zoneDialogContinuesToTable}
                onOpenChange={c.handleZoneDialogOpenChange}
                onSubmit={c.handleZoneSubmit}
              />

              <TableInventoryConfirmDialogs
                tableDeleteTarget={c.tableDeleteTarget}
                zoneDeleteTarget={c.zoneDeleteTarget}
                zoneWithTables={c.zoneWithTables}
                isTableDeletePending={c.isTableDeletePending}
                isZoneDeletePending={c.isZoneDeletePending}
                onTableOpenChange={c.handleTableDeleteOpenChange}
                onZoneOpenChange={c.handleZoneDeleteOpenChange}
                onZoneWithTablesOpenChange={c.handleZoneWithTablesOpenChange}
                onConfirmTableDelete={c.handleConfirmTableDelete}
                onConfirmZoneDelete={c.handleConfirmZoneDelete}
                onTakeZoneOutOfService={(zone) => c.toggleZoneActive(zone, false)}
              />

              <ConfirmDialog
                open={editorState.pendingDiscard !== null}
                onOpenChange={(open) => {
                  if (!open) editorState.setPendingDiscard(null);
                }}
                title={editorState.pendingDiscard?.title ?? 'Discard changes?'}
                description={editorState.pendingDiscard?.description}
                confirmLabel="Discard changes"
                tone="destructive"
                onConfirm={() => {
                  const pending = editorState.pendingDiscard;
                  editorState.setPendingDiscard(null);
                  pending?.run();
                }}
              />
            </div>
          )}
        </SettingsSectionStates>
      </RestaurantSettingsCommandCenter>
    </TooltipProvider>
  );
}
