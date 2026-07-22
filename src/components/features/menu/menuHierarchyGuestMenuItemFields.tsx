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
import { Text } from '@/components/ui/typography';

import { NONE_VALUE, type ItemFormState } from './menuHierarchyDomain';
import { Field, SwitchField } from './menuHierarchyFormControls';
import { patchItemState, type ItemStateSetter } from './menuHierarchyItemOperationalFieldHelpers';

export function GuestMenuItemFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <div className="rounded-md border p-4">
      <Text variant="subheading" as="h3">Guest menu</Text>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
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
        <Field label="Service periods">
          <Input
            value={state.servicePeriods}
            onChange={(event) => patchItemState(setState, { servicePeriods: event.target.value })}
            placeholder="lunch, dinner"
          />
        </Field>
        <SwitchField
          label="Item active"
          checked={state.active}
          onCheckedChange={(checked) => patchItemState(setState, { active: checked })}
        />
        <SwitchField
          label="Sold out"
          checked={state.soldOut}
          onCheckedChange={(checked) => patchItemState(setState, { soldOut: checked })}
        />
        <SwitchField
          label="Orderable"
          checked={state.orderable}
          onCheckedChange={(checked) => patchItemState(setState, { orderable: checked })}
        />
      </div>
      <Field label="Availability policy note" className="mt-4">
        <Textarea
          value={state.availabilityNote}
          onChange={(event) => patchItemState(setState, { availabilityNote: event.target.value })}
        />
      </Field>
    </div>
  );
}
