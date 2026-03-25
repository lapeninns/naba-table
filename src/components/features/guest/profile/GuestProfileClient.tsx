'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Shield, Settings, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ZodError } from 'zod';

import { GuestPortalPage } from '@/components/features/guest/shared/GuestPortalPage';
import { GuestError, GuestStatus, MetricTile } from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useGuestProfile } from '@/guest/hooks';
import { StatusRegion } from '@/guest/routes/shared/StatusRegion';
import { coerceProfileUpdatePayload, useUpdateProfile } from '@/hooks/useProfile';
import { queryKeys } from '@/lib/query/keys';

import type { GuestProfileViewModel } from '@/guest/routes/profile/view-model';
import type { ProfileResponse, ProfileUpdatePayload } from '@/lib/profile/schema';

type ProfileFormValues = {
  full_name: string;
  phone_number: string;
};

type ProfileMutationResult = {
  profile: ProfileResponse;
  idempotent?: boolean;
};

export type GuestProfileMutationController = {
  isPending: boolean;
  mutate: (
    payload: ProfileUpdatePayload,
    options?: {
      onSuccess?: (result: ProfileMutationResult) => void;
      onError?: (error: unknown) => void;
    },
  ) => void;
};

export function GuestProfileClient({
  viewModel,
  profileMutationOverride,
}: {
  viewModel: GuestProfileViewModel;
  profileMutationOverride?: GuestProfileMutationController;
}) {
  const queryClient = useQueryClient();
  const { data: liveProfile, isLoading, isError } = useGuestProfile();
  const profile = liveProfile ?? viewModel.profile;

  const form = useForm<ProfileFormValues>({
    defaultValues: {
      full_name: profile?.name || '',
      phone_number: profile?.phone || '',
    },
  });

  const liveUpdateProfile = useUpdateProfile();
  const updateProfile = profileMutationOverride ?? liveUpdateProfile;
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    form.reset({
      full_name: profile.name || '',
      phone_number: profile.phone || '',
    });
  }, [profile, form]);

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

  if (isLoading && !profile) {
    return (
      <GuestPortalPage
        eyebrow="Settings"
        title="Your Profile"
        description="Manage your personal information, preferences, and security settings."
        contentClassName="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10"
      >
        <div className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
          <Card className="space-y-6 p-6 sm:p-8">
            <Skeleton className="h-7 w-48 rounded-lg" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
            <Skeleton className="ml-auto h-12 w-40 rounded-full" />
          </Card>
        </div>
      </GuestPortalPage>
    );
  }

  if (isError && !profile) {
    return (
      <StatusRegion focus live="assertive">
        <GuestPortalPage
          eyebrow="Settings"
          title="Your Profile"
          description="Manage your personal information, preferences, and security settings."
          contentClassName="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10"
        >
          <div className="flex min-h-[50vh] items-center justify-center">
            <GuestError
              description="We couldn't load your profile right now. Please try again."
              onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.profile.self() })}
            />
          </div>
        </GuestPortalPage>
      </StatusRegion>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <GuestPortalPage
      eyebrow="Settings"
      title="Your Profile"
      description="Manage your personal information, preferences, and security settings."
      contentClassName="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10"
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 animate-fade-in-up stagger-container">
          <MetricTile label="Account Status" value="Active" icon={Settings} detail="Standard" />
          <MetricTile label="Email Verified" value="Yes" icon={Shield} variant="highlight" />
        </div>

        <Separator className="my-6 sm:my-8" />

        {/* Profile Form */}
        <Card className="p-4 sm:p-6 lg:p-8 bg-surface-elevated animate-fade-in-up">
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-1 sm:space-y-2">
              <h2 className="heading-section">Personal Information</h2>
              <p className="text-xs sm:text-sm text-subtle">
                Update your contact details and how we address you.
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="full_name" className="text-sm">
                    Full Name
                  </Label>
                  <Input
                    id="full_name"
                    type="text"
                    autoComplete="name"
                    {...form.register('full_name')}
                    className="rounded-lg sm:rounded-xl h-11 sm:h-12 text-base focus-ring"
                    disabled={isSubmitting}
                  />
                  {form.formState.errors.full_name ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.full_name.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="email" className="text-sm">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={profile.email}
                    disabled
                    className="bg-muted rounded-lg sm:rounded-xl h-11 sm:h-12 text-base opacity-70"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed manually.</p>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="phone" className="text-sm">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    {...form.register('phone_number')}
                    className="rounded-lg sm:rounded-xl h-11 sm:h-12 text-base focus-ring"
                    disabled={isSubmitting}
                  />
                  {form.formState.errors.phone_number ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.phone_number.message}
                    </p>
                  ) : null}
                </div>
              </div>

              {feedback && (
                <GuestStatus
                  title={feedback.type === 'success' ? 'Saved' : 'Error'}
                  description={feedback.message}
                  tone={feedback.type === 'success' ? 'success' : 'danger'}
                  aria-live="polite"
                />
              )}

              <div className="flex justify-end pt-2 sm:pt-4">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full sm:w-auto rounded-full px-6 sm:px-8 bg-primary text-white hover:bg-primary/90 min-h-[44px] sm:min-h-[48px] btn-tactile focus-ring touch-feedback text-sm sm:text-base"
                  disabled={isSubmitting || isPristine}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </GuestPortalPage>
  );
}
