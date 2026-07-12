'use client';

import { AlertCircle, Mail, Phone, UserRound } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRoot,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { isUKPhone } from '@reserve/shared/validation';

import { useWizardNavigation, useWizardState } from '../../context/WizardContext';
import { useWizardDependencies } from '../../di';
import { useDetailsStepForm } from '../../hooks/useDetailsStepForm';
import { StepErrorBoundary } from '../ErrorBoundary';
import { WizardPanel, WizardPanelContent, WizardPanelHeader } from '../WizardPanel';
import { WizardStep } from '../WizardStep';

import type { DetailsStepProps } from './details-step/types';

const basePreferenceLabelClass =
  'hover:bg-accent/50 flex min-h-11 w-full items-start gap-3 rounded-lg border p-3 transition-colors has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/10 dark:has-[[aria-checked=true]]:border-primary/60 dark:has-[[aria-checked=true]]:bg-primary/20';

const optionalPreferenceLabelClass = (checked: boolean) =>
  cn(basePreferenceLabelClass, checked ? 'border-primary/60' : 'border-border bg-muted/40');

const requiredPreferenceLabelClass = (invalid: boolean) =>
  cn(
    basePreferenceLabelClass,
    invalid
      ? 'border-destructive/40 bg-destructive/10 text-destructive-foreground dark:text-destructive-foreground'
      : 'border-border bg-muted/40',
  );

export function DetailsStep({ mode = 'customer', ...props }: DetailsStepProps) {
  const { analytics } = useWizardDependencies();
  const { goToStep } = useWizardNavigation();
  const contextState = useWizardState();
  const controller = useDetailsStepForm({
    ...props,
    mode,
    onTrack: props.onTrack ?? analytics.track,
  });
  const { form, handleSubmit, handleError, handlers, isValid } = controller;
  const { errors } = form.formState;
  const isOpsMode = mode === 'ops';
  const rememberDetailsValue = useWatch({ control: form.control, name: 'rememberDetails' });
  const marketingOptInValue = useWatch({ control: form.control, name: 'marketingOptIn' });
  const phoneValue = useWatch({ control: form.control, name: 'phone' });
  const hasValidWhatsAppPhone = isUKPhone(phoneValue?.trim() ?? '');
  const contactLocks = props.contactLocks ?? {};
  const isNameLocked = Boolean(contactLocks.name);
  const isEmailLocked = Boolean(contactLocks.email);
  const isPhoneLocked = Boolean(contactLocks.phone);

  const preferenceSummary = useMemo(() => {
    const parts = [
      rememberDetailsValue ? 'Details saved' : 'Details not saved',
      marketingOptInValue ? 'Updates on' : 'Updates off',
    ];
    return parts.join(' • ');
  }, [rememberDetailsValue, marketingOptInValue]);

  const [accordionValue, setAccordionValue] = useState<string | undefined>();

  const description = isOpsMode
    ? 'Add the guest name and the best contact method for booking updates.'
    : 'We’ll send confirmation and any updates to the contact details below.';
  const confirmationDescription = isOpsMode
    ? 'These details are saved through the ops booking workflow and used for service updates.'
    : 'We only use these details for this reservation, service updates, and guest account history where enabled.';

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
        contentClassName="space-y-6 md:space-y-8"
      >
        <Form {...form}>
          <FormRoot
            className="space-y-6 md:space-y-8"
            onSubmit={form.handleSubmit(handleSubmit, handleError)}
            noValidate
          >
            <Button type="submit" className="hidden" aria-hidden />

            <WizardPanel interactive>
              <WizardPanelHeader
                icon={UserRound}
                title="Contact details"
                description="Your name and the best way to send updates."
              />
              <WizardPanelContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{confirmationDescription}</p>
                {!isOpsMode ? (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Required fields are marked *</p>
                    <p>Add at least one: email address or UK phone number.</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    At least one contact method (email or phone) is required.
                  </p>
                )}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <UserRound className="size-3.5 text-primary" aria-hidden />
                          Full name <span aria-hidden>*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Jane Smith"
                            autoComplete="name"
                            required
                            className="h-11"
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
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="size-3.5 text-primary" aria-hidden />
                          Email address{isOpsMode ? ' (optional)' : ''}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            autoComplete="email"
                            className="h-11"
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
                            Email is linked to your account. Update it from your profile to change
                            it.
                          </FormDescription>
                        ) : !errors.email ? (
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
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="size-3.5 text-primary" aria-hidden />
                          UK phone number{isOpsMode ? ' (optional)' : ''}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="07123 456789"
                            autoComplete="tel"
                            inputMode="tel"
                            className="h-11"
                            value={field.value}
                            disabled={isPhoneLocked}
                            onChange={(event) => {
                              const next = event.target.value;
                              field.onChange(next);
                              handlers.changePhone(next);
                            }}
                          />
                        </FormControl>
                        {!errors.phone ? (
                          <FormDescription className="text-xs text-muted-foreground">
                            Optional if email address is provided
                          </FormDescription>
                        ) : null}
                        <FormMessage>{errors.phone?.message}</FormMessage>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsappOptIn"
                    render={({ field }) => {
                      const checkboxId = 'whatsapp-opt-in';
                      const venueName =
                        props.state?.details.restaurantName ||
                        contextState?.details.restaurantName ||
                        'the restaurant';
                      return (
                        <FormItem className="space-y-1">
                          <Label
                            htmlFor={checkboxId}
                            className={cn(
                              optionalPreferenceLabelClass(Boolean(field.value)),
                              !hasValidWhatsAppPhone && 'opacity-60',
                            )}
                          >
                            <FormControl>
                              <Checkbox
                                id={checkboxId}
                                checked={field.value}
                                disabled={!hasValidWhatsAppPhone}
                                onCheckedChange={(next) => {
                                  const value = next === true;
                                  field.onChange(value);
                                  handlers.toggleWhatsApp(value);
                                }}
                                className="size-4 rounded-[4px] border border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <span className="text-sm font-semibold text-foreground">
                                {isOpsMode
                                  ? 'Guest agreed to WhatsApp booking updates'
                                  : 'Use WhatsApp for my booking updates'}
                              </span>
                              <p className="text-sm text-muted-foreground">
                                {isOpsMode
                                  ? `Confirm the guest says this number uses WhatsApp and agrees to receive booking messages from Nabatable on behalf of ${venueName}. If WhatsApp is unavailable, we’ll send an SMS instead.`
                                  : `You confirm this number uses WhatsApp and agree to receive booking messages from Nabatable on behalf of ${venueName}. If WhatsApp is unavailable, we’ll send an SMS instead.`}
                              </p>
                              {!hasValidWhatsAppPhone ? (
                                <p className="text-sm font-medium text-muted-foreground">
                                  Add a valid UK phone number to enable WhatsApp updates.
                                </p>
                              ) : null}
                            </div>
                          </Label>
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </WizardPanelContent>
            </WizardPanel>

            {!isOpsMode ? (
              <>
                <WizardPanel interactive>
                  <WizardPanelContent>
                    <FormField
                      control={form.control}
                      name="agree"
                      render={({ field }) => {
                        const checkboxId = 'agree-terms';
                        return (
                          <FormItem className="space-y-3">
                            <Label
                              htmlFor={checkboxId}
                              className={requiredPreferenceLabelClass(Boolean(errors.agree))}
                            >
                              <FormControl>
                                <Checkbox
                                  id={checkboxId}
                                  checked={field.value}
                                  aria-required="true"
                                  onCheckedChange={(next) => {
                                    const value = next === true;
                                    field.onChange(value);
                                    handlers.toggleAgree(value);
                                  }}
                                  className="size-4 rounded-[4px] border border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                />
                              </FormControl>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <span className="block font-semibold text-foreground">
                                  I agree to the terms and privacy notice{' '}
                                </span>
                                <span className="block">Required to confirm your booking.</span>
                              </div>
                            </Label>
                            <p className="pl-7 text-sm text-muted-foreground">
                              View our{' '}
                              <Button
                                asChild
                                variant="link"
                                className="inline h-auto p-0 text-foreground"
                              >
                                <a href="/privacy">privacy notice</a>
                              </Button>
                              .
                            </p>
                            <FormMessage className="sr-only">{errors.agree?.message}</FormMessage>
                            {errors.agree ? (
                              <Alert
                                variant="destructive"
                                role="alert"
                                className="flex items-start gap-3"
                              >
                                <AlertIcon>
                                  <AlertCircle className="size-4" aria-hidden />
                                </AlertIcon>
                                <AlertDescription>{errors.agree.message}</AlertDescription>
                              </Alert>
                            ) : null}
                          </FormItem>
                        );
                      }}
                    />
                  </WizardPanelContent>
                </WizardPanel>

                <WizardPanel interactive>
                  <WizardPanelContent>
                    <Accordion
                      type="single"
                      collapsible
                      value={accordionValue}
                      onValueChange={(next) => setAccordionValue(next ?? undefined)}
                      className="w-full"
                    >
                      <AccordionItem value="preferences">
                        <AccordionTrigger className="min-h-11">
                          <span className="flex flex-col text-left">
                            <span className="text-base font-semibold text-foreground">
                              Preferences
                            </span>
                            <span className="text-sm text-muted-foreground">
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
                                          className="size-4 rounded-[4px] border border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                        />
                                      </FormControl>
                                      <div className="space-y-1">
                                        <span className="text-sm font-semibold text-foreground">
                                          Save contact details for next time
                                        </span>
                                        <p className="text-sm text-muted-foreground">
                                          Stores on this device for 6 hours; uncheck to remove
                                          sooner.
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
                                          className="size-4 rounded-[4px] border border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
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
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </WizardPanelContent>
                </WizardPanel>

                {!isValid ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    Complete the required fields and accept the terms to review your booking.
                  </p>
                ) : null}
              </>
            ) : null}
          </FormRoot>
        </Form>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { DetailsStepProps } from './details-step/types';
