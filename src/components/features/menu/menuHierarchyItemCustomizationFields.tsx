'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/typography';

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
    <section className="flex flex-col gap-4">
      <Text variant="subheading" as="h3">
        Customisation
      </Text>
      <div className="grid gap-4 sm:grid-cols-2">
        <SwitchField
          label="Allow customisations"
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
      <Field label="Customisation control note">
        <Textarea
          value={state.customizationNote}
          onChange={(event) => patchItemState(setState, { customizationNote: event.target.value })}
        />
      </Field>
    </section>
  );
}
