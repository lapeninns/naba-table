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
  NUTRITION_UNITS,
  PREPARATION_OPTIONS,
  SPICINESS_OPTIONS,
  toggleValue,
  type ItemFormState,
} from './menuHierarchyDomain';
import { Field, MultiCheckboxGroup, NutritionRangeInputs } from './menuHierarchyFormControls';

import type { Dispatch, SetStateAction } from 'react';

type ItemStateSetter = Dispatch<SetStateAction<ItemFormState>>;

function patch(setState: ItemStateSetter, update: Partial<ItemFormState>) {
  setState((current) => ({ ...current, ...update }));
}

/** Always-visible item fields: what guests read first and what the kitchen must confirm. */
export function ItemEssentialsFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Item name">
        <Input
          value={state.displayName}
          onChange={(event) => patch(setState, { displayName: event.target.value })}
          required
        />
      </Field>
      <Field label="Description" hint="Optional">
        <Textarea
          rows={2}
          value={state.description}
          onChange={(event) => patch(setState, { description: event.target.value })}
        />
      </Field>
      <Field label="Price" hint="Needed for Google">
        <div className="grid max-w-xs grid-cols-[5rem_1fr] gap-2">
          <Input
            aria-label="Currency"
            className="font-mono"
            value={state.currencyCode}
            onChange={(event) => patch(setState, { currencyCode: event.target.value })}
          />
          <Input
            aria-label="Amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="tabular-nums"
            value={state.price}
            onChange={(event) => patch(setState, { price: event.target.value })}
          />
        </div>
      </Field>
      <MultiCheckboxGroup
        label="Dietary"
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
      <MultiCheckboxGroup
        label="Allergens"
        hint="Check with your kitchen before publishing"
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
    </div>
  );
}

/** Google-only item details: labels, spiciness, portion, nutrition, preparation, ingredients. */
export function GoogleItemDetailsFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
            inputMode="numeric"
            value={state.serves}
            onChange={(event) => patch(setState, { serves: event.target.value })}
          />
        </Field>
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
      />
      <Field label="Ingredients">
        <Input
          value={state.ingredients}
          onChange={(event) => patch(setState, { ingredients: event.target.value })}
          placeholder="Comma-separated ingredient labels"
        />
      </Field>
      <GoogleItemPortionFields setState={setState} state={state} />
      <GoogleItemNutritionFields setState={setState} state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary label language">
          <Input
            className="font-mono"
            value={state.languageCode}
            onChange={(event) => patch(setState, { languageCode: event.target.value })}
            placeholder="en-GB"
          />
        </Field>
        <Field label="Additional Google labels">
          <Textarea
            value={state.additionalLabels}
            onChange={(event) => patch(setState, { additionalLabels: event.target.value })}
            placeholder="fr-FR | Nom affiche | Description"
          />
        </Field>
      </div>
    </div>
  );
}

function GoogleItemPortionFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <h4 className="text-xs font-medium uppercase text-muted-foreground">
        Guest menu portion size
      </h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Quantity">
          <Input
            type="number"
            min="1"
            step="1"
            value={state.portionQuantity}
            onChange={(event) => patch(setState, { portionQuantity: event.target.value })}
            placeholder="1"
          />
        </Field>
        <Field label="Unit label">
          <Input
            value={state.portionUnitName}
            onChange={(event) => patch(setState, { portionUnitName: event.target.value })}
            placeholder="plate, pieces, skewers"
          />
        </Field>
        <Field label="Unit description">
          <Input
            value={state.portionUnitDescription}
            onChange={(event) => patch(setState, { portionUnitDescription: event.target.value })}
          />
        </Field>
        <Field label="Unit language">
          <Input
            value={state.portionUnitLanguageCode}
            onChange={(event) => patch(setState, { portionUnitLanguageCode: event.target.value })}
            placeholder="en-GB"
          />
        </Field>
      </div>
      <Field label="Additional unit labels" className="mt-3">
        <Textarea
          value={state.portionAdditionalUnits}
          onChange={(event) => patch(setState, { portionAdditionalUnits: event.target.value })}
          placeholder="fr-FR | morceaux | Description"
        />
      </Field>
    </div>
  );
}

function GoogleItemNutritionFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <h4 className="text-xs font-medium uppercase text-muted-foreground">
        Google nutrition facts
      </h4>
      <Text variant="caption" className="mt-1">
        Google menu publishing includes calories, total fat, cholesterol, sodium, total
        carbohydrate, and protein. Sugar, fibre, and saturated fat remain import-tolerated.
      </Text>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Calories">
          <NutritionRangeInputs
            lowerValue={state.calories}
            upperValue={state.caloriesUpper}
            unit={NUTRITION_UNITS.calorie}
            onLowerChange={(value) => patch(setState, { calories: value })}
            onUpperChange={(value) => patch(setState, { caloriesUpper: value })}
          />
        </Field>
        <Field label="Total fat">
          <NutritionRangeInputs
            lowerValue={state.totalFat}
            upperValue={state.totalFatUpper}
            unit={NUTRITION_UNITS.gram}
            onLowerChange={(value) => patch(setState, { totalFat: value })}
            onUpperChange={(value) => patch(setState, { totalFatUpper: value })}
          />
        </Field>
        <Field label="Cholesterol">
          <NutritionRangeInputs
            lowerValue={state.cholesterol}
            upperValue={state.cholesterolUpper}
            unit={NUTRITION_UNITS.milligram}
            onLowerChange={(value) => patch(setState, { cholesterol: value })}
            onUpperChange={(value) => patch(setState, { cholesterolUpper: value })}
          />
        </Field>
        <Field label="Sodium">
          <NutritionRangeInputs
            lowerValue={state.sodium}
            upperValue={state.sodiumUpper}
            unit={NUTRITION_UNITS.milligram}
            onLowerChange={(value) => patch(setState, { sodium: value })}
            onUpperChange={(value) => patch(setState, { sodiumUpper: value })}
          />
        </Field>
        <Field label="Total carbohydrate">
          <NutritionRangeInputs
            lowerValue={state.totalCarbohydrate}
            upperValue={state.totalCarbohydrateUpper}
            unit={NUTRITION_UNITS.gram}
            onLowerChange={(value) => patch(setState, { totalCarbohydrate: value })}
            onUpperChange={(value) => patch(setState, { totalCarbohydrateUpper: value })}
          />
        </Field>
        <Field label="Protein">
          <NutritionRangeInputs
            lowerValue={state.protein}
            upperValue={state.proteinUpper}
            unit={NUTRITION_UNITS.gram}
            onLowerChange={(value) => patch(setState, { protein: value })}
            onUpperChange={(value) => patch(setState, { proteinUpper: value })}
          />
        </Field>
      </div>
    </div>
  );
}
