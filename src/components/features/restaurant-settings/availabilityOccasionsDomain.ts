import {
  buildAvailabilityRules,
  createRuleDraft,
  createEmptyOccasionForm,
  toRuleDrafts,
  type OccasionFormErrors,
  type OccasionFormState,
  type RuleDraft,
} from './availabilityOccasionsModel';

import type { OpsOccasion } from '@/services/ops/occasions';
import type { OccasionDefinition } from '@reserve/shared/occasions';

type AvailabilityRules = OccasionDefinition['availability'];

type OccasionSubmitValues = {
  availability: AvailabilityRules;
  defaultDurationMinutes: number;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  key: string;
  label: string;
  shortLabel: string;
};

export type OccasionSubmitResult =
  | {
      ok: true;
      submittedKey: string;
      values: OccasionSubmitValues;
    }
  | {
      ok: false;
      errors: OccasionFormErrors;
    };

export function getNextOccasionDisplayOrder(occasions: OpsOccasion[]): number {
  if (occasions.length === 0) {
    return 10;
  }
  return Math.max(...occasions.map((item) => item.displayOrder)) + 10;
}

export function createOccasionFormForCreate(occasions: OpsOccasion[]): OccasionFormState {
  return {
    ...createEmptyOccasionForm(),
    displayOrder: getNextOccasionDisplayOrder(occasions),
  };
}

export function createOccasionFormForEdit(
  occasion: OpsOccasion,
  turnBands: OccasionFormState['turnBands'],
): OccasionFormState {
  return {
    key: occasion.key,
    label: occasion.label,
    shortLabel: occasion.shortLabel,
    description: occasion.description ?? '',
    defaultDurationMinutes: occasion.defaultDurationMinutes,
    displayOrder: occasion.displayOrder,
    availabilityRules: toRuleDrafts(occasion.availability),
    isActive: occasion.isActive,
    turnBands,
  };
}

export function buildOccasionSubmitResult(
  form: OccasionFormState,
  editingKey: string | null,
): OccasionSubmitResult {
  const errors: OccasionFormErrors = {};
  if (!form.label.trim()) {
    errors.label = 'Label is required';
  }
  if (!editingKey && !form.key.trim()) {
    errors.key = 'Key is required';
  }
  if (!editingKey && form.key.trim() && !/^[a-z0-9_-]+$/.test(form.key.trim())) {
    errors.key = 'Use lowercase letters, numbers, dashes, and underscores';
  }

  const availabilityBuild = buildAvailabilityRules(form.availabilityRules);
  if (!availabilityBuild.valid) {
    errors.availability = availabilityBuild.error;
  }

  if (Object.keys(errors).length > 0 || !availabilityBuild.valid) {
    return { ok: false, errors };
  }

  const label = form.label.trim();
  const submittedKey = editingKey ?? form.key.trim();

  return {
    ok: true,
    submittedKey,
    values: {
      key: submittedKey,
      label,
      shortLabel: form.shortLabel.trim() || label,
      description: form.description.trim() || null,
      availability: availabilityBuild.rules,
      defaultDurationMinutes: form.defaultDurationMinutes,
      displayOrder: form.displayOrder,
      isActive: form.isActive,
    },
  };
}

export function updateOccasionFromSubmitValues(
  occasion: OpsOccasion,
  values: OccasionSubmitValues,
): OpsOccasion {
  return {
    ...occasion,
    label: values.label,
    shortLabel: values.shortLabel,
    description: values.description,
    availability: values.availability,
    defaultDurationMinutes: values.defaultDurationMinutes,
    displayOrder: values.displayOrder,
    isActive: values.isActive,
  };
}

export function createOccasionFromSubmitValues(values: OccasionSubmitValues): OpsOccasion {
  return {
    key: values.key,
    label: values.label,
    shortLabel: values.shortLabel,
    description: values.description,
    availability: values.availability,
    defaultDurationMinutes: values.defaultDurationMinutes,
    displayOrder: values.displayOrder,
    isActive: values.isActive,
    isBuiltin: false,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
  };
}

export function addAvailabilityRuleDraft(rules: RuleDraft[]): RuleDraft[] {
  return [...rules, createRuleDraft('anytime')];
}

export function updateAvailabilityRuleDraft(
  rules: RuleDraft[],
  ruleId: string,
  patch: Partial<RuleDraft>,
): RuleDraft[] {
  return rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule));
}

export function replaceAvailabilityRuleDraftKind(
  rules: RuleDraft[],
  ruleId: string,
  kind: RuleDraft['kind'],
): RuleDraft[] {
  return rules.map((rule) =>
    rule.id === ruleId ? { ...createRuleDraft(kind), id: rule.id } : rule,
  );
}

export function removeAvailabilityRuleDraft(rules: RuleDraft[], ruleId: string): RuleDraft[] {
  const nextRules = rules.filter((rule) => rule.id !== ruleId);
  return nextRules.length > 0 ? nextRules : [createRuleDraft('anytime')];
}

export function addSpecificDateToAvailabilityRuleDraft(
  rules: RuleDraft[],
  ruleId: string,
): RuleDraft[] {
  return rules.map((rule) => {
    if (rule.id !== ruleId || !rule.pendingDate) {
      return rule;
    }
    return {
      ...rule,
      specificDates: Array.from(new Set([...rule.specificDates, rule.pendingDate])).sort(),
      pendingDate: '',
    };
  });
}

export function removeSpecificDateFromAvailabilityRuleDraft(
  rules: RuleDraft[],
  ruleId: string,
  date: string,
): RuleDraft[] {
  return rules.map((rule) =>
    rule.id === ruleId
      ? { ...rule, specificDates: rule.specificDates.filter((value) => value !== date) }
      : rule,
  );
}

export function toggleAvailabilityRuleDraftMonth(
  rules: RuleDraft[],
  ruleId: string,
  month: number,
): RuleDraft[] {
  return rules.map((rule) => {
    if (rule.id !== ruleId) {
      return rule;
    }
    const hasMonth = rule.months.includes(month);
    return {
      ...rule,
      months: hasMonth
        ? rule.months.filter((value) => value !== month)
        : [...rule.months, month].sort((left, right) => left - right),
    };
  });
}
