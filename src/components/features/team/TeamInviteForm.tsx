'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RESTAURANT_ROLE_OPTIONS } from '@/lib/owner/auth/roles';
import type { RestaurantRole } from '@/lib/owner/auth/roles';
import { useOpsCreateTeamInvite } from '@/hooks';
import type { TeamInvite } from '@/services/ops/team';

type TeamInviteFormProps = {
  restaurantId: string;
};

const formSchema = z.object({
  email: z.string().trim().min(1, 'Enter an email address').email('Enter a valid email'),
  role: z.enum(RESTAURANT_ROLE_OPTIONS),
});

type FormValues = z.infer<typeof formSchema>;

type LastInvite = {
  invite: TeamInvite;
  inviteUrl: string;
};

export function TeamInviteForm({ restaurantId }: TeamInviteFormProps) {
  const createInvite = useOpsCreateTeamInvite();
  const [lastInvite, setLastInvite] = useState<LastInvite | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      role: 'host',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await createInvite.mutateAsync({
        restaurantId,
        email: values.email,
        role: values.role as RestaurantRole,
      });
      setLastInvite(result);
      form.reset({ email: '', role: values.role });
    } catch (error) {
      // errors surfaced via toast in mutation hook
    }
  };

  const handleCopyInvite = async () => {
    if (!lastInvite?.inviteUrl || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(lastInvite.inviteUrl);
    } catch {
      // ignore copy failure
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Invite a team member</h2>
        <p className="text-sm text-muted-foreground">
          Owners and managers can invite additional teammates to manage reservations and guest communication.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="teammate@example.com"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="manager">Manager</option>
                    <option value="host">Host</option>
                    <option value="server">Server</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full md:w-auto" disabled={createInvite.isPending}>
            {createInvite.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending
              </span>
            ) : (
              'Send invite'
            )}
          </Button>
        </form>
      </Form>

      {lastInvite ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-foreground">Invitation link ready</p>
              <p className="text-xs text-muted-foreground">
                Share this link directly with {lastInvite.invite.email}. It expires on {new Date(lastInvite.invite.expiresAt).toLocaleString()}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="max-w-[320px] truncate rounded bg-background px-3 py-2 text-xs text-muted-foreground shadow-inner">
                {lastInvite.inviteUrl}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={handleCopyInvite}>
                <Copy className="mr-2 h-4 w-4" aria-hidden />
                Copy
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
