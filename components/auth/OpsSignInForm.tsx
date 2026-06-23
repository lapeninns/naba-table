'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { validatePasswordForSignIn } from '@/lib/security/passwordPolicy';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';

const formSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
  password: z.string().optional(),
});

type AuthResponse = { status: 'ok'; redirectTo: string };

const AUTH_ENDPOINT = '/api/auth/signin';

const AUTH_MODES = {
  MAGIC_LINK: 'magic_link',
  PASSWORD: 'password',
} as const;

type AuthMode = (typeof AUTH_MODES)[keyof typeof AUTH_MODES];

export type OpsSignInFormProps = {
  redirectedFrom?: string;
};

type StatusTone = 'info' | 'success' | 'error';

type StatusState = {
  message: string;
  tone: StatusTone;
  live: 'polite' | 'assertive';
};

type FormValues = z.infer<typeof formSchema>;

const STATUS_ALERT_VARIANT: Record<StatusTone, 'info' | 'success' | 'destructive'> = {
  info: 'info',
  success: 'success',
  error: 'destructive',
};

const STATUS_ICON = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
} satisfies Record<StatusTone, React.ComponentType<{ className?: string; 'aria-hidden'?: true }>>;

const MAGIC_LINK_COOLDOWN_SECONDS = 60;

export function OpsSignInForm({ redirectedFrom }: OpsSignInFormProps) {
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
  const [showPassword, setShowPassword] = useState(false);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<AuthMode>(AUTH_MODES.PASSWORD);

  const targetPath = sanitizeLocalRedirectPath(redirectedFrom, {
    fallback: '/dashboard',
    allowedPrefixes: [
      '/app',
      '/dashboard',
      '/bookings',
      '/customers',
      '/settings',
      '/new-bookings',
    ],
  });

  useEffect(() => {
    track('auth_ops_signin_viewed', { redirectedFrom: targetPath });
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

  const mapErrorToStatus = (error: unknown, currentMode: AuthMode): StatusState => {
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
      if (error.status === 401 && currentMode === AUTH_MODES.PASSWORD) {
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

  const onSubmit = form.handleSubmit(async (values) => {
    if (mode === AUTH_MODES.MAGIC_LINK) {
      await handleMagicLink(values);
      return;
    }

    const validation = validatePasswordForSignIn(values.password);
    if (!validation.success) {
      form.setError('password', { type: 'manual', message: validation.error });
      focusStatus();
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    track('auth_ops_signin_attempt', { method: 'password', redirectedFrom: targetPath });

    try {
      const response = await callAuthEndpoint({
        mode: AUTH_MODES.PASSWORD,
        email: values.email,
        password: validation.value,
        redirectedFrom: targetPath,
      });

      track('auth_ops_signin_success', { method: 'password', redirectedFrom: targetPath });
      emit('auth_ops_signin_success', { method: 'password', redirectedFrom: targetPath });

      setStatus({
        message: 'Signed in successfully. Redirecting…',
        tone: 'success',
        live: 'assertive',
      });
      focusStatus();

      // Force client to refresh session from cookies before navigation
      // This ensures useSupabaseSession() picks up the authenticated state
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.getUser();

      // Refresh router to update all components with new auth state
      router.refresh();
      router.replace(response.redirectTo ?? targetPath);
    } catch (error) {
      const code = error instanceof HttpError ? error.code : 'UNKNOWN';
      track('auth_ops_signin_error', { method: 'password', code });
      emit('auth_ops_signin_error', { method: 'password', code });

      if (error instanceof HttpError && error.status === 400) {
        const field =
          typeof error.details === 'object' && error.details && 'field' in error.details
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
  });

  const handleMagicLink = async (values: FormValues) => {
    if (magicCooldown > 0) return;

    setIsSubmitting(true);
    setStatus(null);
    track('auth_ops_signin_attempt', { method: 'magic_link', redirectedFrom: targetPath });

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
      track('auth_ops_signin_error', { method: 'magic_link', code });
      emit('auth_ops_signin_error', { method: 'magic_link', code });

      setStatus(mapErrorToStatus(error, AUTH_MODES.MAGIC_LINK));
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

  const StatusIcon = status ? STATUS_ICON[status.tone] : null;

  return (
    <div id="ops-signin-form" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Restaurant operations</h2>
        <p className="text-sm text-muted-foreground">
          Sign in with a magic link or password to access your console
        </p>
      </div>

      <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 p-1.5">
          <TabsTrigger
            value={AUTH_MODES.MAGIC_LINK}
            className="flex flex-col items-start gap-0.5 px-4 py-2.5"
          >
            <span className="text-sm font-semibold">Magic link</span>
            <span className="text-xs font-normal text-muted-foreground">One-time secure link</span>
          </TabsTrigger>
          <TabsTrigger
            value={AUTH_MODES.PASSWORD}
            className="flex flex-col items-start gap-0.5 px-4 py-2.5"
          >
            <span className="text-sm font-semibold">Password</span>
            <span className="text-xs font-normal text-muted-foreground">Your credentials</span>
          </TabsTrigger>
        </TabsList>

        <Form {...form}>
          <FormRoot className="mt-6 flex flex-col gap-5" onSubmit={onSubmit} noValidate>
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
                      className="h-11 touch-manipulation text-base"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <TabsContent value={AUTH_MODES.PASSWORD} tabIndex={-1} className="mt-0">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          className="h-11 touch-manipulation pr-11 text-base"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value={AUTH_MODES.MAGIC_LINK} tabIndex={-1} className="mt-0">
              {/* Magic link doesn't need extra fields, just email above */}
            </TabsContent>

            {status && (
              <Alert
                ref={statusRef}
                tabIndex={-1}
                role={status.tone === 'error' ? 'alert' : 'status'}
                aria-live={status.live}
                aria-atomic="true"
                variant={STATUS_ALERT_VARIANT[status.tone]}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {StatusIcon ? <StatusIcon className="size-4" aria-hidden /> : null}
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full touch-manipulation text-base font-semibold"
              disabled={submitDisabled}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />
                  {mode === AUTH_MODES.PASSWORD ? 'Signing in...' : 'Sending...'}
                </span>
              ) : (
                submitLabel
              )}
            </Button>
          </FormRoot>
        </Form>
      </Tabs>
    </div>
  );
}
