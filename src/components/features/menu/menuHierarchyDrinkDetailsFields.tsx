'use client';

import { Beer } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/typography';

import { type ItemFormState } from './menuHierarchyDomain';
import { Field, SwitchField } from './menuHierarchyFormControls';
import { patchItemState, type ItemStateSetter } from './menuHierarchyItemOperationalFieldHelpers';

export function DrinkDetailsFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center gap-2">
        <Beer className="size-4 text-muted-foreground" aria-hidden />
        <Text variant="subheading" as="h3">Drink details</Text>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="ABV %">
          <Input
            type="number"
            min="0"
            step="0.1"
            value={state.abvPercent}
            onChange={(event) => patchItemState(setState, { abvPercent: event.target.value })}
          />
        </Field>
        <Field label="Volume ml">
          <Input
            type="number"
            min="0"
            value={state.volumeMl}
            onChange={(event) => patchItemState(setState, { volumeMl: event.target.value })}
          />
        </Field>
        <Field label="Serving size">
          <Input
            value={state.servingSize}
            onChange={(event) => patchItemState(setState, { servingSize: event.target.value })}
            placeholder="Pint, 175ml, bottle"
          />
        </Field>
        <Field label="Style">
          <Input
            value={state.drinkStyle}
            onChange={(event) => patchItemState(setState, { drinkStyle: event.target.value })}
            placeholder="Lager, IPA, Merlot"
          />
        </Field>
        <Field label="Region">
          <Input
            value={state.drinkRegion}
            onChange={(event) => patchItemState(setState, { drinkRegion: event.target.value })}
          />
        </Field>
        <Field label="Grape">
          <Input
            value={state.drinkGrape}
            onChange={(event) => patchItemState(setState, { drinkGrape: event.target.value })}
          />
        </Field>
        <Field label="Caffeine mg">
          <Input
            type="number"
            min="0"
            value={state.caffeineMg}
            onChange={(event) => patchItemState(setState, { caffeineMg: event.target.value })}
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SwitchField
          label="Contains dairy"
          checked={state.containsDairy}
          onCheckedChange={(checked) => patchItemState(setState, { containsDairy: checked })}
        />
        <SwitchField
          label="Contains nuts"
          checked={state.containsNuts}
          onCheckedChange={(checked) => patchItemState(setState, { containsNuts: checked })}
        />
        <SwitchField
          label="Contains gluten"
          checked={state.containsGluten}
          onCheckedChange={(checked) => patchItemState(setState, { containsGluten: checked })}
        />
        <SwitchField
          label="Contains caffeine"
          checked={state.containsCaffeine}
          onCheckedChange={(checked) => patchItemState(setState, { containsCaffeine: checked })}
        />
        <SwitchField
          label="Non-alcoholic"
          checked={state.nonAlcoholic}
          onCheckedChange={(checked) => patchItemState(setState, { nonAlcoholic: checked })}
        />
        <SwitchField
          label="Decaf available"
          checked={state.decafAvailable}
          onCheckedChange={(checked) => patchItemState(setState, { decafAvailable: checked })}
        />
      </div>
      <Field label="Drink profile note" className="mt-4">
        <Textarea
          value={state.drinkProfileNote}
          onChange={(event) => patchItemState(setState, { drinkProfileNote: event.target.value })}
        />
      </Field>
    </div>
  );
}
