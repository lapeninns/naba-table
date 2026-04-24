'use client';

import { Mail, Phone, Save, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ZodError } from 'zod';

import {
  GuestContent,
  GuestDetailList,
  GuestPageFrame,
  GuestPanel,
  GuestSecondaryButton,
  GuestStatus,
} from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGuestProfile } from '@/guest/hooks';
import { coerceProfileUpdatePayload, useUpdateProfile } from '@/hooks/useProfile';

import type { GuestProfileViewModel } from '@/guest/routes/profile/view-model';
import type { ReactNode } from 'react';

type ProfileFormValues = {
  full_name: string;
  phone_number: string;
};

export function GuestProfileClient({
  viewModel,
  persistChanges = true,
}: {
  viewModel: GuestProfileViewModel;
  persistChanges?: boolean;
}) {
  const { data: liveProfile } = useGuestProfile();
  const profile = liveProfile ?? viewModel.profile;

  const form = useForm<ProfileFormValues>({
    defaultValues: {
      full_name: profile.name || '',
      phone_number: profile.phone || '',
    },
  });

  const updateProfile = useUpdateProfile();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  useEffect(() => {
    form.reset({
      full_name: profile.name || '',
      phone_number: profile.phone || '',
    });
  }, [profile.name, profile.phone, form]);

  const onSubmit = (data: ProfileFormValues) => {
    form.clearErrors();

    let payload;
    try {
      payload = coerceProfileUpdatePayload({
        name: data.full_name,
        phone: data.phone_number,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        error.issues.forEach((issue) => {
          const field = issue.path[0];
          if (field === 'name') {
            form.setError('full_name', { type: 'validate', message: issue.message });
          }
          if (field === 'phone') {
            form.setError('phone_number', { type: 'validate', message: issue.message });
          }
        });
        return;
      }
      throw error;
    }

    if (Object.keys(payload).length === 0) {
      form.reset(data);
      return;
    }

    if (!persistChanges) {
      form.reset(data);
      setFeedback({ type: 'success', message: 'Dev preview updated. No profile changes were saved.' });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    updateProfile.mutate(payload, {
      onSuccess: (result) => {
        form.reset({
          full_name: result.profile.name || '',
          phone_number: result.profile.phone || '',
        });
        setFeedback({ type: 'success', message: 'Profile updated successfully.' });
        setTimeout(() => setFeedback(null), 4000);
      },
      onError: () => {
        setFeedback({ type: 'error', message: 'Failed to save changes. Please try again.' });
        setTimeout(() => setFeedback(null), 6000);
      },
    });
  };

  const isSubmitting = updateProfile.isPending;
  const isPristine = !form.formState.isDirty;

  return (
    <GuestPageFrame className="pb-12 sm:pb-16">
      <GuestContent className="space-y-6 py-7 sm:space-y-7 sm:py-10">
        <header className="grid gap-4 border-b border-border/70 pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0 space-y-2">
            <p className="pg-kicker">Guest profile</p>
            <h1 className="font-[var(--pg-font-display)] text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              Profile details
            </h1>
            <p className="pg-body max-w-[58ch]">
              Keep your name and phone number current for reservation updates and arrival checks.
            </p>
          </div>
          <GuestSecondaryButton href="/guest/bookings">View bookings</GuestSecondaryButton>
        </header>

        <div className="grid gap-6 lg:grid-cols-[7fr_5fr] lg:items-start lg:gap-8">
          <GuestPanel className="p-5 sm:p-6">
            <div className="mb-5 space-y-2">
              <p className="pg-kicker">Editable</p>
              <h2 className="pg-card-title">Contact details</h2>
              <p className="pg-body max-w-[58ch] text-sm">
                These details are used only for your bookings and restaurant-related contact.
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
              <div className="grid gap-5 md:grid-cols-2">
                <FieldShell
                  label="Full name"
                  htmlFor="full_name"
                  error={form.formState.errors.full_name?.message}
                >
                  <Input
                    id="full_name"
                    type="text"
                    autoComplete="name"
                    {...form.register('full_name')}
                    className="pg-focus-ring h-12 rounded-[var(--pg-radius-md)] text-base"
                    disabled={isSubmitting}
                  />
                </FieldShell>

                <FieldShell label="Email address" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={profile.email}
                    disabled
                    className="h-12 rounded-[var(--pg-radius-md)] border-border/80 bg-muted/35 text-base opacity-80"
                  />
                  <p className="pg-caption">Email is managed through secure sign-in.</p>
                </FieldShell>

                <FieldShell
                  label="Phone number"
                  htmlFor="phone"
                  error={form.formState.errors.phone_number?.message}
                >
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    {...form.register('phone_number')}
                    className="pg-focus-ring h-12 rounded-[var(--pg-radius-md)] text-base"
                    disabled={isSubmitting}
                  />
                </FieldShell>
              </div>

              {feedback ? (
                <GuestStatus
                  title={feedback.type === 'success' ? 'Saved' : 'Could not save'}
                  description={feedback.message}
                  tone={feedback.type === 'success' ? 'success' : 'danger'}
                  aria-live="polite"
                />
              ) : null}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="guest-lg"
                  variant="guest-primary"
                  className="pg-action pg-focus-ring pg-touch w-full sm:w-auto"
                  disabled={isSubmitting || isPristine}
                >
                  <Save className="h-4 w-4" aria-hidden />
                  {isSubmitting ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </form>
          </GuestPanel>

          <aside className="space-y-3 lg:sticky lg:top-24">
            <GuestDetailList
              title="Account summary"
              items={[
                {
                  icon: UserRound,
                  label: 'Display name',
                  value: profile.name || 'Not set',
                  detail: 'Shown in your guest portal.',
                },
                {
                  icon: Mail,
                  label: 'Sign-in email',
                  value: profile.email,
                  detail: 'Used for secure magic links and receipts.',
                },
                {
                  icon: Phone,
                  label: 'Phone',
                  value: profile.phone || 'Not set',
                  detail: 'Used only for reservation-related contact.',
                },
              ]}
            />
          </aside>
        </div>
      </GuestContent>
    </GuestPageFrame>
  );
}

function FieldShell({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
