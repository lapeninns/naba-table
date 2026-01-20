'use client';

import { Shield, Settings, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ZodError } from 'zod';

import { MetricTile } from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useGuestProfile } from '@/guest/hooks';
import { useToast } from '@/hooks/use-toast';
import { coerceProfileUpdatePayload, useUpdateProfile } from '@/hooks/useProfile';

import type { GuestProfileViewModel } from '@/guest/routes/profile/view-model';

type ProfileFormValues = {
  full_name: string;
  phone_number: string;
};

export function GuestProfileClient({ viewModel }: { viewModel: GuestProfileViewModel }) {
  const { data: liveProfile } = useGuestProfile();
  const profile = liveProfile ?? viewModel.profile;

  const form = useForm<ProfileFormValues>({
    defaultValues: {
      full_name: profile.name || '',
      phone_number: profile.phone || '',
    },
  });

  const updateProfile = useUpdateProfile();
  const { toast } = useToast();

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

    updateProfile.mutate(payload, {
      onSuccess: (result) => {
        form.reset({
          full_name: result.profile.name || '',
          phone_number: result.profile.phone || '',
        });
        toast({
          title: 'Profile updated',
          description: 'Your changes have been saved successfully.',
        });
      },
      onError: () => {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: "We couldn't save your changes. Please try again.",
        });
      },
    });
  };

  const isSubmitting = updateProfile.isPending;
  const isPristine = !form.formState.isDirty;

  return (
    <div className="min-h-screen bg-surface-warm pb-20">
      {/* Hero Section */}
      <section className="border-b border-slate-100 bg-gradient-hero">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:gap-4 py-8 sm:py-12 lg:py-16 px-4 sm:px-6">
          <div className="space-y-2 sm:space-y-3 animate-fade-in-up">
            <p className="text-xs uppercase tracking-[0.2em] text-subtle">Settings</p>
            <h1 className="heading-hero">
              Your Profile
            </h1>
            <p className="text-body-warm max-w-2xl">
              Manage your personal information, preferences, and security settings.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">
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
                    <p className="text-xs text-red-600">
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
                    className="bg-slate-50 rounded-lg sm:rounded-xl h-11 sm:h-12 text-base opacity-70"
                  />
                  <p className="text-xs text-slate-500">Email cannot be changed manually.</p>
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
                    <p className="text-xs text-red-600">
                      {form.formState.errors.phone_number.message}
                    </p>
                  ) : null}
                </div>
              </div>

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
    </div>
  );
}
