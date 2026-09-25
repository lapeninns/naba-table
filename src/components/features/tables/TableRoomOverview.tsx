'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { OverviewHeading, PartyCoverageBlock, ServiceCapacityNote } from './TableCapacitySummary';
import { countLabel, type ServiceCapacityLine } from './tableInventoryDisplayDomain';
import { BARE_BUTTON_CLASS, CapacityBar } from './TableRoomParts';

import type { TableZone } from './tableInventoryModel';
import type { NeedsLookItem, PartyCoverage, SeatStats } from './tableRoomDomain';
import type { TableInventory } from '@/services/ops/tables';

const ROW_CLASS =
  '-mx-2 grid w-[calc(100%+16px)] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 rounded-md border-0 bg-transparent p-2 text-left text-[13px] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30';

/** Side panel when no table is selected: capacity, what needs a look and seats per zone. */
export function TableRoomOverview({
  tables,
  zones,
  stats,
  zoneStats,
  needsLook,
  coverage,
  serviceCapacityLines,
  hasSummary,
  onSelectTable,
  onGoToZone,
  onFix,
}: {
  tables: ReadonlyArray<TableInventory>;
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'name' | 'active'>>;
  stats: SeatStats;
  zoneStats: ReadonlyMap<string, { bookableSeats: number; totalSeats: number }>;
  needsLook: ReadonlyArray<NeedsLookItem<TableInventory>>;
  coverage: PartyCoverage;
  serviceCapacityLines: ServiceCapacityLine[];
  hasSummary: boolean;
  onSelectTable: (table: TableInventory) => void;
  onGoToZone: (zoneId: string) => void;
  onFix: (item: NeedsLookItem<TableInventory>) => void;
}) {
  const zoneName = (zoneId: string) => zones.find((zone) => zone.id === zoneId)?.name ?? '';

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-border px-5 pb-3 pt-4">
        <div>
          <h2 className="text-base font-semibold">Room at a glance</h2>
          <p className="text-xs leading-[1.45] text-muted-foreground">
            Select a table to see why it can or can’t be booked, and to edit it.
          </p>
        </div>
      </div>
      {tables.length === 0 ? (
        <div className="grid gap-3.5 px-5 pb-4 pt-3.5">
          <p className="text-xs text-muted-foreground">
            Capacity, tables that need a look and seats per zone appear here once you add tables.
          </p>
        </div>
      ) : (
        <div
          className="grid min-h-0 gap-3.5 overflow-y-auto px-5 pb-4 pt-3.5"
          data-testid="room-overview"
        >
          <div className="grid gap-2">
            <p>
              <span className="text-xl font-semibold tabular-nums">{stats.bookableSeats}</span>{' '}
              <span className="text-muted-foreground">
                of {stats.totalSeats} seats bookable now
              </span>
            </p>
            <CapacityBar
              bookable={stats.bookableSeats}
              total={stats.totalSeats}
              label={`${stats.bookableSeats} of ${stats.totalSeats} seats bookable`}
            />
            <p className="text-xs text-muted-foreground">
              {countLabel(stats.bookableTables, 'table')} of {stats.totalTables} can be given to
              bookings.
            </p>
          </div>

          {needsLook.length > 0 ? (
            <div className="grid gap-2">
              <OverviewHeading>{`Needs a look (${needsLook.length})`}</OverviewHeading>
              <ul className="grid">
                {needsLook.map((item) =>
                  item.kind === 'table' ? (
                    <li
                      key={`table-${item.table.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                    >
                      <Button
                        variant="ghost"
                        type="button"
                        className={cn(BARE_BUTTON_CLASS, `${ROW_CLASS} mr-0 w-[calc(100%+8px)]`)}
                        onClick={() => onSelectTable(item.table)}
                      >
                        <span>
                          <b className="font-semibold">Table {item.table.tableNumber}</b>{' '}
                          <span className="text-muted-foreground">
                            · {zoneName(item.table.zoneId)}
                          </span>
                          <br />
                          <span className="text-xs">{item.label}</span>
                        </span>
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => onFix(item)}>
                        {item.fix === 'turn-on' ? 'Turn on' : 'Mark available'}{' '}
                        <span className="sr-only">table {item.table.tableNumber}</span>
                      </Button>
                    </li>
                  ) : (
                    <li
                      key={`zone-${item.zone.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                    >
                      <Button
                        variant="ghost"
                        type="button"
                        className={cn(BARE_BUTTON_CLASS, `${ROW_CLASS} mr-0 w-[calc(100%+8px)]`)}
                        onClick={() => onGoToZone(item.zone.id)}
                      >
                        <span>
                          <b className="font-semibold">{item.zone.name}</b>{' '}
                          <span className="text-muted-foreground">
                            · {countLabel(item.tableCount, 'table')}
                          </span>
                          <br />
                          <span className="text-xs">Zone out of service</span>
                        </span>
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => onFix(item)}>
                        Put in service <span className="sr-only">{item.zone.name}</span>
                      </Button>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}

          <PartyCoverageBlock coverage={coverage} />

          <div className="grid gap-2">
            <OverviewHeading>Seats by zone</OverviewHeading>
            <ul className="grid">
              {zones.map((zone) => {
                const seats = zoneStats.get(zone.id) ?? { bookableSeats: 0, totalSeats: 0 };
                return (
                  <li key={zone.id}>
                    <Button
                      variant="ghost"
                      type="button"
                      className={cn(BARE_BUTTON_CLASS, ROW_CLASS)}
                      onClick={() => onGoToZone(zone.id)}
                    >
                      <span>{zone.name}</span>
                      <span className="text-xs tabular-nums">
                        {seats.bookableSeats} of {seats.totalSeats}
                      </span>
                      <CapacityBar
                        bookable={seats.bookableSeats}
                        total={seats.totalSeats}
                        className="col-span-2 h-1.5"
                      />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>

          <ServiceCapacityNote lines={serviceCapacityLines} hasSummary={hasSummary} />
        </div>
      )}
    </>
  );
}
