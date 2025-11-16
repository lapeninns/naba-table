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

const CONTACT_SECTION_CLASS = 'space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm';
const basePreferenceLabelClass =
  'hover:bg-accent/50 flex w-full items-start gap-3 rounded-lg border p-3 transition-colors has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/10 dark:has-[[aria-checked=true]]:border-primary/60 dark:has-[[aria-checked=true]]:bg-primary/20';

const optionalPreferenceLabelClass = (checked: boolean) =>
  cn(basePreferenceLabelClass, checked ? 'border-primary/60' : 'border-border bg-muted/40');

const requiredPreferenceLabelClass = (checked: boolean) =>
  cn(
    basePreferenceLabelClass,
    checked
      ? 'border-primary/60'
      : 'border-destructive/40 bg-destructive/10 text-destructive-foreground dark:text-destructive-foreground',
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
        description="We’ll send confirmation and any updates to the contact details below."
        contentClassName="space-y-6 md:space-y-8"
      >
        <Form {...form}>
          <form
            className="space-y-6 md:space-y-8"
            onSubmit={form.handleSubmit(handleSubmit, handleError)}
            noValidate
          >
            <button type="submit" className="hidden" aria-hidden />

            <section className={CONTACT_SECTION_CLASS}>
              <h3 className="text-lg font-semibold text-foreground">Contact details</h3>
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
                          disabled={isNameLocked}
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
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next);
                            handlers.changePhone(next);
                          }}
                        />
                      </FormControl>
                      <FormMessage>{errors.phone?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className={CONTACT_SECTION_CLASS}>
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
                          const checkboxId = 'remember-details';
                          return (
                            <FormItem className="space-y-1">
                              <Label
                                htmlFor={checkboxId}
                                className={optionalPreferenceLabelClass(Boolean(field.value))}
                              >
                                <FormControl>
                                  <Checkbox
                                    id={checkboxId}
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
                          const checkboxId = 'marketing-opt-in';
                          return (
                            <FormItem className="space-y-1">
                              <Label
                                htmlFor={checkboxId}
                                className={optionalPreferenceLabelClass(Boolean(field.value))}
                              >
                                <FormControl>
                                  <Checkbox
                                    id={checkboxId}
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
                          const checkboxId = 'agree-terms';
                          return (
                            <FormItem className="space-y-3">
                              <Label
                                htmlFor={checkboxId}
                                className={requiredPreferenceLabelClass(Boolean(field.value))}
                              >
                                <FormControl>
                                  <Checkbox
                                    id={checkboxId}
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
