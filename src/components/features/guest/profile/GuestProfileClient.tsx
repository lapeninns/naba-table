'use client';

import { Shield, Settings, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { GuestSection, MetricTile, HeadingXL, TextBody } from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

import type { GuestProfileViewModel } from '@/guest/routes/profile/view-model';

type ProfileFormValues = {
    full_name: string;
    phone_number: string;
    marketing_consent: boolean;
};

export function GuestProfileClient({ viewModel }: { viewModel: GuestProfileViewModel }) {
    const { profile } = viewModel;

    const form = useForm<ProfileFormValues>({
        defaultValues: {
            full_name: profile.name || '',
            phone_number: profile.phone || '',
            marketing_consent: true, // simplified
        },
    });

    const onSubmit = (data: ProfileFormValues) => {
        console.log('Update profile', data);
        // TODO: Connect to mutation
    };

    return (
        <div className="min-h-screen pb-32 space-y-12">
            {/* Header */}
            <div className="relative bg-gradient-to-b from-white to-slate-50 pt-16 pb-12 px-6 md:px-12 border-b border-slate-100">
                <div className="max-w-4xl mx-auto space-y-4 text-center md:text-left animate-fade-up">
                    <HeadingXL>Your Profile</HeadingXL>
                    <TextBody>Manage your personal information, preferences, and security settings.</TextBody>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 md:px-12 space-y-12">

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
                                <Input id="full_name" {...form.register('full_name')} className="rounded-xl h-11" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input id="email" value={profile.email} disabled className="bg-slate-50 rounded-xl h-11" />
                                <p className="text-xs text-slate-500">Email cannot be changed manually.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input id="phone" {...form.register('phone_number')} className="rounded-xl h-11" />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" size="lg" className="rounded-full px-8 bg-slate-900 hover:bg-slate-800">
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </GuestSection>

                {/* Preferences */}
                <GuestSection
                    title="Communication Preferences"
                    description="Manage how we contact you about your bookings and offers."
                >
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Marketing Emails</Label>
                                <p className="text-sm text-slate-500">Receive offers, updates, and restaurant news.</p>
                            </div>
                            <Switch checked={true} />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Order Notifications</Label>
                                <p className="text-sm text-slate-500">Receive real-time updates about your orders.</p>
                            </div>
                            <Switch checked={true} disabled />
                        </div>
                    </div>
                </GuestSection>

                <div className="flex justify-center pt-8 pb-12">
                    <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700 rounded-full">
                        Delete Account
                    </Button>
                </div>

            </div>
        </div>
    );
}
