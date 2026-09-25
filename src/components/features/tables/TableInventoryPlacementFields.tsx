import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { describedBy, TABLE_TOUCH_TARGET_CLASS, TableFieldError } from './TableInventoryParts';

import type { TableZone } from './tableInventoryModel';

export function TableInventoryPlacementFields({
  active,
  isZonesLoading,
  setActive,
  setZoneId,
  zoneId,
  zones,
  zoneError,
}: {
  readonly active: boolean;
  readonly isZonesLoading: boolean;
  readonly setActive: (active: boolean) => void;
  readonly setZoneId: (zoneId: string) => void;
  readonly zoneId: string | undefined;
  readonly zones: ReadonlyArray<Pick<TableZone, 'id' | 'name' | 'active'>>;
  readonly zoneError?: string;
}) {
  const selectedZone = zones.find((zone) => zone.id === zoneId) ?? null;
  const zoneOutOfService = selectedZone?.active === false;

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="zoneId">Zone</Label>
        <Select value={zoneId} onValueChange={setZoneId} disabled={isZonesLoading}>
          <SelectTrigger
            id="zoneId"
            className={TABLE_TOUCH_TARGET_CLASS}
            aria-invalid={zoneError ? true : undefined}
            aria-describedby={describedBy(
              zoneOutOfService && 'zoneId-hint',
              zoneError && 'zoneId-error',
            )}
          >
            <SelectValue placeholder={isZonesLoading ? 'Loading zones…' : 'Choose a zone'} />
          </SelectTrigger>
          <SelectContent>
            {zones.map((zone) => (
              <SelectItem key={zone.id} value={zone.id}>
                {zone.name}
                {zone.active ? '' : ' (out of service)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {zoneOutOfService ? (
          <p id="zoneId-hint" className="text-xs leading-5 text-muted-foreground">
            This zone is out of service, so its tables can’t be booked until it is back in service.
          </p>
        ) : null}
        <TableFieldError id="zoneId-error" message={zoneError} />
      </div>

      <div className={`flex items-center gap-3 ${TABLE_TOUCH_TARGET_CLASS}`}>
        <Switch id="table-active" checked={active} onCheckedChange={setActive} />
        <Label htmlFor="table-active">Can be given to bookings</Label>
      </div>
    </>
  );
}
