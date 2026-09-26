'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { toUserMessage } from '@/lib/http/userMessage';

import { useOnboarding } from './context/OnboardingContext';
import { applyServerFieldErrors } from './formErrors';
import {
  useOnboardingSignup,
  useSaveOnboardingProfile,
  type SaveProfileVariables,
} from './hooks/useOnboardingMutations';
import {
  ONBOARDING_STEPS,
  STEP_PATHS,
  accountSchema,
  getProfileChanges,
  profileSchema,
} from './onboardingWizardDomain';
import { OnboardingNavigation } from './ui/OnboardingNavigation';

import type { z } from 'zod';

const SIGNUP_ERROR_COPY = {
  RATE_LIMITED: 'Too many sign-up attempts. Wait a few minutes and try again.',
  MAGIC_LINK_FAILED: "We couldn't send the sign-in email. Try again in a moment.",
};

const PROFILE_ERROR_COPY = {
  SLUG_TAKEN: 'That web address is taken. Try a different slug.',
  ONBOARDING_ALREADY_COMPLETED:
    'This account already has a restaurant. Reload the page to continue setting it up.',
  UNAUTHENTICATED: 'Confirm your email and sign in to continue.',
};

function SignedInPanel({ email, onContinue }: { email: string | null; onContinue: () => void }) {
  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>You&apos;re signed in</AlertTitle>
        <AlertDescription>
          {email
            ? `Continue setting up your restaurant as ${email}.`
            : 'Continue setting up your restaurant.'}
        </AlertDescription>
      </Alert>
      <OnboardingNavigation
        step={1}
        totalSteps={ONBOARDING_STEPS.length}
        canGoBack={false}
        onNext={onContinue}
        nextLabel="Continue"
      />
    </div>
  );
}

function CheckEmailPanel({
  email,
  mode,
  onConfirmed,
  onUseDifferentEmail,
}: {
  email: string;
  mode: 'password' | 'magic_link';
  onConfirmed: () => void;
  onUseDifferentEmail: () => void;
}) {
  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>Check your email to confirm</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            We sent a {mode === 'magic_link' ? 'sign-in link' : 'confirmation link'} to {email}.
            Open it to continue setting up your restaurant. It opens in a new tab and picks up where
            you left off, so you can close this one.
          </p>
        </AlertDescription>
      </Alert>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={onConfirmed}>
          I&apos;ve confirmed my email
        </Button>
        <Button type="button" variant="ghost" onClick={onUseDifferentEmail}>
          Use a different email
        </Button>
      </div>
    </div>
  );
}

export function AccountStep({ onComplete }: { onComplete: () => void }) {
  const { state, setAccount, setStep, setError } = useOnboarding();
  const signup = useOnboardingSignup();
  const router = useRouter();
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<{
    email: string;
    mode: 'password' | 'magic_link';
  } | null>(null);
  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      email: state.account?.email ?? '',
      mode: state.account?.mode ?? 'magic_link',
      password: '',
    },
  });

  const selectedMode = useWatch({ control: form.control, name: 'mode' });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    const variables =
      values.mode === 'password'
        ? { email: values.email, mode: values.mode, password: values.password }
        : { email: values.email, mode: values.mode };
    signup.mutate(variables, {
      onSuccess: (result) => {
        track('user_signed_up', { method: values.mode });
        emit('user_signed_up', { method: values.mode });
        if (result.status === 'ok') {
          // Password sign-up with an immediate session: the profile step can write.
          setAccount({ email: values.email, mode: values.mode });
          setStep(2);
          onComplete();
          return;
        }
        // 'confirmation_required' or 'magic_link_sent': no session yet, so stay here.
        setAwaitingConfirmation({ email: values.email, mode: values.mode });
      },
      onError: (error) => {
        applyServerFieldErrors(form, error, ['email', 'password']);
        setError(
          toUserMessage(error, {
            copy: SIGNUP_ERROR_COPY,
            fallback: "We couldn't create your account. Try again.",
          }),
        );
      },
    });
  });

  if (state.session) {
    return (
      <SignedInPanel
        email={state.session.email}
        onContinue={() => {
          setError(null);
          setStep(2);
          onComplete();
        }}
      />
    );
  }

  if (awaitingConfirmation) {
    return (
      <CheckEmailPanel
        email={awaitingConfirmation.email}
        mode={awaitingConfirmation.mode}
        // Reloads the profile route so the server resolves the confirmed session.
        onConfirmed={() => {
          router.push(STEP_PATHS[2]);
          router.refresh();
        }}
        onUseDifferentEmail={() => setAwaitingConfirmation(null)}
      />
    );
  }

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

        {selectedMode === 'password' && (
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
          busy={signup.isPending}
          nextLabel="Continue"
        />
      </FormRoot>
    </Form>
  );
}

export function ProfileStep({ onComplete }: { onComplete: () => void }) {
  const { state, setProfile, setRestaurantId, setStep, setError } = useOnboarding();
  const saveProfile = useSaveOnboardingProfile();
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

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    const advance = () => {
      setStep(3);
      onComplete();
    };

    // Back navigation after the restaurant exists: send only what changed, and nothing at
    // all when nothing changed.
    let variables: SaveProfileVariables;
    if (state.restaurantId) {
      const changes = getProfileChanges(state.profile, values);
      if (Object.keys(changes).length === 0) {
        advance();
        return;
      }
      variables = { restaurantId: state.restaurantId, changes };
    } else {
      variables = {
        restaurantId: null,
        profile: {
          name: values.name,
          slug: values.slug,
          timezone: values.timezone,
          contactEmail: values.contactEmail || null,
          contactPhone: values.contactPhone || null,
          bookingPolicy: values.bookingPolicy || null,
        },
      };
    }

    saveProfile.mutate(variables, {
        onSuccess: (restaurant) => {
          // The server may have suffixed the slug to keep it unique.
          setProfile({ ...state.profile, ...values, slug: restaurant.slug });
          setRestaurantId(restaurant.id);
          advance();
        },
        onError: (error) => {
          applyServerFieldErrors(form, error, [
            'name',
            'slug',
            'timezone',
            'contactEmail',
            'contactPhone',
            'bookingPolicy',
          ]);
          setError(
            toUserMessage(error, {
              copy: PROFILE_ERROR_COPY,
              fallback: "We couldn't save your restaurant profile. Try again.",
            }),
          );
        },
    });
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
          busy={saveProfile.isPending}
        />
      </FormRoot>
    </Form>
  );
}
