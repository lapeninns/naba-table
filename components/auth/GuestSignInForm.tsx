'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { GuestStatus } from '@/components/guest/ui';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';

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
  const statusRef = useRef<HTMLDivElement | null>(null);

  const targetPath = redirectedFrom && redirectedFrom.startsWith('/') ? redirectedFrom : '/guest/dashboard';

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
    <div id="guest-signin-form" className="p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Sign in as a guest
        </h2>
        <p className="mt-2 text-slate-500">
          We&apos;ll send you a secure link — no password needed.
        </p>
      </div>

      {/* Form */}
      <Form {...form}>
        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-medium">Email address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      {...field}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="h-12 pl-12 rounded-xl border-slate-200 bg-white text-base focus:border-slate-400 focus:ring-slate-400"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status Message */}
          {status && (
            <div ref={statusRef} tabIndex={-1} className="focus:outline-none">
              <GuestStatus
                title={status.message}
                tone={status.tone === 'error' ? 'danger' : status.tone}
                aria-live={status.live}
                className="rounded-xl"
              />
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full rounded-xl bg-slate-900 text-base font-semibold hover:bg-slate-800 shadow-lg transition-all"
            disabled={submitDisabled}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Sending...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Send className="h-5 w-5" aria-hidden />
                {submitLabel}
              </span>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
