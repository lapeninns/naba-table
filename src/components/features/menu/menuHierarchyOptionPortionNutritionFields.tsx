'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/typography';

import { NUTRITION_UNITS, type OptionFormState } from './menuHierarchyDomain';
import { Field, NutritionRangeInputs } from './menuHierarchyFormControls';

import type { Dispatch, SetStateAction } from 'react';

type OptionStateSetter = Dispatch<SetStateAction<OptionFormState>>;

function patch(setState: OptionStateSetter, update: Partial<OptionFormState>) {
  setState((current) => ({ ...current, ...update }));
}

export function OptionPortionNutritionFields({
  setState,
  state,
}: {
  readonly setState: OptionStateSetter;
  readonly state: OptionFormState;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <Text variant="subheading" as="h3">Option portion and nutrition</Text>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Field label="Portion quantity">
          <Input
            type="number"
            min="1"
            step="1"
            value={state.portionQuantity}
            onChange={(event) => patch(setState, { portionQuantity: event.target.value })}
            placeholder="1"
          />
        </Field>
        <Field label="Portion unit">
          <Input
            value={state.portionUnitName}
            onChange={(event) => patch(setState, { portionUnitName: event.target.value })}
            placeholder="pieces"
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
      <div className="mt-4 grid gap-3 md:grid-cols-3">
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
