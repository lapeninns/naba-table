'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { NONE_VALUE, type ItemFormState } from './menuHierarchyDomain';
import { Field, SwitchField } from './menuHierarchyFormControls';
import { patchItemState, type ItemStateSetter } from './menuHierarchyItemOperationalFieldHelpers';

/** Always-visible availability: shown on the menu, sold out and the services it is served at. */
export function ItemAvailabilityFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-2 text-sm font-medium text-foreground">Availability</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <SwitchField
          label="Shown on the menu"
          checked={state.active}
          onCheckedChange={(checked) => patchItemState(setState, { active: checked })}
        />
        <SwitchField
          label="Sold out for now"
          checked={state.soldOut}
          onCheckedChange={(checked) => patchItemState(setState, { soldOut: checked })}
        />
      </div>
      <Field
        label="Served at"
        hint="Leave empty to serve it at all services. Separate services with commas."
      >
        <Input
          value={state.servicePeriods}
          onChange={(event) => patchItemState(setState, { servicePeriods: event.target.value })}
          placeholder="lunch, dinner"
        />
      </Field>
    </fieldset>
  );
}

/** Less-used guest availability settings, kept under "More" in the item dialog. */
export function ItemAvailabilityDetailsFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Availability status">
          <Select
            value={state.availabilityStatus}
            onValueChange={(value) => patchItemState(setState, { availabilityStatus: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Not set</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
              <SelectItem value="seasonal">Seasonal</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <SwitchField
          label="Orderable"
          checked={state.orderable}
          onCheckedChange={(checked) => patchItemState(setState, { orderable: checked })}
        />
      </div>
      <Field label="Availability policy note">
        <Textarea
          value={state.availabilityNote}
          onChange={(event) => patchItemState(setState, { availabilityNote: event.target.value })}
        />
      </Field>
    </div>
  );
}
