'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { clientEnv } from '@/lib/env-client';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { passwordPolicySchema, validatePasswordStrength } from '@/lib/security/passwordPolicy';
import { cn } from '@/lib/utils';

const passwordFieldSchema = z
  .union([passwordPolicySchema, z.literal('').transform(() => undefined)])
  .optional();

const formSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
  password: passwordFieldSchema,
});

type AuthSuccess = { status: 'ok'; redirectTo: string } | { status: 'magic_link_sent'; redirectTo: string };
type AuthResponse = AuthSuccess;

const AUTH_ENDPOINT = '/api/auth/signin';

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
  const [mode, setMode] = useState<AuthMode>(() =>
    clientEnv.flags.forcePasswordSignIn ? AUTH_MODES.PASSWORD : AUTH_MODES.MAGIC_LINK,
  );

  const targetPath = redirectedFrom && redirectedFrom.startsWith('/') ? redirectedFrom : '/guest/bookings';

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
  const callAuthEndpoint = (payload: {
    mode: AuthMode;
    email: string;
    password?: string;
    redirectedFrom: string;
  }) =>
    fetchJson<AuthResponse>(AUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

  const mapErrorToStatus = (error: unknown, mode: AuthMode): StatusState => {
    if (error instanceof HttpError) {
      if (error.status === 429) {
        return {
          message: 'Too many attempts. Please try again in a few minutes.',
          tone: 'error',
          live: 'assertive',
        };
      }
      if (error.status === 403) {
        return {
          message: 'Session expired. Refresh and try again.',
          tone: 'error',
          live: 'assertive',
        };
      }
      if (error.status === 401 && mode === AUTH_MODES.PASSWORD) {
        return {
          message: 'Invalid email or password.',
          tone: 'error',
          live: 'assertive',
        };
      }
      if (error.status === 400) {
        return {
          message: error.message || 'Please check your input and try again.',
          tone: 'error',
          live: 'assertive',
        };
      }
      return {
        message: error.message || 'Something went wrong. Please try again.',
        tone: 'error',
        live: 'assertive',
      };
    }

    return { message: 'Something went wrong. Please try again.', tone: 'error', live: 'assertive' };
  };

  const handleMagicLink = async (values: FormValues) => {
    if (magicCooldown > 0) {
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    track('auth_signin_attempt', { method: 'magic_link', redirectedFrom: targetPath });

    try {
      const response = await callAuthEndpoint({
        mode: AUTH_MODES.MAGIC_LINK,
        email: values.email,
        redirectedFrom: targetPath,
      });

      track('auth_magiclink_sent', { redirectedFrom: response.redirectTo ?? targetPath });
      emit('auth_magiclink_sent', { redirectedFrom: response.redirectTo ?? targetPath });

      setStatus({
        message: 'Magic link sent! Check your inbox to finish signing in.',
        tone: 'success',
        live: 'assertive',
      });
      setMagicCooldown(MAGIC_LINK_COOLDOWN_SECONDS);
      focusStatus();
    } catch (error) {
      const code = error instanceof HttpError ? error.code : 'UNKNOWN';
      track('auth_signin_error', {
        method: 'magic_link',
        code,
      });
      emit('auth_signin_error', {
        method: 'magic_link',
        code,
      });

      setStatus(mapErrorToStatus(error, AUTH_MODES.MAGIC_LINK));
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
    const validation = validatePasswordStrength(password);
    if (!validation.success) {
      form.setError('password', { type: 'manual', message: validation.error });
      focusStatus();
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    track('auth_signin_attempt', { method: 'password', redirectedFrom: targetPath });

    try {
      const response = await callAuthEndpoint({
        mode: AUTH_MODES.PASSWORD,
        email: values.email,
        password: validation.value,
        redirectedFrom: targetPath,
      });

      track('auth_signin_success', { method: 'password', redirectedFrom: targetPath });
      emit('auth_signin_success', { method: 'password', redirectedFrom: targetPath });
      setStatus({
        message: 'Signed in successfully. Redirecting…',
        tone: 'success',
        live: 'assertive',
      });
      focusStatus();
      router.replace(response.redirectTo ?? targetPath);
      router.refresh();
    } catch (error) {
      const code = error instanceof HttpError ? error.code : 'UNKNOWN';
      track('auth_signin_error', { method: 'password', code });
      emit('auth_signin_error', { method: 'password', code });

      if (error instanceof HttpError && error.status === 400) {
        const field = typeof error.details === 'object' && error.details && 'field' in error.details
          ? (error.details as { field?: string }).field
          : undefined;
        if (field === 'password') {
          form.setError('password', { type: 'manual', message: error.message });
        }
      }

      if (error instanceof HttpError && error.status === 401) {
        form.setError('password', { type: 'manual', message: 'Invalid email or password' });
      }

      setStatus(mapErrorToStatus(error, AUTH_MODES.PASSWORD));
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
    <Card
      id="signin-form"
      className="w-full max-w-full border-border/70 bg-white/95 shadow-lg shadow-primary/5 sm:max-w-md"
    >
      <CardHeader className="space-y-1.5 sm:space-y-2">
        <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Sign in with a one-time magic link or switch to password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 sm:space-y-6">
        <div
          role="tablist"
          aria-label="Choose sign-in method"
          className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1"
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
          <form className="space-y-4 sm:space-y-5" onSubmit={onSubmit} noValidate>
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
