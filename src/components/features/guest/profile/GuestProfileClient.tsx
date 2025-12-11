'use client';

import { Shield, Settings, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ZodError } from 'zod';

import { GuestSection, MetricTile, HeadingXL, TextBody } from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGuestProfile } from '@/guest/hooks';
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
            },
        });
    };

    const isSubmitting = updateProfile.isPending;
    const isPristine = !form.formState.isDirty;

    return (
        <div className="min-h-screen pb-32 space-y-12">
            {/* Header */}
            <div className="relative bg-gradient-to-b from-white to-slate-50 pt-16 pb-12 border-b border-slate-100">
                <div className="mx-auto w-full max-w-4xl space-y-4 text-center md:text-left animate-fade-up">
                    <HeadingXL>Your Profile</HeadingXL>
                    <TextBody>Manage your personal information, preferences, and security settings.</TextBody>
                </div>
            </div>

            <div className="mx-auto w-full max-w-4xl space-y-12">

                {/* Stats Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
                    <MetricTile
                        label="Account Status"
                        value="Active"
                        icon={Settings}
                        detail="Standard"
                    />
                    <MetricTile
                        label="Email Verified"
                        value="Yes"
                        icon={Shield}
                        variant="highlight"
                    />
                </div>

                {/* Profile Form */}
                <GuestSection
                    title="Personal Information"
                    description="Update your contact details and how we address you."
                    className="animate-fade-up"
                >
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="full_name">Full Name</Label>
                                <Input
                                    id="full_name"
                                    {...form.register('full_name')}
                                    className="rounded-xl h-11"
                                    disabled={isSubmitting}
                                />
                                {form.formState.errors.full_name ? (
                                    <p className="text-xs text-red-600">{form.formState.errors.full_name.message}</p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input id="email" value={profile.email} disabled className="bg-slate-50 rounded-xl h-11" />
                                <p className="text-xs text-slate-500">Email cannot be changed manually.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    {...form.register('phone_number')}
                                    className="rounded-xl h-11"
                                    disabled={isSubmitting}
                                />
                                {form.formState.errors.phone_number ? (
                                    <p className="text-xs text-red-600">{form.formState.errors.phone_number.message}</p>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button
                                type="submit"
                                size="lg"
                                className="rounded-full px-8 bg-slate-900 hover:bg-slate-800"
                                disabled={isSubmitting || isPristine}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </GuestSection>
            </div>
        </div>
    );
}
