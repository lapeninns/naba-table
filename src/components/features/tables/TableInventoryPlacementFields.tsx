import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import type { TableZone } from './tableInventoryModel';

export function TableInventoryPlacementFields({
  active,
  isZoneSelectDisabled,
  isZonesLoading,
  selectedZone,
  setActive,
  setZoneId,
  zoneId,
  zones,
}: {
  readonly active: boolean;
  readonly isZoneSelectDisabled: boolean;
  readonly isZonesLoading: boolean;
  readonly selectedZone: Pick<TableZone, 'id' | 'name' | 'active'> | null;
  readonly setActive: (active: boolean) => void;
  readonly setZoneId: (zoneId: string) => void;
  readonly zoneId: string | undefined;
  readonly zones: ReadonlyArray<Pick<TableZone, 'id' | 'name' | 'active'>>;
}) {
  return (
    <>
      <div>
        <p className="text-sm font-semibold text-foreground">Placement</p>
        <p className="text-xs leading-5 text-muted-foreground">
          Put the table in a zone and decide whether it is active for service.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="zoneId">Zone</Label>
        <Select
          value={zoneId}
          onValueChange={setZoneId}
          disabled={isZoneSelectDisabled || isZonesLoading}
        >
          <SelectTrigger id="zoneId">
            <SelectValue placeholder="Select a zone" />
          </SelectTrigger>
          <SelectContent>
            {isZonesLoading ? (
              <SelectLabel>Loading zones...</SelectLabel>
            ) : isZoneSelectDisabled ? (
              <SelectGroup>
                <SelectLabel className="text-muted-foreground">No zones configured</SelectLabel>
              </SelectGroup>
            ) : (
              zones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.name}
                  {!zone.active ? ' (inactive)' : ''}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {selectedZone && selectedZone.active === false ? (
          <p className="text-xs text-primary">
            Zone is inactive. Reactivate it to bring these tables back into service.
          </p>
        ) : null}
        {!selectedZone ? (
          <p className="text-xs text-muted-foreground">
            Choose the service area this table belongs to. Add more zones later if needed.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="active">Active</Label>
        <div className="flex items-center gap-2 rounded-md border p-3">
          <Switch id="active-switch" checked={active} onCheckedChange={setActive} />
          <Label htmlFor="active-switch" className="flex-grow text-sm text-muted-foreground">
            {active ? 'Active in service' : 'Inactive / decommissioned'}
          </Label>
        </div>
      </div>
    </>
  );
}
