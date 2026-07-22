'use client';

import { Edit, Plus, Trash2 } from 'lucide-react';

import {
  SettingsCard,
  SettingsSecondaryActions,
} from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import { ALL_ZONES_VALUE, type TableZone, type ZoneStatusFilter } from './tableInventoryModel';

export function TableZonesSection({
  isActive,
  zoneDeleteBlockedMessage,
  isLoadingZones,
  isZonesError,
  zonesError,
  zones,
  filteredZones,
  selectedZoneId,
  zoneStatusFilter,
  isZoneUpdatePending,
  isZoneDeletePending,
  onZoneStatusFilterChange,
  onSelectZone,
  onAddZone,
  onEditZone,
  onDeleteZone,
  onToggleZoneActive,
}: {
  isActive: boolean;
  zoneDeleteBlockedMessage: string | null;
  isLoadingZones: boolean;
  isZonesError: boolean;
  zonesError: unknown;
  zones: TableZone[];
  filteredZones: TableZone[];
  selectedZoneId: string;
  zoneStatusFilter: ZoneStatusFilter;
  isZoneUpdatePending: boolean;
  isZoneDeletePending: boolean;
  onZoneStatusFilterChange: (filter: ZoneStatusFilter) => void;
  onSelectZone: (zoneId: string) => void;
  onAddZone: () => void;
  onEditZone: (zone: TableZone) => void;
  onDeleteZone: (zone: TableZone) => void;
  onToggleZoneActive: (zoneId: string, active: boolean) => void;
}) {
  return (
    <div id="table-zones" hidden={!isActive} className={cn('scroll-mt-28', !isActive && 'hidden')}>
      <SettingsCard
        title="Zones"
        description="Group tables by areas of your floor plan. Add or rename zones as your layout changes."
        headerAction={
          <SettingsSecondaryActions label="Zone options" contentClassName="sm:min-w-80">
            <div className="flex flex-col gap-2">
              <Label htmlFor="zone-status-filter" className="text-sm text-muted-foreground">
                Show
              </Label>
              <Select
                value={zoneStatusFilter}
                onValueChange={(value) => onZoneStatusFilterChange(value as ZoneStatusFilter)}
              >
                <SelectTrigger id="zone-status-filter">
                  <SelectValue placeholder="All zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active zones</SelectItem>
                  <SelectItem value="inactive">Inactive zones</SelectItem>
                  <SelectItem value="all">All zones</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={onAddZone}>
              <Plus data-icon="inline-start" aria-hidden />
              Add zone
            </Button>
          </SettingsSecondaryActions>
        }
      >
        {zoneDeleteBlockedMessage ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Zone cannot be deleted yet</AlertTitle>
            <AlertDescription>{zoneDeleteBlockedMessage}</AlertDescription>
          </Alert>
        ) : null}
        {isLoadingZones ? (
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>
        ) : isZonesError ? (
          <Alert variant="destructive">
            <AlertTitle>Zones unavailable</AlertTitle>
            <AlertDescription>
              {zonesError instanceof Error ? zonesError.message : 'Unable to load zones right now.'}
            </AlertDescription>
          </Alert>
        ) : filteredZones.length === 0 ? (
          <Text variant="caption">
            {zones.length === 0
              ? 'No zones configured yet. Create your first zone to start organizing tables.'
              : 'No zones match this filter. Show all to view inactive zones.'}
          </Text>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filteredZones.map((zone) => {
              const isActiveFilter = selectedZoneId === zone.id;
              return (
                <li key={zone.id}>
                  <div
                    className={cn(
                      'flex flex-col gap-2 rounded-md border px-3 py-2',
                      zone.active ? 'bg-background' : 'bg-muted/60',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={isActiveFilter ? 'default' : 'ghost'}
                          onClick={() => onSelectZone(isActiveFilter ? ALL_ZONES_VALUE : zone.id)}
                        >
                          {zone.name}
                        </Button>
                        <Badge variant={zone.active ? 'outline' : 'secondary'}>
                          {zone.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          #{zone.sortOrder ?? 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={zone.active}
                          onCheckedChange={(checked) => onToggleZoneActive(zone.id, checked)}
                          aria-label={`Toggle ${zone.name} zone availability`}
                          disabled={isZoneUpdatePending}
                        />
                        <span className="hidden text-xs text-muted-foreground md:inline">
                          Seasonal toggle
                        </span>
                      </div>
                    </div>
                    <Text variant="caption">
                      {zone.active
                        ? 'Included in capacity and assignments.'
                        : 'Tables stay visible but are excluded from service until re-enabled.'}
                    </Text>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditZone(zone)}
                        aria-label={`Edit zone ${zone.name}`}
                      >
                        <Edit aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isZoneDeletePending}
                        onClick={() => onDeleteZone(zone)}
                        aria-label={`Delete zone ${zone.name}`}
                      >
                        <Trash2 className="text-destructive" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>
    </div>
  );
}
