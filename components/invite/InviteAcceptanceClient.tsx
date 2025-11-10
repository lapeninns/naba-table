'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { invitationAcceptResponseSchema } from '@/lib/owner/team/schema';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';

const acceptanceSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Include letters and numbers for security'),
});

type AcceptanceValues = z.infer<typeof acceptanceSchema>;

type InviteAcceptanceClientProps = {
  token: string;
  invite: {
    email: string;
    role: string;
    restaurantId: string;
    restaurantName: string;
    inviterName: string | null;
    expiresAt: string;
  };
};

export function InviteAcceptanceClient({ token, invite }: InviteAcceptanceClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<AcceptanceValues>({
    resolver: zodResolver(acceptanceSchema),
    defaultValues: {
      name: '',
      password: '',
    },
  });

  const onSubmit = async (values: AcceptanceValues) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const csrfToken = getBrowserCsrfToken();
      if (csrfToken) {
        requestHeaders[CSRF_HEADER_NAME] = csrfToken;
      }

      const response = await fetch(`/api/team/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(values),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Unable to accept invitation';
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const parsed = invitationAcceptResponseSchema.parse(payload);

      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.email,
        password: values.password,
      });

      if (signInError) {
        console.error('[invite][accept] sign-in failed', signInError.message);
        toast.success('Invitation accepted. Sign in with your new password to continue.');
      } else {
        toast.success('Invitation accepted. Welcome aboard!');
        router.push('/ops');
        router.refresh();
      }
    } catch (error) {
      console.error('[invite][accept] unexpected error', error);
      const message = 'Something went wrong while accepting the invitation.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16">
      <Card className="w-full max-w-lg border border-slate-200 shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold text-slate-900">Join {invite.restaurantName}</CardTitle>
          <CardDescription className="text-slate-600">
            {invite.inviterName ? `${invite.inviterName} invited you` : 'You have been invited'} to join the team as
            a <span className="font-medium capitalize text-slate-900">{invite.role}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium">Invitation details</p>
            <p>Email: <span className="font-mono text-slate-900">{invite.email}</span></p>
            <p>Expires: {new Date(invite.expiresAt).toLocaleString()}</p>
          </div>

          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Aarya Thapa" autoComplete="name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Create password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" autoComplete="new-password" placeholder="Minimum 10 characters" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {errorMessage ? <p className="text-sm text-red-600" role="alert">{errorMessage}</p> : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Joining…
                  </span>
                ) : (
                  'Accept invite'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
