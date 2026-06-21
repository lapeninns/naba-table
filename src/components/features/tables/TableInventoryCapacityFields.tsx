import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { TableInventory } from '@/services/ops/tables';

export function TableInventoryCapacityFields({ table }: { readonly table: TableInventory | null }) {
  return (
    <>
      <div>
        <p className="text-sm font-semibold text-foreground">Capacity</p>
        <p className="text-xs leading-5 text-muted-foreground">
          Start with the table number, covers, and accepted party-size range.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="tableNumber">Table number *</Label>
        <Input
          id="tableNumber"
          name="tableNumber"
          defaultValue={table?.tableNumber ?? ''}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="capacity">Capacity *</Label>
        <Input
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          max={20}
          defaultValue={table?.capacity ?? 4}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="minPartySize">Min party size</Label>
          <Input
            id="minPartySize"
            name="minPartySize"
            type="number"
            min={1}
            defaultValue={table?.minPartySize ?? 1}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="maxPartySize">Max party size</Label>
          <Input
            id="maxPartySize"
            name="maxPartySize"
            type="number"
            min={1}
            defaultValue={table?.maxPartySize ?? ''}
            placeholder="Same as capacity"
          />
        </div>
      </div>
    </>
  );
}
