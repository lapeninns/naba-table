'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Text } from '@/components/ui/typography';
import { invitationAcceptResponseSchema } from '@/lib/owner/team/schema';
import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';

const acceptanceSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
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
        if (response.status === 401) {
          router.push(`/auth/signin?redirectedFrom=/invite/${encodeURIComponent(token)}`);
          return;
        }
        const message =
          typeof payload?.error === 'string' ? payload.error : 'Unable to accept invitation';
        setErrorMessage(message);
        return;
      }

      invitationAcceptResponseSchema.parse(payload);
      router.refresh();
      router.push('/app');
    } catch (error) {
      console.error('[invite][accept] unexpected error', error);
      const message = 'Something went wrong while accepting the invitation.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerClassName = 'space-y-6';
  const cardClassName = 'w-full max-w-xl shadow-sm';

  return (
    <div className={containerClassName}>
      <Card className={cardClassName}>
        <CardHeader className="space-y-2 text-center">
          <CardTitle
            className="text-2xl font-semibold text-foreground"
            role="heading"
            aria-level={1}
          >
            Join {invite.restaurantName}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {invite.inviterName ? `${invite.inviterName} invited you` : 'You have been invited'} to
            join the team as a{' '}
            <span className="font-medium capitalize text-foreground">{invite.role}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
            <p className="font-medium">Invitation details</p>
            <p>
              Email: <span className="font-mono text-foreground">{invite.email}</span>
            </p>
            <p>Expires: {new Date(invite.expiresAt).toLocaleString()}</p>
          </div>

          <Form {...form}>
            <FormRoot className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
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

              {errorMessage ? (
                <Text variant="caption" className="text-destructive" role="alert">
                  {errorMessage}
                </Text>
              ) : null}

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
            </FormRoot>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
