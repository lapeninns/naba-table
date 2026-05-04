'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOpsCreateTeamInvite } from '@/hooks/ops/useOpsTeamInvitations';

import {
  TEAM_INVITE_ROLE_OPTIONS,
  teamInviteFormSchema,
  type TeamInviteFormValues,
} from './teamInviteModel';

import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type { TeamInvite } from '@/services/ops/team';

type TeamInviteFormProps = {
  restaurantId: string;
};

type LastInvite = {
  invite: TeamInvite;
  inviteUrl: string;
};

export function TeamInviteForm({ restaurantId }: TeamInviteFormProps) {
  const createInvite = useOpsCreateTeamInvite();
  const [lastInvite, setLastInvite] = useState<LastInvite | null>(null);

  const form = useForm<TeamInviteFormValues>({
    resolver: zodResolver(teamInviteFormSchema),
    defaultValues: {
      email: '',
      role: 'host',
    },
  });

  const onSubmit = async (values: TeamInviteFormValues) => {
    try {
      const result = await createInvite.mutateAsync({
        restaurantId,
        email: values.email,
        role: values.role as RestaurantRole,
      });
      setLastInvite(result);
      form.reset({ email: '', role: values.role });
    } catch {
      // Errors are surfaced via mutation error state.
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
    <SettingsCard
      title="Invite a team member"
      description="Owners and managers can invite teammates to manage reservations and guest communication."
      contentClassName="flex flex-col gap-4"
    >
        {createInvite.error ? (
          <Alert variant="destructive">
            <AlertTitle>Invitation was not sent</AlertTitle>
            <AlertDescription>{createInvite.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <FormRoot
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        {TEAM_INVITE_ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full md:w-auto" disabled={createInvite.isPending}>
              {createInvite.isPending ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                  Sending
                </>
              ) : (
                'Send invite'
              )}
            </Button>
          </FormRoot>
        </Form>

        {lastInvite ? (
          <Alert variant="success">
            <AlertTitle>Invitation link ready</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p>
                  Share this link directly with {lastInvite.invite.email}. It expires on{' '}
                  {new Date(lastInvite.invite.expiresAt).toLocaleString()}.
                </p>
                <div className="flex min-w-0 items-center gap-2">
                  <code className="min-w-0 max-w-[320px] truncate rounded bg-background px-3 py-2 text-xs text-muted-foreground shadow-inner">
                    {lastInvite.inviteUrl}
                  </code>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyInvite}>
                    <Copy data-icon="inline-start" aria-hidden />
                    Copy
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
    </SettingsCard>
  );
}
