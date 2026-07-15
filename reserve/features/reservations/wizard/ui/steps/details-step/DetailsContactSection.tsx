'use client';

import { Mail, Phone, UserRound } from 'lucide-react';
import React, { useId } from 'react';
import { useWatch } from 'react-hook-form';

import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { isUKPhone } from '@reserve/shared/validation';

import { WizardPanelContent, WizardPanelHeader } from '../../WizardPanel';

import type { DetailsContactLocks, DetailsStepController } from './types';

type DetailsContactSectionProps = {
  form: DetailsStepController['form'];
  handlers: DetailsStepController['handlers'];
  contactLocks?: DetailsContactLocks;
  isOpsMode: boolean;
  restaurantName: string;
};

const preferenceLabelClass =
  'flex min-h-11 min-w-0 w-full items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:bg-accent/50 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/10 dark:has-[[aria-checked=true]]:border-primary/60 dark:has-[[aria-checked=true]]:bg-primary/20';

export function DetailsContactSection({
  form,
  handlers,
  contactLocks = {},
  isOpsMode,
  restaurantName,
}: DetailsContactSectionProps) {
  const whatsappId = useId();
  const phoneValue = useWatch({ control: form.control, name: 'phone' });
  const hasValidWhatsAppPhone = isUKPhone(phoneValue?.trim() ?? '');
  const { errors } = form.formState;
  const isNameLocked = Boolean(contactLocks.name);
  const isEmailLocked = Boolean(contactLocks.email);
  const isPhoneLocked = Boolean(contactLocks.phone);
  const confirmationDescription = isOpsMode
    ? 'These details are saved through the ops booking workflow and used for service updates.'
    : 'We only use these details for this reservation, service updates, and guest account history where enabled.';

  return (
    <section aria-label="Contact details" data-slot="details-contact-section" className="min-w-0">
      <WizardPanelHeader
        icon={UserRound}
        title="Contact details"
        description="Your name and the best way to send updates."
      />
      <WizardPanelContent className="space-y-5">
        <div className="min-w-0 space-y-1 text-sm text-muted-foreground">
          <p className="text-pretty">{confirmationDescription}</p>
          {isOpsMode ? (
            <p className="text-pretty">At least one contact method (email or phone) is required.</p>
          ) : (
            <>
              <p>Required fields are marked *</p>
              <p className="text-pretty">Add at least one: email address or UK phone number.</p>
            </>
          )}
        </div>

        <div className="space-y-5">
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
                    Email is linked to your account. Update it from your profile to change it.
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
        </div>

        <FormField
          control={form.control}
          name="whatsappOptIn"
          render={({ field }) => (
            <FormItem className="space-y-1 border-t border-border/60 pt-5">
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
                    If WhatsApp is unavailable for booking messages, we’ll send an SMS instead.
                    Review requests never fall back to SMS.
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
      </WizardPanelContent>
    </section>
  );
}
