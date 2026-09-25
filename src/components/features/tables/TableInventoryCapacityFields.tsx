import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { TABLE_FORM_LIMITS, type TableFormErrors } from './tableInventoryFormDomain';
import { describedBy, TableFieldError } from './TableInventoryParts';

import type { TableInventory } from '@/services/ops/tables';

export function TableInventoryCapacityFields({
  table,
  errors,
}: {
  readonly table: TableInventory | null;
  readonly errors: TableFormErrors;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <Label htmlFor="tableNumber">Table number</Label>
          <Input
            id="tableNumber"
            name="tableNumber"
            defaultValue={table?.tableNumber ?? ''}
            maxLength={TABLE_FORM_LIMITS.tableNumberMax}
            autoComplete="off"
            aria-invalid={errors.tableNumber ? true : undefined}
            aria-describedby={describedBy(errors.tableNumber && 'tableNumber-error')}
          />
          <TableFieldError id="tableNumber-error" message={errors.tableNumber} />
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor="capacity">Seats</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            inputMode="numeric"
            min={TABLE_FORM_LIMITS.seatsMin}
            max={TABLE_FORM_LIMITS.seatsMax}
            defaultValue={table?.capacity ?? 4}
            className="tabular-nums"
            aria-invalid={errors.capacity ? true : undefined}
            aria-describedby={describedBy('capacity-hint', errors.capacity && 'capacity-error')}
          />
          <p id="capacity-hint" className="text-xs leading-5 text-muted-foreground">
            1 to 20.
          </p>
          <TableFieldError id="capacity-error" message={errors.capacity} />
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Party sizes this table accepts</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label htmlFor="minPartySize">Smallest party</Label>
            <Input
              id="minPartySize"
              name="minPartySize"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={table?.minPartySize ?? 1}
              className="tabular-nums"
              aria-invalid={errors.minPartySize ? true : undefined}
              aria-describedby={describedBy(errors.minPartySize && 'minPartySize-error')}
            />
            <TableFieldError id="minPartySize-error" message={errors.minPartySize} />
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor="maxPartySize">Largest party</Label>
            <Input
              id="maxPartySize"
              name="maxPartySize"
              type="number"
              inputMode="numeric"
              min={1}
              max={TABLE_FORM_LIMITS.seatsMax}
              defaultValue={table?.maxPartySize ?? ''}
              placeholder="Same as seats"
              className="tabular-nums"
              aria-invalid={errors.maxPartySize ? true : undefined}
              aria-describedby={describedBy(errors.maxPartySize && 'maxPartySize-error')}
            />
            <TableFieldError id="maxPartySize-error" message={errors.maxPartySize} />
          </div>
        </div>
      </fieldset>
    </>
  );
}
