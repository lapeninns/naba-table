'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { track } from '@shared/lib/analytics';

import { useWizardActions, useWizardState } from '../context/WizardContext';
import {
  createDetailsFormSchema,
  type DetailsFormInputValues,
  type DetailsFormValues,
} from '../model/schemas';

import type { BookingDetails, StepAction } from '../model/reducer';
import type { DetailsStepProps, DetailsStepController } from '../ui/steps/details-step/types';

export function useDetailsStepForm({
  state: providedState,
  actions: providedActions,
  onActionsChange,
  onTrack = track,
  mode = 'customer',
}: DetailsStepProps): DetailsStepController {
  const contextState = useWizardState();
  const contextActions = useWizardActions();
  const state = providedState ?? contextState;
  const actions = providedActions ?? contextActions;
  const schema = useMemo(() => createDetailsFormSchema(mode), [mode]);
  const form = useForm<DetailsFormInputValues, unknown, DetailsFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onBlur',
    defaultValues: {
      name: state.details.name ?? '',
      email: state.details.email ?? '',
      phone: state.details.phone ?? '',
      rememberDetails: state.details.rememberDetails ?? true,
      marketingOptIn: state.details.marketingOptIn ?? true,
      agree: state.details.agree ?? false,
    },
  });

  const normalizeValues = useCallback(
    (values: DetailsFormInputValues): DetailsFormValues => ({
      ...values,
      rememberDetails: values.rememberDetails ?? true,
      marketingOptIn: values.marketingOptIn ?? true,
      agree: values.agree ?? false,
    }),
    [],
  );

  useEffect(() => {
    const current = normalizeValues(form.getValues());
    const nextInput: DetailsFormInputValues = {
      name: state.details.name ?? '',
      email: state.details.email ?? '',
      phone: state.details.phone ?? '',
      rememberDetails: state.details.rememberDetails ?? true,
      marketingOptIn: state.details.marketingOptIn ?? true,
      agree: state.details.agree ?? false,
    };
    const next = normalizeValues(nextInput);

    if (
      current.name !== next.name ||
      current.email !== next.email ||
      current.phone !== next.phone ||
      current.rememberDetails !== next.rememberDetails ||
      current.marketingOptIn !== next.marketingOptIn ||
      current.agree !== next.agree
    ) {
      form.reset(nextInput, { keepDirty: false, keepTouched: false });
    }
  }, [
    form,
    normalizeValues,
    state.details.agree,
    state.details.email,
    state.details.marketingOptIn,
    state.details.name,
    state.details.phone,
    state.details.rememberDetails,
  ]);

  const updateField = useCallback(
    <K extends keyof BookingDetails>(key: K, value: BookingDetails[K]) => {
      actions.updateDetails(key, value);
    },
    [actions],
  );

  const handleBack = useCallback(() => {
    actions.goToStep(1);
  }, [actions]);

  const handleError = useCallback(
    (errors: Record<string, unknown>) => {
      const firstKey = Object.keys(errors)[0];
      if (firstKey) {
        form.setFocus(firstKey as keyof DetailsFormValues, { shouldSelect: true });
      }
    },
    [form],
  );

  const handleSubmit = useCallback(
    (values: DetailsFormValues) => {
      const trimmedName = values.name.trim();
      const trimmedEmail = values.email.trim();
      const trimmedPhone = values.phone.trim();

      updateField('name', trimmedName);
      updateField('email', trimmedEmail);
      updateField('phone', trimmedPhone);
      updateField('rememberDetails', values.rememberDetails);
      updateField('marketingOptIn', values.marketingOptIn);
      updateField('agree', values.agree);

      onTrack('details_submit', {
        marketing_opt_in: values.marketingOptIn ? 1 : 0,
        terms_checked: values.agree ? 1 : 0,
      });

      actions.goToStep(3);
    },
    [actions, onTrack, updateField],
  );

  const { isSubmitting, isValid } = form.formState;

  const handleReview = useCallback(() => {
    form.handleSubmit(handleSubmit, handleError)();
  }, [form, handleError, handleSubmit]);

  const detailsActions = useMemo<StepAction[]>(
    () => [
      {
        id: 'details-back',
        label: 'Back',
        icon: 'ChevronLeft',
        variant: 'outline',
        disabled: isSubmitting,
        onClick: handleBack,
        role: 'secondary',
      },
      {
        id: 'details-review',
        label: 'Review booking',
        icon: 'Check',
        variant: 'default',
        disabled: isSubmitting || !isValid,
        loading: isSubmitting,
        onClick: handleReview,
        role: 'primary',
      },
    ],
    [handleBack, handleReview, isSubmitting, isValid],
  );

  useEffect(() => {
    onActionsChange(detailsActions);
  }, [detailsActions, onActionsChange]);

  return {
    form,
    handleBack,
    handleSubmit,
    handleError,
    isSubmitting,
    isValid,
    handlers: {
      changeName: (value: string) => updateField('name', value),
      changeEmail: (value: string) => updateField('email', value),
      changePhone: (value: string) => updateField('phone', value),
      toggleRemember: (value: boolean) => updateField('rememberDetails', value),
      toggleMarketing: (value: boolean) => updateField('marketingOptIn', value),
      toggleAgree: (value: boolean) => updateField('agree', value),
    },
  };
}
