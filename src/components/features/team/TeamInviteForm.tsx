'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { formatSaveScopeMessage } from '@/components/features/restaurant-settings/shared/compactSettingsClasses';
import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
};

export function TeamInviteForm({ restaurantId }: TeamInviteFormProps) {
  const createInvite = useOpsCreateTeamInvite();
  const [lastInvite, setLastInvite] = useState<LastInvite | null>(null);

  const form = useForm<TeamInviteFormValues>({
    resolver: zodResolver(teamInviteFormSchema),
    mode: 'onChange',
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
          <div className="md:col-span-3">
            <p className="text-sm font-semibold text-foreground">Who to invite</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Send access to one teammate at a time.
            </p>
          </div>
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

          <div className="md:col-span-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Access scope</p>
              <Badge variant="outline">Restaurant only</Badge>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Role controls this restaurant&apos;s bookings, guest communication, and settings
              access.
            </p>
          </div>

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
                <p className="text-xs text-muted-foreground">
                  Hosts can manage bookings and guest communication. Use manager access only for
                  trusted staff who should manage settings.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full md:w-auto"
            disabled={createInvite.isPending || !form.formState.isValid}
          >
            {createInvite.isPending ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                Sending
              </>
            ) : (
              'Send invite'
            )}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground md:col-span-3">
            {formatSaveScopeMessage('team')}
          </p>
        </FormRoot>
      </Form>

      {lastInvite ? (
        <Alert variant="success">
          <AlertTitle>Invitation sent</AlertTitle>
          <AlertDescription>
            The invitation email was sent to {lastInvite.invite.email}. It expires on{' '}
            {new Date(lastInvite.invite.expiresAt).toLocaleString()}.
          </AlertDescription>
        </Alert>
      ) : null}
    </SettingsCard>
  );
}
