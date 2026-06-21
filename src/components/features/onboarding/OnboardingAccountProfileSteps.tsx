'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRoot,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { fetchJson } from '@/lib/http/fetchJson';

import { useOnboarding } from './context/OnboardingContext';
import { ONBOARDING_STEPS, accountSchema, profileSchema } from './onboardingWizardDomain';
import { OnboardingNavigation } from './ui/OnboardingNavigation';

import type { z } from 'zod';

export function AccountStep({ onComplete }: { onComplete: () => void }) {
  const { state, setAccount, setStep, setError, setLoading } = useOnboarding();
  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      email: state.account?.email ?? '',
      mode: state.account?.mode ?? 'magic_link',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      await fetchJson('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      track('user_signed_up', { method: values.mode });
      emit('user_signed_up', { method: values.mode });
      setAccount({ email: values.email, mode: values.mode });
      setStep(2);
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create account';
      setError(message);
    } finally {
      setLoading(false);
    }
  });

  return (
    <Form {...form}>
      <FormRoot className="space-y-6" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="owner@restaurant.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sign-up method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="magic_link">Magic link</SelectItem>
                    <SelectItem value="password">Email & password</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {form.watch('mode') === 'password' && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <OnboardingNavigation
          step={1}
          totalSteps={ONBOARDING_STEPS.length}
          canGoBack={false}
          onNext={onSubmit}
          busy={state.loading}
          nextLabel="Continue"
        />
      </FormRoot>
    </Form>
  );
}

export function ProfileStep({ onComplete }: { onComplete: () => void }) {
  const { state, setProfile, setRestaurantId, setStep, setError, setLoading } = useOnboarding();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: state.profile.name,
      slug: state.profile.slug,
      timezone: state.profile.timezone,
      contactEmail: state.profile.contactEmail ?? '',
      contactPhone: state.profile.contactPhone ?? '',
      bookingPolicy: state.profile.bookingPolicy ?? '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<{ restaurant: { id: string; name: string; slug: string } }>(
        '/api/onboarding/restaurant',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            slug: values.slug,
            timezone: values.timezone,
            contactEmail: values.contactEmail || null,
            contactPhone: values.contactPhone || null,
            bookingPolicy: values.bookingPolicy || null,
          }),
        },
      );
      setProfile({ ...state.profile, ...values });
      setRestaurantId(response.restaurant.id);
      setStep(3);
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save profile';
      setError(message);
    } finally {
      setLoading(false);
    }
  });

  return (
    <Form {...form}>
      <FormRoot className="space-y-6" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Restaurant name</FormLabel>
                <FormControl>
                  <Input placeholder="Nab a Table" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input placeholder="nabatbl" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {['Europe/London', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney'].map(
                      (tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact email</FormLabel>
                <FormControl>
                  <Input placeholder="reservations@restaurant.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact phone</FormLabel>
                <FormControl>
                  <Input placeholder="+44 20 1234 5678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bookingPolicy"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Booking policy</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="Optional notes shown to guests" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <OnboardingNavigation
          step={2}
          totalSteps={ONBOARDING_STEPS.length}
          onBack={() => setStep(1)}
          onNext={onSubmit}
          busy={state.loading}
        />
      </FormRoot>
    </Form>
  );
}
