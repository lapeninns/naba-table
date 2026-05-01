'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, Send } from 'lucide-react';
import Script from 'next/script';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { GuestStatus } from '@/components/guest/ui';
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
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';

const formSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
});

type AuthResponse = { status: 'magic_link_sent'; redirectTo: string };

const AUTH_ENDPOINT = '/api/auth/signin';
const TURNSTILE_ACTION = 'guest_signin_magic_link';
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';

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

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
};

type TurnstileApi = {
  render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function GuestSignInForm({ redirectedFrom }: GuestSignInFormProps) {
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
  const captchaContainerRef = useRef<HTMLDivElement | null>(null);
  const captchaWidgetIdRef = useRef<string | null>(null);
  const isCaptchaEnabled = TURNSTILE_SITE_KEY.length > 0;
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaScriptReady, setCaptchaScriptReady] = useState<boolean>(
    () => typeof window !== 'undefined' && Boolean(window.turnstile),
  );

  const allowedRedirectPrefixes = ['/guest', '/bookings', '/restaurants', '/app'];
  const isSafeRedirect =
    !!redirectedFrom &&
    redirectedFrom.startsWith('/') &&
    !redirectedFrom.startsWith('//') &&
    allowedRedirectPrefixes.some((prefix) => redirectedFrom.startsWith(prefix));
  const targetPath = isSafeRedirect ? redirectedFrom : '/guest/dashboard';

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
    captchaToken?: string;
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
        if (error.code === 'CAPTCHA_REQUIRED') {
          return {
            message: 'Complete the verification challenge to continue.',
            tone: 'error',
            live: 'assertive',
          };
        }
        if (error.code === 'CAPTCHA_INVALID') {
          const reason =
            typeof error.details === 'object' && error.details !== null && 'reason' in error.details
              ? (error.details as { reason?: string }).reason
              : undefined;
          return {
            message:
              reason === 'verify_unavailable' || reason === 'missing_secret'
                ? 'Verification is temporarily unavailable. Please try again shortly.'
                : 'Verification failed. Please complete the challenge and try again.',
            tone: 'error',
            live: 'assertive',
          };
        }
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

  useEffect(() => {
    if (!isCaptchaEnabled) return;
    if (window.turnstile) {
      setCaptchaScriptReady(true);
    }
  }, [isCaptchaEnabled]);

  useEffect(() => {
    if (!isCaptchaEnabled || !captchaScriptReady || !window.turnstile) return;
    if (!captchaContainerRef.current || captchaWidgetIdRef.current) return;

    const widgetId = window.turnstile.render(captchaContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      action: TURNSTILE_ACTION,
      callback: (token) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(null),
      'error-callback': () => setCaptchaToken(null),
    });
    captchaWidgetIdRef.current = widgetId;
  }, [isCaptchaEnabled, captchaScriptReady]);

  const resetCaptcha = () => {
    if (!isCaptchaEnabled) return;
    setCaptchaToken(null);
    if (captchaWidgetIdRef.current && window.turnstile) {
      window.turnstile.reset(captchaWidgetIdRef.current);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (magicCooldown > 0) {
      return;
    }
    if (isCaptchaEnabled && !captchaToken) {
      setStatus({
        message: 'Complete the verification challenge to continue.',
        tone: 'error',
        live: 'assertive',
      });
      focusStatus();
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
        captchaToken: isCaptchaEnabled ? (captchaToken ?? undefined) : undefined,
      });

      track('auth_magiclink_sent', { redirectedFrom: response.redirectTo ?? targetPath });
      emit('auth_magiclink_sent', { redirectedFrom: response.redirectTo ?? targetPath });

      setStatus({
        message: 'Magic link sent. Check your inbox to finish signing in.',
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
      resetCaptcha();
      setIsSubmitting(false);
    }
  });

  const submitDisabled =
    isSubmitting ||
    magicCooldown > 0 ||
    (isCaptchaEnabled && (!captchaScriptReady || !captchaToken));
  const submitLabel = magicCooldown > 0 ? `Resend in ${magicCooldown}s` : 'Send magic link';

  return (
    <div id="guest-signin-form" className="space-y-6">
      {isCaptchaEnabled ? (
        <Script
          src={TURNSTILE_SCRIPT_SRC}
          strategy="afterInteractive"
          onLoad={() => setCaptchaScriptReady(true)}
        />
      ) : null}

      <Form {...form}>
        <FormRoot className="space-y-5" onSubmit={onSubmit} noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel
                  htmlFor="guest-signin-email"
                  className="text-sm font-semibold text-foreground"
                >
                  Email address
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      {...field}
                      id="guest-signin-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="pg-focus-ring h-12 rounded-[var(--pg-radius-md)] border-border bg-background pl-12 text-base shadow-[var(--pg-shadow-xs)] touch-manipulation"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-sm" />
              </FormItem>
            )}
          />

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

          {isCaptchaEnabled ? (
            <div className="space-y-2">
              <div
                ref={captchaContainerRef}
                className="min-h-[70px] rounded-[var(--pg-radius-md)] border border-border/80 bg-muted/35 p-2"
                data-testid="guest-signin-turnstile"
              />
              <p className="pg-caption">Complete verification to enable magic-link delivery.</p>
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="pg-action pg-focus-ring pg-touch h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-[var(--pg-shadow-button)] hover:bg-primary/90 active:scale-[0.98] disabled:active:scale-100 touch-manipulation"
            disabled={submitDisabled}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Sending...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Send className="h-5 w-5" aria-hidden="true" />
                {submitLabel}
              </span>
            )}
          </Button>
        </FormRoot>
      </Form>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        By signing in, you agree to receive secure sign-in emails and to our{' '}
        <Button
          variant="link"
          className="pg-focus-ring h-auto rounded-sm p-0 text-xs font-medium text-primary underline-offset-2"
          asChild
        >
          <a href="/privacy">Privacy Policy</a>
        </Button>
      </p>
    </div>
  );
}
