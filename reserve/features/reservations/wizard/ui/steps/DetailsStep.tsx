'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import React, { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { track } from '@shared/lib/analytics';

import {
  detailsFormSchema,
  type DetailsFormInputValues,
  type DetailsFormValues,
} from '../../model/schemas';

import type { State, StepAction } from '../../model/reducer';
import type { WizardActions } from '../../model/store';

interface DetailsStepProps {
  state: State;
  actions: Pick<WizardActions, 'updateDetails' | 'goToStep'>;
  onActionsChange: (actions: StepAction[]) => void;
}

export function DetailsStep({ state, actions, onActionsChange }: DetailsStepProps) {
  const form = useForm<DetailsFormInputValues, unknown, DetailsFormValues>({
    resolver: zodResolver(detailsFormSchema),
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

  const normalizeValues = (values: DetailsFormInputValues): DetailsFormValues => ({
    ...values,
    rememberDetails: values.rememberDetails ?? true,
    marketingOptIn: values.marketingOptIn ?? true,
    agree: values.agree ?? false,
  });

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
    state.details.agree,
    state.details.email,
    state.details.marketingOptIn,
    state.details.name,
    state.details.phone,
    state.details.rememberDetails,
  ]);

  const updateField = useCallback(
    <K extends keyof State['details']>(key: K, value: State['details'][K]) => {
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

      track('details_submit', {
        marketing_opt_in: values.marketingOptIn ? 1 : 0,
        terms_checked: values.agree ? 1 : 0,
      });

      actions.goToStep(3);
    },
    [actions, updateField],
  );

  const { isSubmitting, isValid, errors } = form.formState;

  useEffect(() => {
    const submit = () => form.handleSubmit(handleSubmit, handleError)();
    const stepActions: StepAction[] = [
      {
        id: 'details-back',
        label: 'Back',
        icon: 'ChevronLeft',
        variant: 'outline',
        disabled: isSubmitting,
        onClick: handleBack,
      },
      {
        id: 'details-review',
        label: 'Review booking',
        icon: 'Check',
        variant: 'default',
        disabled: isSubmitting || !isValid,
        loading: isSubmitting,
        onClick: submit,
      },
    ];
    onActionsChange(stepActions);
  }, [form, handleBack, handleError, handleSubmit, isSubmitting, isValid, onActionsChange]);

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <CardTitle className="text-[clamp(1.75rem,1.45rem+0.6vw,2.2rem)] text-srx-ink-strong">
          Tell us how to reach you
        </CardTitle>
        <CardDescription className="text-body-sm text-srx-ink-soft">
          We’ll send confirmation and any updates to the contact details below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 md:space-y-8">
        <Form {...form}>
          <form
            className="space-y-6 md:space-y-8"
            onSubmit={form.handleSubmit(handleSubmit, handleError)}
            noValidate
          >
            <button type="submit" className="hidden" aria-hidden />

            <section className="space-y-4 rounded-xl border border-srx-border-subtle bg-white/95 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-srx-ink-strong">Contact details</h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Jane Smith"
                          autoComplete="name"
                          value={field.value}
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next);
                            updateField('name', next);
                          }}
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.name?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          value={field.value}
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next);
                            updateField('email', next);
                          }}
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.email?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UK phone number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="07123 456789"
                          autoComplete="tel"
                          inputMode="tel"
                          value={field.value}
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next);
                            updateField('phone', next);
                          }}
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.phone?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-srx-border-subtle bg-white/95 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-srx-ink-strong">Preferences</h3>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="rememberDetails"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3 rounded-xl bg-white/70 p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onChange={(event) => {
                            const next = event.target.checked;
                            field.onChange(next);
                            updateField('rememberDetails', next);
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel className="text-body-sm font-medium text-srx-ink-strong">
                          Save contact details for next time
                        </FormLabel>
                        <FormDescription>
                          We’ll pre-fill your info the next time you book on this device.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="marketingOptIn"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3 rounded-xl bg-white/70 p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onChange={(event) => {
                            const next = event.target.checked;
                            field.onChange(next);
                            updateField('marketingOptIn', next);
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel className="text-body-sm font-medium text-srx-ink-strong">
                          Send me occasional updates
                        </FormLabel>
                        <FormDescription>
                          News on seasonal menus, experiences, and exclusive events.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agree"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <div className="flex items-start gap-3 rounded-xl border border-srx-border-strong bg-srx-surface-positive-alt/50 p-4 text-body-sm text-srx-ink-soft">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onChange={(event) => {
                              const next = event.target.checked;
                              field.onChange(next);
                              updateField('agree', next);
                            }}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel className="text-body-sm font-semibold text-srx-ink-strong">
                            I agree to the terms and privacy notice
                          </FormLabel>
                          <FormDescription>
                            Required to confirm your booking. View our
                            <a
                              href="/terms"
                              className="ml-1 text-srx-ink-strong underline underline-offset-4"
                            >
                              terms
                            </a>
                            and
                            <a
                              href="/privacy-policy"
                              className="ml-1 text-srx-ink-strong underline underline-offset-4"
                            >
                              privacy policy
                            </a>
                            .
                          </FormDescription>
                        </div>
                      </div>
                      <FormMessage className="sr-only">{errors.agree?.message}</FormMessage>
                      {errors.agree ? (
                        <Alert
                          variant="destructive"
                          role="alert"
                          className="flex items-start gap-3"
                        >
                          <AlertIcon>
                            <AlertCircle className="h-4 w-4" aria-hidden />
                          </AlertIcon>
                          <AlertDescription>{errors.agree.message}</AlertDescription>
                        </Alert>
                      ) : null}
                    </FormItem>
                  )}
                />
              </div>
            </section>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
