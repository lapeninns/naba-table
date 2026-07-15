'use client';

import { AlertCircle } from 'lucide-react';
import React, { useId, useMemo, useState } from 'react';
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
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { DetailsStepController } from './types';

type DetailsGuestSectionsProps = {
  form: DetailsStepController['form'];
  handlers: DetailsStepController['handlers'];
};

const preferenceLabelClass =
  'flex min-h-11 min-w-0 w-full items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:bg-accent/50 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/10 dark:has-[[aria-checked=true]]:border-primary/60 dark:has-[[aria-checked=true]]:bg-primary/20';

export function DetailsGuestSections({ form, handlers }: DetailsGuestSectionsProps) {
  const consentHeadingId = useId();
  const consentId = useId();
  const preferencesHeadingId = useId();
  const rememberId = useId();
  const marketingId = useId();
  const [accordionValue, setAccordionValue] = useState<string | undefined>();
  const rememberDetailsValue = useWatch({ control: form.control, name: 'rememberDetails' });
  const marketingOptInValue = useWatch({ control: form.control, name: 'marketingOptIn' });
  const { errors } = form.formState;
  const preferenceSummary = useMemo(() => {
    const parts = [
      rememberDetailsValue ? 'Details saved' : 'Details not saved',
      marketingOptInValue ? 'Updates on' : 'Updates off',
    ];
    return parts.join(' • ');
  }, [rememberDetailsValue, marketingOptInValue]);

  return (
    <>
      <section
        aria-labelledby={consentHeadingId}
        data-slot="details-consent-section"
        className="min-w-0 border-t border-border/60 p-4 sm:p-5"
      >
        <div className="mb-4 min-w-0 space-y-1">
          <h3 id={consentHeadingId} className="text-base font-semibold text-foreground">
            Booking consent
          </h3>
          <p className="text-pretty text-sm text-muted-foreground">
            Review the privacy notice and confirm before continuing.
          </p>
        </div>
        <FormField
          control={form.control}
          name="agree"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <Label
                htmlFor={consentId}
                className={cn(
                  preferenceLabelClass,
                  errors.agree &&
                    'border-destructive/40 bg-destructive/10 text-destructive-foreground dark:text-destructive-foreground',
                )}
              >
                <FormControl>
                  <Checkbox
                    id={consentId}
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
                <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
                  <span className="block text-sm font-semibold text-foreground">
                    I agree to the terms and privacy notice{' '}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Required to confirm your booking.
                  </span>
                </div>
              </Label>
              <p className="min-w-0 text-pretty pl-7 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                View our{' '}
                <Button asChild variant="link" className="inline-flex min-h-11 p-0 text-foreground">
                  <a href="/privacy">privacy notice</a>
                </Button>
                .
              </p>
              <FormMessage className="sr-only">{errors.agree?.message}</FormMessage>
              {errors.agree ? (
                <Alert variant="destructive" role="alert" className="flex items-start gap-3">
                  <AlertIcon>
                    <AlertCircle className="size-4" aria-hidden />
                  </AlertIcon>
                  <AlertDescription>{errors.agree.message}</AlertDescription>
                </Alert>
              ) : null}
            </FormItem>
          )}
        />
      </section>

      <section
        aria-labelledby={preferencesHeadingId}
        data-slot="details-preferences-section"
        className="min-w-0 border-t border-border/60 p-4 sm:p-5"
      >
        <Accordion
          type="single"
          collapsible
          value={accordionValue}
          onValueChange={(next) => setAccordionValue(next ?? undefined)}
          className="w-full"
        >
          <AccordionItem value="preferences" className="border-0">
            <AccordionTrigger className="min-h-11 px-0 py-2 hover:bg-transparent">
              <span className="flex min-w-0 flex-col text-left">
                <span id={preferencesHeadingId} className="text-base font-semibold text-foreground">
                  Preferences
                </span>
                <span className="text-pretty text-sm text-muted-foreground">
                  {preferenceSummary}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="[&>div]:px-0 [&>div]:pb-0">
              <div className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="rememberDetails"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label htmlFor={rememberId} className={preferenceLabelClass}>
                        <FormControl>
                          <Checkbox
                            id={rememberId}
                            checked={field.value}
                            onCheckedChange={(next) => {
                              const value = next === true;
                              field.onChange(value);
                              handlers.toggleRemember(value);
                            }}
                            className="size-4 rounded-[4px] border border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          />
                        </FormControl>
                        <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
                          <span className="text-sm font-semibold text-foreground">
                            Save contact details for next time
                          </span>
                          <p className="text-pretty text-sm text-muted-foreground">
                            Stores on this device for 6 hours; uncheck to remove sooner.
                          </p>
                        </div>
                      </Label>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="marketingOptIn"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label htmlFor={marketingId} className={preferenceLabelClass}>
                        <FormControl>
                          <Checkbox
                            id={marketingId}
                            checked={field.value}
                            onCheckedChange={(next) => {
                              const value = next === true;
                              field.onChange(value);
                              handlers.toggleMarketing(value);
                            }}
                            className="size-4 rounded-[4px] border border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          />
                        </FormControl>
                        <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
                          <span className="text-sm font-semibold text-foreground">
                            Send me occasional updates
                          </span>
                          <p className="text-pretty text-sm text-muted-foreground">
                            News on seasonal menus, experiences, and exclusive events.
                          </p>
                        </div>
                      </Label>
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </>
  );
}
