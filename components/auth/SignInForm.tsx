'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { clientEnv } from '@/lib/env-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

import type { AuthApiError } from '@supabase/supabase-js';

const formSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
  password: z
    .string()
    .max(256, 'Password is too long')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type SignInFormProps = {
  redirectedFrom?: string;
};

const AUTH_MODES = {
  MAGIC_LINK: 'magic_link',
  PASSWORD: 'password',
} as const;

type AuthMode = (typeof AUTH_MODES)[keyof typeof AUTH_MODES];

type StatusTone = 'info' | 'success' | 'error';

type StatusState = {
  message: string;
  tone: StatusTone;
  live: 'polite' | 'assertive';
};

type FormValues = z.infer<typeof formSchema>;

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  info: 'text-muted-foreground',
  success: 'text-emerald-600',
  error: 'text-red-600',
};

const MAGIC_LINK_COOLDOWN_SECONDS = 60;

const AUTH_MODE_OPTIONS: Array<{
  id: AuthMode;
  label: string;
  helper: string;
}> = [
  {
    id: AUTH_MODES.MAGIC_LINK,
    label: 'Magic link',
    helper: 'Send a one-time link to your inbox',
  },
  {
    id: AUTH_MODES.PASSWORD,
    label: 'Password',
    helper: 'Use your email and password',
  },
];

export function SignInForm({ redirectedFrom }: SignInFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicCooldown, setMagicCooldown] = useState(0);
  const [status, setStatus] = useState<StatusState | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const [mode, setMode] = useState<AuthMode>(AUTH_MODES.MAGIC_LINK);

  const targetPath = redirectedFrom && redirectedFrom.startsWith('/') ? redirectedFrom : '/my-bookings';

  useEffect(() => {
    track('auth_signin_viewed', { redirectedFrom: targetPath });
  }, [targetPath]);

  useEffect(() => {
    if (magicCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setMagicCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [magicCooldown]);

  useEffect(() => {
    form.clearErrors();
    setStatus(null);
  }, [mode, form]);

  const focusStatus = () => {
    setTimeout(() => statusRef.current?.focus(), 0);
  };

  const resolveCallbackUrl = (destination: string) => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : clientEnv.app.siteUrl;

    const url = new URL('/api/auth/callback', origin);
    if (destination && destination.startsWith('/')) {
      url.searchParams.set('redirectedFrom', destination);
    }
    return url.toString();
  };

  const handleMagicLink = async (values: FormValues) => {
    if (magicCooldown > 0) {
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    track('auth_signin_attempt', { method: 'magic_link', redirectedFrom: targetPath });

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: resolveCallbackUrl(targetPath),
        },
      });

      if (error) {
        throw error;
      }

      track('auth_magiclink_sent', { redirectedFrom: targetPath });
      emit('auth_magiclink_sent', { redirectedFrom: targetPath });

      setStatus({
        message: 'Magic link sent! Check your inbox to finish signing in.',
        tone: 'success',
        live: 'assertive',
      });
      setMagicCooldown(MAGIC_LINK_COOLDOWN_SECONDS);
      focusStatus();
    } catch (error) {
      const authError = error as Partial<AuthApiError> | undefined;
      track('auth_signin_error', {
        method: 'magic_link',
        code: (authError?.name ?? authError?.status ?? 'UNKNOWN').toString(),
      });
      emit('auth_signin_error', {
        method: 'magic_link',
        code: (authError?.name ?? authError?.status ?? 'UNKNOWN').toString(),
      });

      const message =
        authError?.message ?? 'We couldn’t send a magic link right now. Please try again shortly.';
      setStatus({ message, tone: 'error', live: 'assertive' });
      focusStatus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (mode === AUTH_MODES.PASSWORD) {
      await handlePasswordSignIn(values);
    } else {
      await handleMagicLink(values);
    }
  });

  const handlePasswordSignIn = async (values: FormValues) => {
    const password = values.password?.trim();
    if (!password) {
      form.setError('password', { type: 'manual', message: 'Enter your password' });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    track('auth_signin_attempt', { method: 'password', redirectedFrom: targetPath });

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password,
      });

      if (error) {
        throw error;
      }

      track('auth_signin_success', { method: 'password', redirectedFrom: targetPath });
      emit('auth_signin_success', { method: 'password', redirectedFrom: targetPath });
      setStatus({
        message: 'Signed in successfully. Redirecting…',
        tone: 'success',
        live: 'assertive',
      });
      focusStatus();
      router.replace(targetPath);
      router.refresh();
    } catch (error) {
      const authError = error as Partial<AuthApiError> | undefined;
      const code = (authError?.name ?? authError?.status ?? 'UNKNOWN').toString();
      track('auth_signin_error', { method: 'password', code });
      emit('auth_signin_error', { method: 'password', code });
      const message =
        authError?.message ?? 'We couldn’t sign you in with that password. Please try again.';
      setStatus({ message, tone: 'error', live: 'assertive' });
      focusStatus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDisabled = isSubmitting || (mode === AUTH_MODES.MAGIC_LINK && magicCooldown > 0);
  const submitLabel =
    mode === AUTH_MODES.MAGIC_LINK
      ? magicCooldown > 0
        ? `Resend in ${magicCooldown}s`
        : 'Send magic link'
      : 'Sign in with password';

  return (
    <Card id="signin-form" className="w-full max-w-md border-border/70 bg-white/90 shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Sign in with a one-time magic link sent to your inbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          role="tablist"
          aria-label="Choose sign-in method"
          className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1"
        >
          {AUTH_MODE_OPTIONS.map((option) => {
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  'rounded-lg border border-transparent px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                  active
                    ? 'bg-white shadow-sm'
                    : 'bg-transparent text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setMode(option.id)}
                tabIndex={active ? 0 : -1}
              >
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.helper}</span>
              </button>
            );
          })}
        </div>

        <Form {...form}>
          <form className="space-y-5" onSubmit={onSubmit} noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="touch-manipulation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === AUTH_MODES.PASSWORD && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <p
              ref={statusRef}
              tabIndex={status ? -1 : undefined}
              role="status"
              aria-live={status?.live ?? 'polite'}
              aria-atomic="true"
              className={cn(
                'min-h-[1.25rem] text-sm text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                status ? STATUS_TONE_CLASSES[status.tone] : undefined,
              )}
            >
              {status?.message ?? ''}
            </p>

            <Button type="submit" className="w-full touch-manipulation" disabled={submitDisabled}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Processing
                </span>
              ) : (
                submitLabel
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
