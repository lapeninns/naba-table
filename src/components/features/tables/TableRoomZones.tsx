'use client';

import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { SettingsCard } from '@/components/features/restaurant-settings/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import {
  countLabel,
  getTableBookingStatus,
  type TableZoneLookup,
} from './tableInventoryDisplayDomain';
import {
  BIG_TABLE_SEATS,
  buildSeatDots,
  describeTileNote,
  getShortBlockLabel,
  getZoneJoinSummary,
  isAddTileAlone,
  isMovableTable,
  matchesRoomFilters,
  type RoomFilters,
} from './tableRoomDomain';
import {
  BARE_BUTTON_CLASS,
  CapacityBar,
  HATCH_TILE_CLASS,
  JOIN_OUTLINE_CLASS,
  JoinIcon,
  LINK_BUTTON_CLASS,
  LockIcon,
  SeatDots,
} from './TableRoomParts';
import { tileDomId, zoneDomId } from './useTableInventoryController';

import type { TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

const TILE_GAP = 8;

/** Columns the tiles grid lays out, so the add tile knows whether it would sit alone. */
function useTileColumns() {
  const ref = useRef<HTMLUListElement>(null);
  const [columns, setColumns] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const style = window.getComputedStyle(element);
      const inner =
        element.clientWidth -
        Number.parseFloat(style.paddingLeft || '0') -
        Number.parseFloat(style.paddingRight || '0');
      const min = window.matchMedia('(min-width: 640px)').matches ? 112 : 96;
      setColumns(Math.max(1, Math.floor((inner + TILE_GAP) / (min + TILE_GAP))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, columns };
}

/** Arrow keys move between the tiles of one zone. */
function handleTileKeys(event: KeyboardEvent<HTMLUListElement>, columns: number) {
  const tile = (event.target as HTMLElement).closest<HTMLElement>('[data-tile]');
  const step = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: Math.max(1, columns),
    ArrowUp: -Math.max(1, columns),
  }[event.key];
  if (!tile || step === undefined) return;
  const list = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-tile]'));
  const index = list.indexOf(tile);
  const next = list[Math.max(0, Math.min(list.length - 1, index + step))];
  if (next && next !== tile) {
    event.preventDefault();
    next.focus();
  }
}

function TableTile({
  table,
  zones,
  selected,
  joinPartner,
  matches,
  onSelect,
}: {
  table: TableInventory;
  zones: TableZoneLookup;
  selected: boolean;
  joinPartner: boolean;
  matches: boolean;
  onSelect: (table: TableInventory) => void;
}) {
  const status = getTableBookingStatus(table, zones);
  const movable = isMovableTable(table);
  const { dots, overflow } = buildSeatDots(table);
  const largest = table.maxPartySize ?? table.capacity;
  const party = `${table.minPartySize || 1}–${largest}`;
  const note = status.bookable ? describeTileNote(table, { joinable: joinPartner }) : null;

  return (
    <li className={cn(table.capacity >= BIG_TABLE_SEATS && 'col-span-2')}>
      <Button
        variant="ghost"
        type="button"
        id={tileDomId(table.id)}
        data-tile={table.id}
        aria-pressed={selected}
        onClick={() => onSelect(table)}
        aria-label={`Table ${table.tableNumber}, ${table.capacity} seats, parties of ${party}, ${
          movable ? 'can be joined' : 'fixed, not joined'
        }, ${status.bookable ? 'bookable' : `not bookable: ${getShortBlockLabel(status.reason).toLocaleLowerCase('en-GB')}`}${
          joinPartner ? ', can join the selected table' : ''
        }`}
        className={cn(
          BARE_BUTTON_CLASS,
          'relative flex h-full min-h-18 w-full flex-col gap-1 rounded-lg border border-border/60 bg-background px-2.5 pb-2 pt-2 text-left text-foreground outline-none hover:border-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30',
          !status.bookable && HATCH_TILE_CLASS,
          !matches && 'opacity-45',
          joinPartner && JOIN_OUTLINE_CLASS,
          selected &&
            'border-primary hover:border-primary outline-2 outline-offset-1 outline-solid outline-primary',
        )}
      >
        <span className="flex items-start justify-between gap-1.5">
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-base font-semibold leading-none">
            {table.tableNumber}
            {movable ? null : (
              <span
                className="inline-grid text-muted-foreground"
                title="Fixed: always used on its own"
              >
                <LockIcon />
              </span>
            )}
          </span>
          <SeatDots dots={dots} overflow={overflow} muted={!status.bookable} />
        </span>
        <span className={cn('text-xs tabular-nums', !status.bookable && 'text-muted-foreground')}>
          {table.capacity} seats · {party}
        </span>
        {!status.bookable ? (
          <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold">
            <Minus className="size-4" aria-hidden />
            {getShortBlockLabel(status.reason)}
          </span>
        ) : note?.kind === 'join' ? (
          <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-foreground">
            <JoinIcon /> Can join
          </span>
        ) : note ? (
          <span className="mt-auto text-xs text-muted-foreground">{note.text}</span>
        ) : null}
      </Button>
    </li>
  );
}

function ZoneIconButton({
  label,
  tooltip,
  onClick,
  children,
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          className="min-h-0 min-w-0 [@media(pointer:coarse)]:size-11"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function ZoneSection({
  zone,
  tables,
  allTables,
  zones,
  filters,
  selectedTableId,
  joinPartnerIds,
  onSelectTable,
  onAddTable,
  onEditZone,
  onDeleteZone,
  onToggleZone,
}: {
  zone: TableZone;
  tables: TableInventory[];
  allTables: ReadonlyArray<TableInventory>;
  zones: TableZoneLookup;
  filters: RoomFilters;
  selectedTableId: string | null;
  joinPartnerIds: ReadonlySet<string>;
  onSelectTable: (table: TableInventory) => void;
  onAddTable: (zoneId: string) => void;
  onEditZone: (zone: TableZone) => void;
  onDeleteZone: (zone: TableZone) => void;
  onToggleZone: (zone: TableZone, active: boolean) => void;
}) {
  const { ref, columns } = useTileColumns();
  const seats = tables.reduce((sum, table) => sum + table.capacity, 0);
  const bookableSeats = tables
    .filter((table) => getTableBookingStatus(table, zones).bookable)
    .reduce((sum, table) => sum + table.capacity, 0);
  const join = getZoneJoinSummary(allTables, zone.id, zones);
  const addAlone =
    columns > 0 &&
    isAddTileAlone(
      tables.map((t) => t.capacity),
      columns,
    );
  const headingId = `zh-${zone.id}`;

  return (
    <SettingsCard
      id={zoneDomId(zone.id)}
      tabIndex={-1}
      region
      titleId={headingId}
      data-testid={`zone-${zone.id}`}
      className="outline-none"
      badges={zone.active ? null : <Badge variant="status-cancelled">Out of service</Badge>}
      title={<span className="break-words [overflow-wrap:anywhere]">{zone.name}</span>}
      description={
        <span className="tabular-nums">
          {countLabel(tables.length, 'table')} · {seats} seats
        </span>
      }
      headerAction={
        <span className="-my-1 flex shrink-0 sm:-mr-1.5">
          <ZoneIconButton
            label={`Rename or reorder ${zone.name}`}
            tooltip="Rename or reorder"
            onClick={() => onEditZone(zone)}
          >
            <Pencil aria-hidden />
          </ZoneIconButton>
          <ZoneIconButton
            label={`Delete ${zone.name}`}
            tooltip="Delete zone"
            onClick={() => onDeleteZone(zone)}
          >
            <Trash2 aria-hidden />
          </ZoneIconButton>
        </span>
      }
      contentClassName="grid gap-3"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {tables.length > 0 ? (
          <div className="grid w-full max-w-48 gap-1">
            <CapacityBar bookable={bookableSeats} total={seats} className="h-1.5" />
            <span className="text-xs text-muted-foreground tabular-nums">
              {bookableSeats === seats
                ? 'All seats bookable'
                : `${bookableSeats} of ${seats} seats bookable`}
            </span>
          </div>
        ) : null}
        {zone.active ? (
          <p className="flex items-start gap-1.5 text-xs">
            <JoinIcon className="mt-0.5" />
            <span>
              {join.maxTables >= 2 ? (
                <>
                  Join up to {join.maxTables} tables · parties up to <b>{join.maxParty}</b>
                </>
              ) : (
                'No tables to join here'
              )}
              {join.fixedCount > 0 ? (
                <span className="text-muted-foreground"> · {join.fixedCount} fixed</span>
              ) : null}
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Tables kept, not bookable.</p>
        )}
        <Label className="inline-flex min-h-9 cursor-pointer items-center gap-2.5 font-medium sm:ml-auto [@media(pointer:coarse)]:min-h-11">
          <Switch
            id={`zs-${zone.id}`}
            checked={zone.active}
            onCheckedChange={(checked) => onToggleZone(zone, checked)}
          />
          <span>In service</span>
        </Label>
      </div>
      <ul
        ref={ref}
        role="list"
        onKeyDown={(event) => handleTileKeys(event, columns)}
        className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] content-start gap-2 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]"
      >
        {tables.map((table) => (
          <TableTile
            key={table.id}
            table={table}
            zones={zones}
            selected={selectedTableId === table.id}
            joinPartner={joinPartnerIds.has(table.id)}
            matches={matchesRoomFilters(table, filters, zones)}
            onSelect={onSelectTable}
          />
        ))}
        <li className={cn(addAlone && 'col-span-full')}>
          <Button
            variant="ghost"
            type="button"
            onClick={() => onAddTable(zone.id)}
            className={cn(
              BARE_BUTTON_CLASS,
              'flex h-full w-full items-center justify-center rounded-lg border border-dashed border-border bg-transparent text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30',
              addAlone ? 'min-h-10 [@media(pointer:coarse)]:min-h-11' : 'min-h-18',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus className="size-4" aria-hidden /> Add table{' '}
              <span className="sr-only">to {zone.name}</span>
            </span>
          </Button>
        </li>
      </ul>
    </SettingsCard>
  );
}

export function TableRoomZones({
  zones,
  tables,
  lookup,
  filters,
  selectedTableId,
  joinPartnerIds,
  onSelectTable,
  onAddTable,
  onAddZone,
  onEditZone,
  onDeleteZone,
  onToggleZone,
  onClearFilters,
  hasFilters,
}: {
  zones: TableZone[];
  tables: ReadonlyArray<TableInventory>;
  lookup: TableZoneLookup;
  filters: RoomFilters;
  selectedTableId: string | null;
  joinPartnerIds: ReadonlySet<string>;
  onSelectTable: (table: TableInventory) => void;
  onAddTable: (zoneId: string) => void;
  onAddZone: () => void;
  onEditZone: (zone: TableZone) => void;
  onDeleteZone: (zone: TableZone) => void;
  onToggleZone: (zone: TableZone, active: boolean) => void;
  onClearFilters: () => void;
  hasFilters: boolean;
}) {
  const anyMatch = tables.some((table) => matchesRoomFilters(table, filters, lookup));
  return (
    <div>
      <div className="grid gap-3">
        {zones.map((zone) => (
          <ZoneSection
            key={zone.id}
            zone={zone}
            tables={tables
              .filter((table) => table.zoneId === zone.id)
              .sort((a, b) =>
                a.tableNumber.localeCompare(b.tableNumber, 'en-GB', { numeric: true }),
              )}
            allTables={tables}
            zones={lookup}
            filters={filters}
            selectedTableId={selectedTableId}
            joinPartnerIds={joinPartnerIds}
            onSelectTable={onSelectTable}
            onAddTable={onAddTable}
            onEditZone={onEditZone}
            onDeleteZone={onDeleteZone}
            onToggleZone={onToggleZone}
          />
        ))}
      </div>
      {hasFilters ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {anyMatch ? 'Tables that don’t match are faded. ' : 'No tables match. '}
          <Button
            variant="ghost"
            type="button"
            onClick={onClearFilters}
            className={LINK_BUTTON_CLASS}
          >
            Clear filters
          </Button>
        </p>
      ) : null}
      <Button
        variant="ghost"
        type="button"
        onClick={onAddZone}
        className={cn(
          BARE_BUTTON_CLASS,
          'mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-transparent font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30',
        )}
      >
        <Plus className="size-4" aria-hidden /> Add zone
      </Button>
    </div>
  );
}
