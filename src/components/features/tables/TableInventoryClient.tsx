/**
 * Tables settings: the room zone by zone, with a side panel for the room overview or the
 * selected table. Below 1100px the capacity summary sits above the room and tables open in a sheet.
 */

'use client';

import { Check, Plus, Search, X } from 'lucide-react';
import { useMemo } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from '@/components/features/restaurant-settings/routes';
import {
  getSettingsSaveReasonCode,
  RestaurantSettingsCommandCenter,
  SETTINGS_COMPACT_ROUTE_STACK_CLASS,
  SettingsDialog,
} from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  SegmentedButtons,
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

const SHOW_OPTIONS: ReadonlyArray<{ value: RoomShowFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'bookable', label: 'Bookable' },
  { value: 'not-bookable', label: 'Not bookable' },
];
const VIEW_OPTIONS: ReadonlyArray<{ value: TableRoomView; label: string }> = [
  { value: 'room', label: 'Room' },
  { value: 'list', label: 'List' },
];

function RoomKey() {
  return (
    <div
      aria-label="Key"
      data-testid="room-key"
      className="-mt-0.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground"
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
      <span className="ml-auto hidden [@media(pointer:fine)_and_(min-width:1100px)]:inline-flex">
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

  if (c.memberships.length === 0) {
    return (
      <OpsEmptyState
        title="No restaurant access"
        description="Your account is not linked to any restaurants yet. Ask an owner or manager to invite you before managing tables."
      />
    );
  }

  if (!c.activeRestaurantId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (c.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Tables couldn’t be loaded</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>
            Saved settings are unchanged. Reason code{' '}
            <span className="font-mono">{getSettingsSaveReasonCode(c.error)}</span>
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => c.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

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
      className="min-h-0 overflow-y-auto px-5 py-4"
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
    c.tables.length > 0 ? (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]"
      >
        <span className="inline-flex min-h-[26px] items-center rounded-md border border-border px-2.5 py-0.5 font-medium">
          {c.seatStats.bookableSeats} of {c.seatStats.totalSeats} seats bookable
        </span>
        {c.notBookableCount > 0 ? (
          <Button
            variant="ghost"
            type="button"
            onClick={c.showIssues}
            className={LINK_BUTTON_CLASS}
          >
            {c.notBookableCount === 1
              ? '1 table needs a look'
              : `${c.notBookableCount} tables need a look`}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Check className="size-4" aria-hidden /> Every table can be booked
          </span>
        )}
      </div>
    ) : null;

  const isLoading = c.isLoading || c.isLoadingZones;

  return (
    <TooltipProvider>
      <RestaurantSettingsCommandCenter
        title={TABLES_ROUTE.title}
        description={TABLES_ROUTE.description}
        status={headStatus}
        primaryAction={
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
        }
      >
        <div className={SETTINGS_COMPACT_ROUTE_STACK_CLASS}>
          {isLoading ? null : (
            <TableCapacityCard
              stats={c.seatStats}
              blockedReasons={blockedReasons}
              coverage={c.coverage}
              serviceCapacityLines={c.serviceCapacityLines}
              hasSummary={c.summary !== null}
            />
          )}

          <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid min-w-0 gap-3">
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
                <SegmentedButtons
                  label="Show"
                  idPrefix="show"
                  value={c.filters.show}
                  options={SHOW_OPTIONS}
                  onChange={c.setShow}
                />
                <SegmentedButtons
                  label="View"
                  idPrefix="view"
                  value={c.view}
                  options={VIEW_OPTIONS}
                  onChange={c.setView}
                />
              </div>
              <RoomKey />

              <div aria-live="polite" data-testid="room">
                {isLoading ? (
                  <div className="grid gap-2.5" aria-busy="true">
                    <Skeleton className="h-40 w-full rounded-md" />
                    <Skeleton className="h-40 w-full rounded-md" />
                    <span className="sr-only">Loading tables</span>
                  </div>
                ) : c.isZonesError ? (
                  <Alert role="alert">
                    <AlertTitle>Zones couldn’t be loaded</AlertTitle>
                    <AlertDescription className="flex flex-col items-start gap-2">
                      <span>
                        Reason code{' '}
                        <span className="font-mono">{getSettingsSaveReasonCode(c.zonesError)}</span>
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void c.refetchZones()}
                      >
                        Try again
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : c.zones.length === 0 ? (
                  <div className="rounded-md border border-border bg-background">
                    <div className="grid justify-items-center gap-2 px-4 py-6 text-center">
                      <b>Start with a zone</b>
                      <p className="max-w-[44ch] text-muted-foreground">
                        Zones are areas of your room, such as Main dining room, Bar or Terrace.
                        Every table belongs to one.
                      </p>
                      <Button type="button" onClick={() => c.openZoneDialog(null)}>
                        <Plus aria-hidden /> Add your first zone
                      </Button>
                    </div>
                  </div>
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

            <div className="hidden min-[1100px]:block min-[1100px]:sticky min-[1100px]:top-4">
              <aside
                aria-label="Table details"
                data-testid="table-inspector"
                className="flex max-h-[calc(100dvh-7rem)] flex-col rounded-md border border-border bg-background"
              >
                {c.isWide && editor ? (
                  <>
                    <div className="flex items-start justify-between gap-2 border-b border-border pb-3 pl-5 pr-4 pt-4">
                      <div>
                        <h2 id="inspector-title" className="text-base font-semibold">
                          {editorTitle}
                        </h2>
                        <p className="text-xs text-muted-foreground">{editorHint}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Close details"
                        onClick={editorState.close}
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                    {editorForm}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
                      {editorFooter}
                    </div>
                  </>
                ) : (
                  <TableRoomOverview
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
      </RestaurantSettingsCommandCenter>
    </TooltipProvider>
  );
}
