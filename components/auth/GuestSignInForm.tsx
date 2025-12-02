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
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
});

type AuthResponse = { status: 'magic_link_sent'; redirectTo: string };

const AUTH_ENDPOINT = '/api/auth/signin';

export type GuestSignInFormProps = {
  redirectedFrom?: string;
};

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

export function GuestSignInForm({ redirectedFrom }: GuestSignInFormProps) {
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicCooldown, setMagicCooldown] = useState(0);
  const [status, setStatus] = useState<StatusState | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  const targetPath = redirectedFrom && redirectedFrom.startsWith('/') ? redirectedFrom : '/guest/dashboard';

  // Handle implicit flow: detect access_token in URL hash and set session
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return;

    const handleImplicitAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        
        // Parse hash parameters
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken || !refreshToken) {
          console.error('[GuestSignInForm] Missing tokens in hash');
          return;
        }

        // Set the session manually
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('[GuestSignInForm] Failed to set session:', error);
          setStatus({
            message: 'Failed to complete sign in. Please try again.',
            tone: 'error',
            live: 'assertive',
          });
          return;
        }

        // Clear the hash from the URL
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        track('auth_guest_signin_viewed', { redirectedFrom: targetPath });

        // Redirect to target
        router.push(targetPath);
        router.refresh();
      } catch (err) {
        console.error('[GuestSignInForm] Implicit auth error:', err);
        setStatus({
          message: 'Something went wrong during sign in. Please try again.',
          tone: 'error',
          live: 'assertive',
        });
      }
    };

    void handleImplicitAuth();
  }, [router, targetPath]);

  useEffect(() => {
    track('auth_guest_signin_viewed', { redirectedFrom: targetPath });
  }, [targetPath]);

  useEffect(() => {
    if (magicCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setMagicCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [magicCooldown]);

  const focusStatus = () => {
    setTimeout(() => statusRef.current?.focus(), 0);
  };

  const callAuthEndpoint = (payload: {
    mode: 'magic_link';
    email: string;
    redirectedFrom: string;
  }) =>
    fetchJson<AuthResponse>(AUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

  const mapErrorToStatus = (error: unknown): StatusState => {
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
    if (magicCooldown > 0) {
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    track('auth_guest_signin_attempt', { method: 'magic_link', redirectedFrom: targetPath });

    try {
      const response = await callAuthEndpoint({
        mode: 'magic_link',
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
      track('auth_guest_signin_error', {
        method: 'magic_link',
        code,
      });
      emit('auth_guest_signin_error', {
        method: 'magic_link',
        code,
      });

      setStatus(mapErrorToStatus(error));
      focusStatus();
    } finally {
      setIsSubmitting(false);
    }
  });

  const submitDisabled = isSubmitting || magicCooldown > 0;
  const submitLabel = magicCooldown > 0 ? `Resend in ${magicCooldown}s` : 'Send magic link';

  return (
    <Card
      id="guest-signin-form"
      className="w-full max-w-full border-border/70 bg-white/95 shadow-lg shadow-primary/5 sm:max-w-md"
    >
      <CardHeader className="space-y-1.5 sm:space-y-2">
        <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">Sign in as a guest</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          We'll send you a secure link to sign in without a password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 sm:space-y-6">
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
                  Sending...
                </span>
              ) : (
                submitLabel
              )}
            </Button>
          </form>
        </Form>

        <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
          <p>Restaurant or staff member?</p>
          <a href="/auth/signin" className="font-medium text-primary hover:underline">
            Sign in to operations →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
