'use client';

import { Mail, Phone, UserRound } from 'lucide-react';
import React from 'react';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { WizardPanelContent, WizardPanelHeader } from '../../WizardPanel';

import type { DetailsContactLocks, DetailsStepController } from './types';

type DetailsContactSectionProps = {
  form: DetailsStepController['form'];
  handlers: DetailsStepController['handlers'];
  contactLocks?: DetailsContactLocks;
  isOpsMode: boolean;
};

export function DetailsContactSection({
  form,
  handlers,
  contactLocks = {},
  isOpsMode,
}: DetailsContactSectionProps) {
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
      </WizardPanelContent>
    </section>
  );
}
