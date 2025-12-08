'use client';

import { AlertCircle, Mail, Phone, User } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Checkbox } from '@shared/ui/checkbox';
import {
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

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Styles
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_CARD_CLASS = cn(
  'space-y-5 rounded-xl border border-border bg-card/80',
  'p-5 shadow-sm backdrop-blur-sm',
  'transition-all duration-200',
  'hover:shadow-md',
);

const SECTION_HEADER_CLASS = cn('flex items-center gap-2', 'text-lg font-semibold text-foreground');

const INPUT_CLASS = cn(
  'h-12 text-base bg-background/50',
  'border-border/60 focus:border-primary/80',
  'transition-all duration-200',
  'focus:ring-2 focus:ring-primary/20',
);

const basePreferenceLabelClass = cn(
  'flex w-full cursor-pointer items-start gap-3',
  'rounded-lg border p-4',
  'transition-all duration-200',
  'hover:bg-accent/50',
  // Selected state via has selector
  'has-[[aria-checked=true]]:border-primary',
  'has-[[aria-checked=true]]:bg-primary/10',
  'dark:has-[[aria-checked=true]]:border-primary/60',
  'dark:has-[[aria-checked=true]]:bg-primary/20',
);

// ─────────────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────────────

const optionalPreferenceLabelClass = (checked: boolean) =>
  cn(basePreferenceLabelClass, checked ? 'border-primary/60' : 'border-border bg-muted/40');

const requiredPreferenceLabelClass = (checked: boolean, hasError: boolean) =>
  cn(
    basePreferenceLabelClass,
    checked
      ? 'border-primary/60'
      : hasError
        ? 'border-destructive/60 bg-destructive/5 animate-shake'
        : 'border-border bg-muted/40',
  );

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
}

function SectionHeader({ icon, title }: SectionHeaderProps) {
  return (
    <h3 className={SECTION_HEADER_CLASS}>
      <span className="text-primary" aria-hidden>
        {icon}
      </span>
      {title}
    </h3>
  );
}

interface ContactInputProps {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  type: 'text' | 'email' | 'tel';
  autoComplete: string;
  inputMode?: 'text' | 'email' | 'tel';
  value: string;
  disabled?: boolean;
  error?: string;
  description?: string;
  onChange: (value: string) => void;
}

function ContactInput({
  icon,
  label,
  placeholder,
  type,
  autoComplete,
  inputMode,
  value,
  disabled,
  error,
  description,
  onChange,
}: ContactInputProps) {
  return (
    <FormItem>
      <FormLabel className="flex items-center gap-1.5">
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
        {label}
      </FormLabel>
      <FormControl>
        <Input
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          className={cn(INPUT_CLASS, error && 'border-destructive focus-visible:ring-destructive')}
          onChange={(event) => onChange(event.target.value)}
        />
      </FormControl>
      {description && (
        <FormDescription className="text-xs text-muted-foreground">{description}</FormDescription>
      )}
      <FormMessage aria-live="polite">{error}</FormMessage>
    </FormItem>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function DetailsStep({ mode = 'customer', ...props }: DetailsStepProps) {
  const { analytics } = useWizardDependencies();
  const { goToStep } = useWizardNavigation();

  const controller = useDetailsStepForm({
    ...props,
    mode,
    onTrack: props.onTrack ?? analytics.track,
  });

  const { form, handlers } = controller;
  const { errors } = form.formState;

  // Contact field locks
  const contactLocks = props.contactLocks ?? {};
  const isNameLocked = Boolean(contactLocks.name);
  const isEmailLocked = Boolean(contactLocks.email);
  const isPhoneLocked = Boolean(contactLocks.phone);

  // Terms shake animation state
  const [termsShaking, setTermsShaking] = useState(false);

  // Trigger shake animation when terms error appears
  const shakeTerms = useCallback(() => {
    setTermsShaking(true);
    setTimeout(() => setTermsShaking(false), 600);
  }, []);

  useEffect(() => {
    if (errors.agree) {
      shakeTerms();
    }
  }, [errors.agree, shakeTerms]);

  return (
    <StepErrorBoundary
      stepName="Tell us how to reach you"
      onReset={() => {
        goToStep(2);
      }}
    >
      <WizardStep
        step={2}
        title="Your Details"
        description="Where should we send your booking confirmation?"
        contentClassName="space-y-6 md:space-y-8"
      >
        {/* ═══════════════════════════════════════════════════════════════
                CARD 1: Your Details (Contact Information)
            ═══════════════════════════════════════════════════════════════ */}
        <section className={SECTION_CARD_CLASS}>
          <SectionHeader icon={<User className="h-5 w-5" />} title="Your Details" />

          <div className="space-y-4">
            {/* Full Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <ContactInput
                  icon={<User className="h-4 w-4" />}
                  label="Full name"
                  placeholder="Jane Smith"
                  type="text"
                  autoComplete="name"
                  value={field.value ?? ''}
                  disabled={isNameLocked}
                  error={errors.name?.message}
                  onChange={(next) => {
                    field.onChange(next);
                    handlers.changeName(next);
                  }}
                />
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <ContactInput
                  icon={<Mail className="h-4 w-4" />}
                  label={`Email address${mode === 'ops' ? ' (optional)' : ''}`}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={field.value ?? ''}
                  disabled={isEmailLocked}
                  error={errors.email?.message}
                  description={
                    isEmailLocked
                      ? 'Email is linked to your account. Update it from your profile to change it.'
                      : undefined
                  }
                  onChange={(next) => {
                    field.onChange(next);
                    handlers.changeEmail(next);
                  }}
                />
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <ContactInput
                  icon={<Phone className="h-4 w-4" />}
                  label={`UK phone number${mode === 'ops' ? ' (optional)' : ''}`}
                  placeholder="07123 456789"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={field.value ?? ''}
                  disabled={isPhoneLocked}
                  error={errors.phone?.message}
                  onChange={(next) => {
                    field.onChange(next);
                    handlers.changePhone(next);
                  }}
                />
              )}
            />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
                CARD 2: Preferences (Checkboxes)
            ═══════════════════════════════════════════════════════════════ */}
        <section className={SECTION_CARD_CLASS}>
          <SectionHeader icon={<AlertCircle className="h-5 w-5" />} title="Preferences" />

          <div className="space-y-4">
            {/* Remember Details */}
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
                          className="mt-0.5 h-5 w-5 rounded border-muted-foreground/50"
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

            {/* Marketing Opt-In */}
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
                          className="mt-0.5 h-5 w-5 rounded border-muted-foreground/50"
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

            {/* Terms Agreement - Required */}
            <FormField
              control={form.control}
              name="agree"
              render={({ field }) => {
                const checkboxId = 'agree-terms';
                const hasError = Boolean(errors.agree);
                return (
                  <FormItem className="space-y-3">
                    <div className={cn(termsShaking && 'animate-shake')}>
                      <Label
                        htmlFor={checkboxId}
                        className={requiredPreferenceLabelClass(Boolean(field.value), hasError)}
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
                            className="mt-0.5 h-5 w-5 rounded border-muted-foreground/50"
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <span className="text-sm font-semibold text-foreground">
                            I agree to the terms and privacy notice
                          </span>
                          <span className="block text-sm text-muted-foreground">
                            Required to confirm your booking.
                          </span>
                        </div>
                      </Label>
                    </div>

                    {/* Screen reader announcement */}
                    <FormMessage className="sr-only" aria-live="assertive">
                      {errors.agree?.message}
                    </FormMessage>

                    {/* Visible error alert */}
                    {errors.agree && (
                      <Alert
                        variant="destructive"
                        role="alert"
                        className="flex items-start gap-3 animate-fade-in"
                      >
                        <AlertIcon>
                          <AlertCircle className="h-4 w-4" aria-hidden />
                        </AlertIcon>
                        <AlertDescription aria-live="polite">
                          {errors.agree.message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </FormItem>
                );
              }}
            />
          </div>
        </section>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { DetailsStepProps } from './details-step/types';
