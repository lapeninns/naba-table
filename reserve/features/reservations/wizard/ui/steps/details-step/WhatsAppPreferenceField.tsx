'use client';

import React, { useId } from 'react';
import { useWatch } from 'react-hook-form';

import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { isUKPhone } from '@reserve/shared/validation';

import { preferenceLabelClass } from './preferenceStyles';

import type { DetailsStepController } from './types';

type WhatsAppPreferenceFieldProps = {
  form: DetailsStepController['form'];
  handlers: DetailsStepController['handlers'];
  isOpsMode: boolean;
  restaurantName: string;
  separated?: boolean;
};

export function WhatsAppPreferenceField({
  form,
  handlers,
  isOpsMode,
  restaurantName,
  separated = false,
}: WhatsAppPreferenceFieldProps) {
  const whatsappId = useId();
  const phoneValue = useWatch({ control: form.control, name: 'phone' });
  const hasValidWhatsAppPhone = isUKPhone(phoneValue.trim());

  return (
    <FormField
      control={form.control}
      name="whatsappOptIn"
      render={({ field }) => (
        <FormItem className={cn('space-y-1', separated && 'border-t border-border/60 pt-5')}>
          <Label
            htmlFor={whatsappId}
            className={cn(
              preferenceLabelClass,
              field.value && 'border-primary/60',
              !hasValidWhatsAppPhone && 'opacity-60',
            )}
          >
            <FormControl>
              <Checkbox
                id={whatsappId}
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
            <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
              <span className="text-sm font-semibold text-foreground">
                {isOpsMode
                  ? 'Guest agreed to WhatsApp booking messages and one review request'
                  : 'Use WhatsApp for booking messages and one review request'}
              </span>
              <p className="text-pretty text-sm text-muted-foreground">
                {isOpsMode
                  ? `Confirm this number uses WhatsApp and the guest agrees to receive these messages from Nabatable on behalf of ${restaurantName}:`
                  : `You confirm this number uses WhatsApp and agree to receive these messages from Nabatable on behalf of ${restaurantName}:`}
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                <li>Booking confirmation and updates</li>
                <li>Guest or venue cancellations</li>
                <li>One post-visit review request</li>
              </ul>
              <p className="text-pretty text-sm text-muted-foreground">
                If WhatsApp is unavailable for booking messages, we’ll send an SMS instead. Review
                requests never fall back to SMS.
              </p>
              {!hasValidWhatsAppPhone ? (
                <p className="text-pretty text-sm font-medium text-muted-foreground">
                  Add a valid UK phone number to enable WhatsApp updates.
                </p>
              ) : null}
            </div>
          </Label>
        </FormItem>
      )}
    />
  );
}
