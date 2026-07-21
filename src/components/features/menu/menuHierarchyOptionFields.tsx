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
import { formatGoogleFoodMenuEnumLabel as formatEnumLabel } from '@/lib/google-food-menu-labels';

import {
  ALLERGEN_OPTIONS,
  DIETARY_OPTIONS,
  NONE_VALUE,
  PREPARATION_OPTIONS,
  SPICINESS_OPTIONS,
  primaryLabel,
  toggleValue,
  type OptionFormState,
} from './menuHierarchyDomain';
import { Field, MultiCheckboxGroup, SwitchField } from './menuHierarchyFormControls';

import type { CanonicalRestaurantMenuItem } from '@/server/menu-hierarchy/types';
import type { Dispatch, SetStateAction } from 'react';

type OptionStateSetter = Dispatch<SetStateAction<OptionFormState>>;

function patch(setState: OptionStateSetter, update: Partial<OptionFormState>) {
  setState((current) => ({ ...current, ...update }));
}

export function OptionParentSummary({ item }: { readonly item: CanonicalRestaurantMenuItem }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3 text-sm">
      <span className="font-medium">{primaryLabel(item, 'Menu item')}</span>
      <span className="ml-2 text-muted-foreground tabular-nums">
        {item.options.length} existing options
      </span>
    </div>
  );
}

export function OptionIdentityFields({
  setState,
  state,
}: {
  readonly setState: OptionStateSetter;
  readonly state: OptionFormState;
}) {
  return (
    <>
      <Field label="Option name">
        <Input
          value={state.displayName}
          onChange={(event) => patch(setState, { displayName: event.target.value })}
          required
        />
      </Field>
      <Field label="Primary label language">
        <Input
          value={state.languageCode}
          onChange={(event) => patch(setState, { languageCode: event.target.value })}
          placeholder="en-GB"
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={state.description}
          onChange={(event) => patch(setState, { description: event.target.value })}
        />
      </Field>
      <Field label="Additional Google labels">
        <Textarea
          value={state.additionalLabels}
          onChange={(event) => patch(setState, { additionalLabels: event.target.value })}
          placeholder="fr-FR | Nom de l'option | Description"
        />
      </Field>
      <Field label="Option price">
        <div className="grid grid-cols-[6rem_1fr] gap-2">
          <Input
            value={state.currencyCode}
            onChange={(event) => patch(setState, { currencyCode: event.target.value })}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            value={state.price}
            onChange={(event) => patch(setState, { price: event.target.value })}
          />
        </div>
      </Field>
    </>
  );
}

export function OptionGoogleAttributeFields({
  setState,
  state,
}: {
  readonly setState: OptionStateSetter;
  readonly state: OptionFormState;
}) {
  return (
    <div className="rounded-md border p-4">
      <Text variant="subheading" as="h3">Option Google attributes</Text>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Spiciness">
          <Select
            value={state.spiciness}
            onValueChange={(value) => patch(setState, { spiciness: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>None</SelectItem>
              {SPICINESS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {formatEnumLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Serves">
          <Input
            type="number"
            min="0"
            value={state.serves}
            onChange={(event) => patch(setState, { serves: event.target.value })}
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MultiCheckboxGroup
          label="Allergens"
          options={ALLERGEN_OPTIONS}
          getOptionLabel={formatEnumLabel}
          values={state.allergens}
          onChange={(value, checked) =>
            setState((current) => ({
              ...current,
              allergens: toggleValue(current.allergens, value, checked),
            }))
          }
        />
        <MultiCheckboxGroup
          label="Dietary restrictions"
          options={DIETARY_OPTIONS}
          getOptionLabel={formatEnumLabel}
          values={state.dietaryRestrictions}
          onChange={(value, checked) =>
            setState((current) => ({
              ...current,
              dietaryRestrictions: toggleValue(current.dietaryRestrictions, value, checked),
            }))
          }
        />
      </div>
      <MultiCheckboxGroup
        label="Preparation methods"
        options={PREPARATION_OPTIONS}
        getOptionLabel={formatEnumLabel}
        values={state.preparationMethods}
        onChange={(value, checked) =>
          setState((current) => ({
            ...current,
            preparationMethods: toggleValue(current.preparationMethods, value, checked),
          }))
        }
        className="mt-4"
      />
      <Field label="Ingredients" className="mt-4">
        <Input
          value={state.ingredients}
          onChange={(event) => patch(setState, { ingredients: event.target.value })}
          placeholder="Comma-separated ingredient labels"
        />
      </Field>
    </div>
  );
}

export function OptionMediaFields({
  setState,
  state,
}: {
  readonly setState: OptionStateSetter;
  readonly state: OptionFormState;
}) {
  return (
    <div className="rounded-md border p-4">
      <Text variant="subheading" as="h3">Option media keys</Text>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="GBP media keys">
          <Textarea
            value={state.googleMediaKeys}
            onChange={(event) => patch(setState, { googleMediaKeys: event.target.value })}
            placeholder="One Google media key per line"
          />
        </Field>
        <Field label="Local image URL">
          <Input
            value={state.localImageUrl}
            onChange={(event) => patch(setState, { localImageUrl: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

export function OptionActiveField({
  setState,
  state,
}: {
  readonly setState: OptionStateSetter;
  readonly state: OptionFormState;
}) {
  return (
    <SwitchField
      label="Option active"
      checked={state.active}
      onCheckedChange={(checked) => patch(setState, { active: checked })}
    />
  );
}
