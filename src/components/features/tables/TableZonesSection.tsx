'use client';

import { CheckCircle2, MinusCircle, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
} from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { formatZoneTableStats, getZoneTableStats } from './tableInventoryDisplayDomain';
import { TABLE_TOUCH_TARGET_CLASS, TableIconButton } from './TableInventoryParts';

import type { TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

const TABLE_ZONES_HEADING_ID = 'table-zones-heading';

export function TableZonesSection({
  isLoadingZones,
  isZonesError,
  onRetryZones,
  zones,
  tables,
  selectedZoneId,
  isZoneDeletePending,
  onSelectZone,
  onAddZone,
  onEditZone,
  onDeleteZone,
  onToggleZoneActive,
}: {
  isLoadingZones: boolean;
  isZonesError: boolean;
  onRetryZones: () => void;
  zones: TableZone[];
  tables: TableInventory[];
  selectedZoneId: string;
  isZoneDeletePending: boolean;
  onSelectZone: (zoneId: string) => void;
  onAddZone: () => void;
  onEditZone: (zone: TableZone) => void;
  onDeleteZone: (zone: TableZone) => void;
  onToggleZoneActive: (zone: TableZone, active: boolean) => void;
}) {
  return (
    <section
      id="table-zones"
      aria-labelledby={TABLE_ZONES_HEADING_ID}
      className="min-w-0 scroll-mt-28"
    >
      <Card className={cn('w-full overflow-hidden', SETTINGS_COMPACT_CARD_CLASS)}>
        <CardHeader
          className={cn(
            SETTINGS_COMPACT_CARD_HEADER_CLASS,
            'flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 border-b border-border/60 bg-muted/30',
          )}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={TABLE_ZONES_HEADING_ID} className="text-base font-semibold leading-6">
              Zones
            </h2>
            <p className="text-xs leading-5 text-muted-foreground">
              Groups of tables. Turn a zone off for the season without deleting its tables.
            </p>
          </div>
          {zones.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddZone}
              className={TABLE_TOUCH_TARGET_CLASS}
            >
              <Plus data-icon="inline-start" aria-hidden />
              Add zone
            </Button>
          ) : null}
        </CardHeader>
        <CardContent
          className={cn(SETTINGS_COMPACT_CARD_CONTENT_CLASS, 'flex min-w-0 flex-col pt-4')}
        >
          {isLoadingZones ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <span className="sr-only">Loading zones</span>
            </div>
          ) : isZonesError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Zones couldn’t be loaded</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>Saved settings are unchanged.</span>
                <Button type="button" variant="outline" size="sm" onClick={onRetryZones}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : zones.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4">
              <p className="text-sm font-semibold">No zones yet</p>
              <p className="text-sm text-muted-foreground">
                Every table belongs to a zone, such as Main dining room or Terrace. Add one to
                start.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={onAddZone}
                className={TABLE_TOUCH_TARGET_CLASS}
              >
                <Plus data-icon="inline-start" aria-hidden />
                Add your first zone
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60" aria-label="Zones">
              {zones.map((zone) => (
                <TableZoneRow
                  key={zone.id}
                  zone={zone}
                  stats={formatZoneTableStats(getZoneTableStats(tables, zone.id))}
                  isFiltered={selectedZoneId === zone.id}
                  isZoneDeletePending={isZoneDeletePending}
                  onSelectZone={onSelectZone}
                  onEditZone={onEditZone}
                  onDeleteZone={onDeleteZone}
                  onToggleZoneActive={onToggleZoneActive}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function TableZoneRow({
  zone,
  stats,
  isFiltered,
  isZoneDeletePending,
  onSelectZone,
  onEditZone,
  onDeleteZone,
  onToggleZoneActive,
}: {
  zone: TableZone;
  stats: string;
  isFiltered: boolean;
  isZoneDeletePending: boolean;
  onSelectZone: (zoneId: string) => void;
  onEditZone: (zone: TableZone) => void;
  onDeleteZone: (zone: TableZone) => void;
  onToggleZoneActive: (zone: TableZone, active: boolean) => void;
}) {
  const switchId = `zone-active-${zone.id}`;
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" data-testid={`zone-${zone.id}`}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isFiltered}
            onClick={() => onSelectZone(zone.id)}
            className={cn(
              '-ml-2 h-auto min-h-8 max-w-full justify-start whitespace-normal px-2 py-1 text-left font-semibold',
              isFiltered && 'bg-primary/10 text-primary hover:bg-primary/15',
              TABLE_TOUCH_TARGET_CLASS,
            )}
          >
            {zone.name}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground tabular-nums">{stats}</p>
        </div>
        <Badge variant={zone.active ? 'status-confirmed' : 'secondary'} className="shrink-0 gap-1">
          {zone.active ? (
            <CheckCircle2 className="size-3" aria-hidden />
          ) : (
            <MinusCircle className="size-3" aria-hidden />
          )}
          {zone.active ? 'In service' : 'Out of service'}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={cn('flex items-center gap-2', TABLE_TOUCH_TARGET_CLASS)}>
          <Switch
            id={switchId}
            checked={zone.active}
            onCheckedChange={(checked) => onToggleZoneActive(zone, checked)}
            aria-label={`${zone.name} in service`}
            aria-describedby={`${switchId}-state`}
          />
          <span id={`${switchId}-state`} className="text-sm text-muted-foreground">
            {zone.active ? 'Tables can be booked' : 'Tables kept, not bookable'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TableIconButton
            label={`Edit ${zone.name}`}
            tooltip="Edit zone"
            Icon={Pencil}
            onClick={() => onEditZone(zone)}
          />
          <TableIconButton
            label={`Delete ${zone.name}`}
            tooltip="Delete zone"
            Icon={Trash2}
            destructive
            disabled={isZoneDeletePending}
            onClick={() => onDeleteZone(zone)}
          />
        </div>
      </div>
    </li>
  );
}
