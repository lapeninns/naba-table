'use client';

import { AlertCircle } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@shared/ui/accordion';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Checkbox } from '@shared/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@shared/ui/form';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';

import { useWizardNavigation } from '../../context/WizardContext';
import { useWizardDependencies } from '../../di';
import { useDetailsStepForm } from '../../hooks/useDetailsStepForm';
import { StepErrorBoundary } from '../ErrorBoundary';
import { WizardStep } from '../WizardStep';

import type { DetailsStepProps } from './details-step/types';

const CONTACT_SECTION_CLASS = 'luminous-card space-y-4 rounded-[var(--luminous-radius)] p-4 sm:p-5';
const basePreferenceLabelClass =
  'flex w-full items-start gap-3 rounded-[var(--luminous-radius)] p-3 transition-colors has-[[aria-checked=true]]:bg-[rgba(0,64,161,0.08)]';

const optionalPreferenceLabelClass = (checked: boolean) =>
  cn(basePreferenceLabelClass, checked ? '' : 'bg-[var(--luminous-surface-low)]');

const requiredPreferenceLabelClass = (checked: boolean) =>
  cn(
    basePreferenceLabelClass,
    checked ? '' : 'bg-destructive/10 text-destructive-foreground dark:text-destructive-foreground',
  );

export function DetailsStep({ mode = 'customer', ...props }: DetailsStepProps) {
  const { analytics } = useWizardDependencies();
  const { goToStep } = useWizardNavigation();
  const controller = useDetailsStepForm({
    ...props,
    mode,
    onTrack: props.onTrack ?? analytics.track,
  });
  const { form, handleSubmit, handleError, handlers } = controller;
  const { errors } = form.formState;
  const rememberDetailsValue = useWatch({ control: form.control, name: 'rememberDetails' });
  const marketingOptInValue = useWatch({ control: form.control, name: 'marketingOptIn' });
  const agreeValue = useWatch({ control: form.control, name: 'agree' });
  const contactLocks = props.contactLocks ?? {};
  const isNameLocked = Boolean(contactLocks.name);
  const isEmailLocked = Boolean(contactLocks.email);
  const isPhoneLocked = Boolean(contactLocks.phone);

  const preferenceSummary = useMemo(() => {
    const parts = [
      rememberDetailsValue ? 'Details saved' : 'Details not saved',
      marketingOptInValue ? 'Updates on' : 'Updates off',
      agreeValue ? 'Terms accepted' : 'Terms pending',
    ];
    return parts.join(' • ');
  }, [rememberDetailsValue, marketingOptInValue, agreeValue]);

  const [accordionValue, setAccordionValue] = useState<string | undefined>();

  useEffect(() => {
    if (errors.agree) {
      setAccordionValue('preferences');
    }
  }, [errors.agree]);

  const description =
    mode === 'ops'
      ? 'Add contact details if you want confirmations. Leave blank for in-venue walk-ins.'
      : 'We’ll send confirmation and any updates to the contact details below.';

  return (
    <StepErrorBoundary
      stepName="Tell us how to reach you"
      onReset={() => {
        goToStep(2);
      }}
    >
      <WizardStep
        step={2}
        title="Tell us how to reach you"
        description={description}
        contentClassName="space-y-5"
      >
        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(handleSubmit, handleError)}
            noValidate
          >
            <button type="submit" className="hidden" aria-hidden />

            <section className={CONTACT_SECTION_CLASS}>
              <div className="space-y-1">
                <p className="luminous-kicker">Contact details</p>
                <h3 className="text-base font-semibold text-foreground sm:text-lg">
                  Where should we send your confirmation?
                </h3>
                {mode === 'ops' ? (
                  <p className="text-sm text-muted-foreground">
                    At least one contact method is required for a follow-up.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Jane Smith"
                          autoComplete="name"
                          value={field.value}
                          disabled={isNameLocked}
                          className="luminous-input border-0 shadow-none"
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next);
                            handlers.changeName(next);
                          }}
                        />
                      </FormControl>
                      <FormMessage>{errors.name?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address{mode === 'ops' ? ' (optional)' : ''}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          value={field.value}
                          disabled={isEmailLocked}
                          className="luminous-input border-0 shadow-none"
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next);
                            handlers.changeEmail(next);
                          }}
                        />
                      </FormControl>
                      {isEmailLocked ? (
                        <FormDescription className="text-xs text-muted-foreground">
                          Email is linked to your account. Update it from your profile to change it.
                        </FormDescription>
                      ) : mode === 'ops' && !errors.email ? (
                        <FormDescription className="text-xs text-muted-foreground">
                          Optional if phone number is provided
                        </FormDescription>
                      ) : null}
                      <FormMessage>{errors.email?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UK phone number{mode === 'ops' ? ' (optional)' : ''}</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="07123 456789"
                          autoComplete="tel"
                          inputMode="tel"
                          value={field.value}
                          disabled={isPhoneLocked}
                          className="luminous-input border-0 shadow-none"
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next);
                            handlers.changePhone(next);
                          }}
                        />
                      </FormControl>
                      {mode === 'ops' && !errors.phone ? (
                        <FormDescription className="text-xs text-muted-foreground">
                          Optional if email address is provided
                        </FormDescription>
                      ) : null}
                      <FormMessage>{errors.phone?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className={CONTACT_SECTION_CLASS}>
              <div className="space-y-1">
                <p className="luminous-kicker">Booking preferences</p>
                <h3 className="text-base font-semibold text-foreground sm:text-lg">
                  Keep the confirmation practical
                </h3>
              </div>
              <Accordion
                type="single"
                collapsible
                value={accordionValue}
                onValueChange={(next) => setAccordionValue(next ?? undefined)}
                className="w-full"
              >
                <AccordionItem value="preferences">
                  <AccordionTrigger>
                    <span className="flex flex-col text-left">
                      <span className="text-base font-semibold text-foreground">Preferences</span>
                      <span
                        className={
                          agreeValue ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'
                        }
                      >
                        {preferenceSummary}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      <FormField
                        control={form.control}
                        name="rememberDetails"
                        render={({ field }) => {
                          return (
                            <FormItem className="space-y-1">
                              <Label className={optionalPreferenceLabelClass(Boolean(field.value))}>
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(next) => {
                                      const value = next === true;
                                      field.onChange(value);
                                      handlers.toggleRemember(value);
                                    }}
                                    className="h-4 w-4 rounded-[4px] border border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                  />
                                </FormControl>
                                <div className="space-y-1">
                                  <span className="text-sm font-semibold text-foreground">
                                    Save contact details for next time
                                  </span>
                                  <p className="text-sm text-muted-foreground">
                                    Stores on this device for 6 hours; uncheck to remove sooner.
                                  </p>
                                </div>
                              </Label>
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name="marketingOptIn"
                        render={({ field }) => {
                          return (
                            <FormItem className="space-y-1">
                              <Label className={optionalPreferenceLabelClass(Boolean(field.value))}>
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(next) => {
                                      const value = next === true;
                                      field.onChange(value);
                                      handlers.toggleMarketing(value);
                                    }}
                                    className="h-4 w-4 rounded-[4px] border border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                  />
                                </FormControl>
                                <div className="space-y-1">
                                  <span className="text-sm font-semibold text-foreground">
                                    Send me occasional updates
                                  </span>
                                  <p className="text-sm text-muted-foreground">
                                    News on seasonal menus, experiences, and exclusive events.
                                  </p>
                                </div>
                              </Label>
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name="agree"
                        render={({ field }) => {
                          return (
                            <FormItem className="space-y-3">
                              <Label className={requiredPreferenceLabelClass(Boolean(field.value))}>
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(next) => {
                                      const value = next === true;
                                      field.onChange(value);
                                      handlers.toggleAgree(value);
                                    }}
                                    className="h-4 w-4 rounded-[4px] border border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                  />
                                </FormControl>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  <span className="text-foreground font-semibold">
                                    I agree to the terms and privacy notice
                                  </span>
                                  <span>
                                    Required to confirm your booking. View our
                                    <a
                                      href="/terms"
                                      className="ml-1 text-foreground underline underline-offset-4"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      terms
                                    </a>
                                    and
                                    <a
                                      href="/privacy-policy"
                                      className="ml-1 text-foreground underline underline-offset-4"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      privacy policy
                                    </a>
                                    .
                                  </span>
                                </div>
                              </Label>
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
                          );
                        }}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>
          </form>
        </Form>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { DetailsStepProps } from './details-step/types';
