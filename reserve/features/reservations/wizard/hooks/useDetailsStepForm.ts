'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { isUKPhone } from '@reserve/shared/validation';
import { track } from '@shared/lib/analytics';

import { useWizardActions, useWizardState } from '../context/WizardContext';
import { buildAcceptedDetailsValues } from '../model/detailsConsent';
import {
  createDetailsContactSchema,
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
  if (!state || !actions) {
    throw new Error(
      'useDetailsStepForm requires explicit state/actions props or a WizardProvider ancestor.',
    );
  }
  const [consentOpen, setConsentOpen] = useState(false);
  const contactSchema = useMemo(() => createDetailsContactSchema(), []);
  const schema = useMemo(() => createDetailsFormSchema(mode), [mode]);
  const form = useForm<DetailsFormInputValues, unknown, DetailsFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onBlur',
    defaultValues: {
      name: state.details.name ?? '',
      email: state.details.email ?? '',
      phone: state.details.phone ?? '',
      rememberDetails: state.details.rememberDetails ?? false,
      marketingOptIn: state.details.marketingOptIn ?? false,
      whatsappOptIn: state.details.whatsappOptIn ?? false,
      agree: state.details.agree ?? false,
    },
  });

  const normalizeValues = useCallback(
    (values: DetailsFormInputValues): DetailsFormValues => ({
      ...values,
      rememberDetails: values.rememberDetails ?? false,
      marketingOptIn: values.marketingOptIn ?? false,
      whatsappOptIn: values.whatsappOptIn ?? false,
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
      rememberDetails: state.details.rememberDetails ?? false,
      marketingOptIn: state.details.marketingOptIn ?? false,
      whatsappOptIn: state.details.whatsappOptIn ?? false,
      agree: state.details.agree ?? false,
    };
    const next = normalizeValues(nextInput);

    if (
      current.name !== next.name ||
      current.email !== next.email ||
      current.phone !== next.phone ||
      current.rememberDetails !== next.rememberDetails ||
      current.marketingOptIn !== next.marketingOptIn ||
      current.whatsappOptIn !== next.whatsappOptIn ||
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
    state.details.whatsappOptIn,
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
      updateField('whatsappOptIn', values.whatsappOptIn);
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
  const [name, email, phone] = useWatch({
    control: form.control,
    name: ['name', 'email', 'phone'],
  });
  const isContactValid = contactSchema.safeParse({ name, email, phone }).success;

  const handleReview = useCallback(() => {
    if (mode === 'ops') {
      form.handleSubmit(handleSubmit, handleError)();
      return;
    }

    const result = contactSchema.safeParse(form.getValues());
    form.clearErrors(['name', 'email', 'phone']);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const nameError = errors.name?.[0];
      const emailError = errors.email?.[0];
      const phoneError = errors.phone?.[0];
      if (nameError) {
        form.setError('name', { message: nameError });
        form.setFocus('name', { shouldSelect: true });
      }
      if (emailError) {
        form.setError('email', { message: emailError });
        if (!nameError) {
          form.setFocus('email', { shouldSelect: true });
        }
      }
      if (phoneError) {
        form.setError('phone', { message: phoneError });
        if (!nameError && !emailError) {
          form.setFocus('phone', { shouldSelect: true });
        }
      }
      return;
    }

    setConsentOpen(true);
  }, [contactSchema, form, handleError, handleSubmit, mode]);

  const handleConfirmConsent = useCallback(() => {
    form.handleSubmit(handleSubmit, handleError)();
  }, [form, handleError, handleSubmit]);

  const handleAcceptAllAndContinue = useCallback(() => {
    const hasValidWhatsAppPhone = isUKPhone(form.getValues('phone').trim());
    const acceptedValues = buildAcceptedDetailsValues(form.getValues(), hasValidWhatsAppPhone);

    form.setValue('agree', acceptedValues.agree, { shouldDirty: true });
    form.setValue('rememberDetails', acceptedValues.rememberDetails, { shouldDirty: true });
    form.setValue('marketingOptIn', acceptedValues.marketingOptIn, { shouldDirty: true });
    form.setValue('whatsappOptIn', hasValidWhatsAppPhone, {
      shouldDirty: true,
    });
    handleSubmit(acceptedValues);
  }, [form, handleSubmit]);

  const handlePhoneChange = useCallback(
    (value: string) => {
      if (value !== state.details.phone && form.getValues('whatsappOptIn')) {
        form.setValue('whatsappOptIn', false, {
          shouldDirty: true,
          shouldValidate: true,
        });
        updateField('whatsappOptIn', false);
      }
      updateField('phone', value);
    },
    [form, state.details.phone, updateField],
  );

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
        disabled: isSubmitting || (mode === 'ops' ? !isValid : !isContactValid),
        loading: isSubmitting,
        onClick: handleReview,
        role: 'primary',
      },
    ],
    [handleBack, handleReview, isContactValid, isSubmitting, isValid, mode],
  );

  useEffect(() => {
    onActionsChange(detailsActions);
  }, [detailsActions, onActionsChange]);

  return {
    form,
    handleBack,
    handleReview,
    handleConfirmConsent,
    handleConsentOpenChange: setConsentOpen,
    handleAcceptAllAndContinue,
    handleSubmit,
    handleError,
    consentOpen,
    isSubmitting,
    isContactValid,
    isValid,
    handlers: {
      changeName: (value: string) => updateField('name', value),
      changeEmail: (value: string) => updateField('email', value),
      changePhone: handlePhoneChange,
      toggleRemember: (value: boolean) => updateField('rememberDetails', value),
      toggleMarketing: (value: boolean) => updateField('marketingOptIn', value),
      toggleWhatsApp: (value: boolean) => updateField('whatsappOptIn', value),
      toggleAgree: (value: boolean) => updateField('agree', value),
    },
  };
}
