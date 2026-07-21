import { Plus } from 'lucide-react';
import { type Dispatch, type SetStateAction } from 'react';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';

import {
  addAvailabilityRuleDraft,
  addSpecificDateToAvailabilityRuleDraft,
  removeAvailabilityRuleDraft,
  removeSpecificDateFromAvailabilityRuleDraft,
  replaceAvailabilityRuleDraftKind,
  toggleAvailabilityRuleDraftMonth,
  updateAvailabilityRuleDraft,
} from './availabilityOccasionsDomain';
import {
  type OccasionFormErrors,
  type OccasionFormState,
  type RuleDraft,
} from './availabilityOccasionsModel';
import { AvailabilityRuleEditor } from './AvailabilityRuleEditor';

type AvailabilityOccasionRulesSectionProps = {
  availabilityPreview: string;
  form: OccasionFormState;
  formErrors: OccasionFormErrors;
  onFormChange: Dispatch<SetStateAction<OccasionFormState>>;
};

export function AvailabilityOccasionRulesSection({
  availabilityPreview,
  form,
  formErrors,
  onFormChange,
}: AvailabilityOccasionRulesSectionProps) {
  const updateRule = (ruleId: string, patch: Partial<RuleDraft>) => {
    onFormChange((current) => ({
      ...current,
      availabilityRules: updateAvailabilityRuleDraft(current.availabilityRules, ruleId, patch),
    }));
  };

  const replaceRuleKind = (ruleId: string, kind: RuleDraft['kind']) => {
    onFormChange((current) => ({
      ...current,
      availabilityRules: replaceAvailabilityRuleDraftKind(current.availabilityRules, ruleId, kind),
    }));
  };

  const removeRule = (ruleId: string) => {
    onFormChange((current) => ({
      ...current,
      availabilityRules: removeAvailabilityRuleDraft(current.availabilityRules, ruleId),
    }));
  };

  const addSpecificDate = (ruleId: string) => {
    onFormChange((current) => ({
      ...current,
      availabilityRules: addSpecificDateToAvailabilityRuleDraft(current.availabilityRules, ruleId),
    }));
  };

  const removeSpecificDate = (ruleId: string, date: string) => {
    onFormChange((current) => ({
      ...current,
      availabilityRules: removeSpecificDateFromAvailabilityRuleDraft(
        current.availabilityRules,
        ruleId,
        date,
      ),
    }));
  };

  const toggleMonth = (ruleId: string, month: number) => {
    onFormChange((current) => ({
      ...current,
      availabilityRules: toggleAvailabilityRuleDraftMonth(current.availabilityRules, ruleId, month),
    }));
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Text variant="label">Availability rules</Text>
          <Text variant="caption">
            Describe when guests should be able to choose this occasion.
          </Text>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onFormChange((current) => ({
              ...current,
              availabilityRules: addAvailabilityRuleDraft(current.availabilityRules),
            }))
          }
        >
          <Plus data-icon="inline-start" aria-hidden />
          Add rule
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {form.availabilityRules.map((rule, index) => (
          <AvailabilityRuleEditor
            key={rule.id}
            canRemove={form.availabilityRules.length > 1}
            index={index}
            rule={rule}
            onAddSpecificDate={addSpecificDate}
            onRemove={removeRule}
            onRemoveSpecificDate={removeSpecificDate}
            onReplaceKind={replaceRuleKind}
            onToggleMonth={toggleMonth}
            onUpdate={updateRule}
          />
        ))}
      </div>

      {formErrors.availability ? (
        <Text variant="caption" className="text-destructive">{formErrors.availability}</Text>
      ) : null}

      <div className="rounded-md border border-dashed border-border/70 bg-background/80 p-3">
        <Text variant="eyebrow">
          Guest-facing summary
        </Text>
        <Text variant="caption" className="mt-1 text-foreground">{availabilityPreview}</Text>
      </div>
    </div>
  );
}
