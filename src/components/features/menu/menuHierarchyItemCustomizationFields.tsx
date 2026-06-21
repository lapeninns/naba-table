'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { type ItemFormState } from './menuHierarchyDomain';
import { Field, SwitchField } from './menuHierarchyFormControls';
import { patchItemState, type ItemStateSetter } from './menuHierarchyItemOperationalFieldHelpers';

export function CustomizationFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="text-sm font-semibold">Customization</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SwitchField
          label="Allow customizations"
          checked={state.allowCustomizations}
          onCheckedChange={(checked) => patchItemState(setState, { allowCustomizations: checked })}
        />
        <Field label="Max selections">
          <Input
            type="number"
            min="0"
            value={state.maxSelections}
            onChange={(event) => patchItemState(setState, { maxSelections: event.target.value })}
          />
        </Field>
        <Field label="Modifier group IDs">
          <Input
            value={state.modifierGroupIds}
            onChange={(event) => patchItemState(setState, { modifierGroupIds: event.target.value })}
          />
        </Field>
      </div>
      <Field label="Customization control note" className="mt-4">
        <Textarea
          value={state.customizationNote}
          onChange={(event) => patchItemState(setState, { customizationNote: event.target.value })}
        />
      </Field>
    </div>
  );
}
