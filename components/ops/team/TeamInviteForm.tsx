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
import type { RestaurantInvite } from '@/lib/owner/team/schema';
import { useCreateTeamInvite } from '@/hooks/owner/useTeamInvitations';

const formSchema = z.object({
  email: z.string().trim().min(1, 'Enter an email address').email('Enter a valid email'),
  role: z.enum(RESTAURANT_ROLE_OPTIONS),
});

type FormValues = z.infer<typeof formSchema>;

type TeamInviteFormProps = {
  restaurantId: string;
};

export function TeamInviteForm({ restaurantId }: TeamInviteFormProps) {
  const createInvite = useCreateTeamInvite();
  const [lastInvite, setLastInvite] = useState<{ invite: RestaurantInvite; inviteUrl: string } | null>(null);

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
        role: values.role,
      });
      setLastInvite({ invite: result.invite, inviteUrl: result.inviteUrl });
      form.reset({ email: '', role: values.role });
    } catch (error) {
      // Error handled in mutation hook toast
    }
  };

  const handleCopyInvite = async () => {
    if (!lastInvite?.inviteUrl || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(lastInvite.inviteUrl);
    } catch {
      // no-op; user can copy manually
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Invite a team member</h2>
        <p className="text-sm text-slate-600">
          Owners and managers can invite additional teammates to manage reservations and guest communication.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
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
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
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
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">Invitation link ready</p>
              <p className="text-xs text-slate-500">
                Share this link directly with {lastInvite.invite.email}. It expires on{' '}
                {new Date(lastInvite.invite.expiresAt).toLocaleString()}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="max-w-[320px] truncate rounded bg-white px-3 py-2 text-xs text-slate-600 shadow-inner">
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
