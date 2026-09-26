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
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/typography';
import { useGuestProfile } from '@/guest/hooks';
import {
  coerceProfileUpdatePayload,
  useProfileSaveKey,
  useUpdateProfile,
} from '@/hooks/useProfile';
import { HttpError } from '@/lib/http/errors';
import { getFieldErrors, toUserMessage } from '@/lib/http/userMessage';

import type { GuestProfileViewModel } from '@/guest/routes/profile/view-model';
import type { ReactNode } from 'react';

type ProfileFormValues = {
  full_name: string;
  phone_number: string;
};

/** Server field paths to form fields. */
const SERVER_FIELD_TO_FORM: Record<string, keyof ProfileFormValues> = {
  name: 'full_name',
  phone: 'phone_number',
};

/** Save copy by C1 code; anything else resolves through toUserMessage. */
const PROFILE_SAVE_ERROR_COPY: Partial<Record<string, string>> = {
  IDEMPOTENCY_KEY_CONFLICT:
    'Your details changed while an earlier save was still being processed. Save again.',
  INVALID_PROFILE: 'Some details need attention. Check the highlighted fields.',
  EMAIL_IMMUTABLE: 'Your email is managed through sign-in and can’t be changed here.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to save your details.',
};

const PROFILE_SAVE_FALLBACK = 'Your changes weren’t saved. Try again.';

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
  const saveKey = useProfileSaveKey();
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
      setFeedback({
        type: 'success',
        message: 'Dev preview updated. No profile changes were saved.',
      });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    // The key stays the same for this payload until a save succeeds, so a retry after a
    // network error or 5xx is deduplicated by the server.
    const idempotencyKey = saveKey.keyFor(payload);
    updateProfile.mutate(
      { payload, idempotencyKey },
      {
        onSuccess: (result) => {
          saveKey.reset();
          form.reset({
            full_name: result.profile.name || '',
            phone_number: result.profile.phone || '',
          });
          setFeedback({ type: 'success', message: 'Profile updated successfully.' });
          setTimeout(() => setFeedback(null), 4000);
        },
        onError: (error) => {
          if (error instanceof HttpError && error.code === 'IDEMPOTENCY_KEY_CONFLICT') {
            // That key is spent on another payload: the next save needs a new one.
            saveKey.reset();
          }
          for (const [path, messages] of Object.entries(getFieldErrors(error) ?? {})) {
            const field = SERVER_FIELD_TO_FORM[path.split('.').at(-1) ?? path];
            if (field && messages[0]) {
              form.setError(field, { type: 'server', message: messages[0] });
            }
          }
          setFeedback({
            type: 'error',
            message: toUserMessage(error, {
              copy: PROFILE_SAVE_ERROR_COPY,
              fallback: PROFILE_SAVE_FALLBACK,
            }),
          });
        },
      },
    );
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <GuestSecondaryButton href="/guest/profile/security">
              Devices & sessions
            </GuestSecondaryButton>
            <GuestSecondaryButton href="/guest/bookings">View bookings</GuestSecondaryButton>
          </div>
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

            <FormRoot onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
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
                  <Save className="size-4" aria-hidden />
                  {isSubmitting ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </FormRoot>
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
      {error ? <Text variant="label" className="text-destructive">{error}</Text> : null}
    </div>
  );
}
