'use client';

import { AlertCircle } from 'lucide-react';
import React, { useId } from 'react';
import { useWatch } from 'react-hook-form';

import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { isUKPhone } from '@reserve/shared/validation';

import { compactPreferenceLabelClass } from './preferenceStyles';

import type { DetailsStepController } from './types';

type DetailsConsentPreferencesProps = {
  controller: DetailsStepController;
  restaurantName: string;
};

const checkboxClass =
  'size-4 rounded-[4px] border border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground';

export function DetailsConsentPreferences({
  controller,
  restaurantName,
}: DetailsConsentPreferencesProps) {
  const termsId = useId();
  const whatsappId = useId();
  const rememberId = useId();
  const marketingId = useId();
  const phoneValue = useWatch({ control: controller.form.control, name: 'phone' });
  const hasValidWhatsAppPhone = isUKPhone(phoneValue.trim());
  const { errors } = controller.form.formState;

  return (
    <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-muted/20 px-1">
      <FormField
        control={controller.form.control}
        name="agree"
        render={({ field }) => (
          <FormItem className="space-y-0 py-1">
            <Label htmlFor={termsId} className={compactPreferenceLabelClass}>
              <FormControl>
                <Checkbox
                  id={termsId}
                  checked={field.value}
                  aria-required="true"
                  onCheckedChange={(next) => {
                    const value = next === true;
                    field.onChange(value);
                    controller.handlers.toggleAgree(value);
                  }}
                  className={checkboxClass}
                />
              </FormControl>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  Terms &amp; privacy
                </span>
                <span className="block text-xs text-muted-foreground">Required for booking</span>
              </span>
            </Label>
            {errors.agree ? (
              <Alert variant="destructive" role="alert" className="mx-2 mb-2 py-2.5">
                <AlertIcon>
                  <AlertCircle className="size-4" aria-hidden />
                </AlertIcon>
                <AlertDescription>{errors.agree.message}</AlertDescription>
              </Alert>
            ) : null}
          </FormItem>
        )}
      />

      <FormField
        control={controller.form.control}
        name="whatsappOptIn"
        render={({ field }) => (
          <FormItem className="space-y-0 py-1">
            <Label
              htmlFor={whatsappId}
              className={`${compactPreferenceLabelClass} ${
                hasValidWhatsAppPhone ? '' : 'opacity-55'
              }`}
            >
              <FormControl>
                <Checkbox
                  id={whatsappId}
                  checked={field.value}
                  disabled={!hasValidWhatsAppPhone}
                  onCheckedChange={(next) => {
                    const value = next === true;
                    field.onChange(value);
                    controller.handlers.toggleWhatsApp(value);
                  }}
                  className={checkboxClass}
                />
              </FormControl>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  Booking messages
                </span>
                <span className="block text-xs text-muted-foreground">
                  {hasValidWhatsAppPhone
                    ? `WhatsApp updates from ${restaurantName}`
                    : 'Add a UK phone number to use WhatsApp'}
                </span>
              </span>
            </Label>
          </FormItem>
        )}
      />

      <FormField
        control={controller.form.control}
        name="rememberDetails"
        render={({ field }) => (
          <FormItem className="space-y-0 py-1">
            <Label htmlFor={rememberId} className={compactPreferenceLabelClass}>
              <FormControl>
                <Checkbox
                  id={rememberId}
                  checked={field.value}
                  onCheckedChange={(next) => {
                    const value = next === true;
                    field.onChange(value);
                    controller.handlers.toggleRemember(value);
                  }}
                  className={checkboxClass}
                />
              </FormControl>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Save my details</span>
                <span className="block text-xs text-muted-foreground">
                  On this device for 6 hours
                </span>
              </span>
            </Label>
          </FormItem>
        )}
      />

      <FormField
        control={controller.form.control}
        name="marketingOptIn"
        render={({ field }) => (
          <FormItem className="space-y-0 py-1">
            <Label htmlFor={marketingId} className={compactPreferenceLabelClass}>
              <FormControl>
                <Checkbox
                  id={marketingId}
                  checked={field.value}
                  onCheckedChange={(next) => {
                    const value = next === true;
                    field.onChange(value);
                    controller.handlers.toggleMarketing(value);
                  }}
                  className={checkboxClass}
                />
              </FormControl>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  Occasional updates
                </span>
                <span className="block text-xs text-muted-foreground">
                  Menus and special events
                </span>
              </span>
            </Label>
          </FormItem>
        )}
      />
    </div>
  );
}
