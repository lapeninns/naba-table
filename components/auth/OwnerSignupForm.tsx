'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getBrowserCsrfToken } from '@/lib/security/csrf';
import { fetchJson } from '@/lib/http/fetchJson';
import { HttpError } from '@/lib/http/errors';
import { cn } from '@/lib/utils';

type SignupMode = 'magic_link' | 'password';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
  password: z.string().trim().min(12, 'Password must be at least 12 characters').max(256).optional(),
  mode: z.enum(['magic_link', 'password']),
});

type FormValues = z.infer<typeof schema>;

type StatusTone = 'info' | 'success' | 'error';

type StatusState = {
  message: string;
  tone: StatusTone;
  live: 'polite' | 'assertive';
};

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  info: 'text-muted-foreground',
  success: 'text-emerald-600',
  error: 'text-red-600',
};

const PASSWORD_HELP = 'Use at least 12 characters, including a number and a symbol.';

type SignupResponse =
  | { status: 'ok'; redirectTo?: string }
  | { status: 'magic_link_sent'; redirectTo?: string };

export function OwnerSignupForm() {
  const router = useRouter();
  const [mode, setMode] = useState<SignupMode>('password');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusState | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', mode: 'password' },
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
  });

  useEffect(() => {
    form.setValue('mode', mode);
  }, [form, mode]);

  const focusStatus = () => {
    setTimeout(() => statusRef.current?.focus(), 0);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setStatus(null);

    const csrf = getBrowserCsrfToken();
    const payload = {
      mode: values.mode,
      email: values.email,
      password: values.mode === 'password' ? values.password : undefined,
      redirectedFrom: '/onboarding/profile',
    };

    try {
      const response = await fetchJson<SignupResponse>('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 'magic_link_sent') {
        setStatus({
          message: 'Magic link sent! Check your inbox to finish creating your account.',
          tone: 'success',
          live: 'assertive',
        });
        focusStatus();
        return;
      }

      router.push(response.redirectTo || '/onboarding/profile');
    } catch (error) {
      const message =
        error instanceof HttpError
          ? error.message || 'Signup failed. Please check your details and try again.'
          : 'Signup failed. Please try again.';
      setStatus({ message, tone: 'error', live: 'assertive' });
      focusStatus();
    } finally {
      setIsSubmitting(false);
    }
  });

  const statusClass = useMemo(() => (status ? STATUS_TONE_CLASSES[status.tone] : ''), [status]);

  return (
    <Card className="w-full max-w-xl border-border/70 bg-white/95 shadow-lg shadow-primary/5">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Step 1 · Account</p>
        </div>
        <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
          Create your owner account
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Use a work email so your team can be added later. You can choose magic link or password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs
          value={mode}
          onValueChange={(value) => {
            console.log('Tabs onValueChange:', value);
            setMode(value as SignupMode);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="magic_link" onClick={() => console.log('Clicked magic_link')}>Magic link</TabsTrigger>
            <TabsTrigger value="password" onClick={() => console.log('Clicked password')}>Email &amp; password</TabsTrigger>
          </TabsList>
          <TabsContent value="magic_link" className="mt-4 text-sm text-muted-foreground">
            We’ll email you a one-time link to sign in. No password required.
          </TabsContent>
          <TabsContent value="password" className="mt-4 text-sm text-muted-foreground">
            Set a strong password for repeat sign-ins. {PASSWORD_HELP}
          </TabsContent>
        </Tabs>

        <Form {...form}>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
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
                      autoComplete="email"
                      spellCheck={false}
                      disabled={isSubmitting}
                      aria-describedby="signup-email-help"
                    />
                  </FormControl>
                  <p id="signup-email-help" className="text-xs text-muted-foreground">
                    We’ll never share your email or send spam.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === 'password' ? (
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
                        autoComplete="new-password"
                        disabled={isSubmitting}
                        placeholder="Strong password"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{PASSWORD_HELP}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Mail className="mr-2 h-4 w-4" aria-hidden />}
              {mode === 'magic_link' ? 'Send magic link' : 'Create account'}
            </Button>
          </form>
        </Form>

        {status ? (
          <p
            ref={statusRef}
            tabIndex={-1}
            className={cn('rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm', statusClass)}
            aria-live={status.live}
          >
            {status.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
