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
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

import type { AuthApiError } from '@supabase/supabase-js';

const formSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
});

export type SignInFormProps = {
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

export function SignInForm({ redirectedFrom }: SignInFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

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

  const targetPath = redirectedFrom && redirectedFrom.startsWith('/') ? redirectedFrom : '/dashboard';

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
  }, [form]);

  const focusStatus = () => {
    setTimeout(() => statusRef.current?.focus(), 0);
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
          emailRedirectTo:
            typeof window !== 'undefined' ? `${window.location.origin}${targetPath}` : undefined,
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
    await handleMagicLink(values);
  });

  const submitLabel = magicCooldown > 0 ? `Resend in ${magicCooldown}s` : 'Send magic link';

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

            <Button type="submit" className="w-full touch-manipulation" disabled={isSubmitting || magicCooldown > 0}>
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
