'use client';

import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/typography';
import { HttpError } from '@/lib/http/errors';

import { GbpOperatorStateDetails } from './GbpOperatorStateDetails';
import { GbpTerminalNotices } from './GbpTerminalNotices';

import type { useOpsGbpOperatorState } from '@/hooks/ops/useOpsGoogleBusinessProfile';

export type GbpOperatorState = ReturnType<typeof useOpsGbpOperatorState>;

export type GbpOperatorControlsProps = {
  readonly operator: GbpOperatorState;
  readonly onRequestRefresh?: () => void;
  readonly refreshPending?: boolean;
};

/** Admin-gated write state, the password-confirmed switches and terminal provider notices. */
export function GbpOperatorControls({
  operator,
  onRequestRefresh,
  refreshPending,
}: GbpOperatorControlsProps) {
  const [password, setPassword] = useState('');
  const state = operator.connectionQuery.data ?? operator.setWriteAccessMutation.data;
  const pending =
    operator.setWriteAccessMutation.isPending ||
    operator.setNotificationParticipationMutation.isPending;
  const mutationError =
    operator.setWriteAccessMutation.error ??
    operator.setNotificationParticipationMutation.error ??
    null;

  const runProtected = async (kind: 'write' | 'notifications') => {
    if (!state || !password) return;
    try {
      if (kind === 'write') {
        await operator.setWriteAccessMutation.mutateAsync({
          eligible: state.writeState !== 'eligible',
          password,
        });
        toast.success(
          state.writeState === 'eligible'
            ? 'Google writes turned off.'
            : 'Google writes turned on.',
        );
      } else {
        await operator.setNotificationParticipationMutation.mutateAsync({
          enabled: !state.notifications.enabled,
          password,
        });
        toast.success(
          state.notifications.enabled
            ? 'Google notifications turned off.'
            : 'Google notifications turned on.',
        );
      }
      setPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update Google controls.');
    }
  };

  if (operator.connectionQuery.isLoading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading Google write controls…
      </p>
    );
  }
  if (operator.connectionQuery.error || !state) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden />
        <AlertTitle>Unable to load Google write controls</AlertTitle>
        <AlertDescription>
          The admin-gated connection state could not be verified. Writes remain unavailable.
        </AlertDescription>
      </Alert>
    );
  }

  const notificationLocations = `${state.notifications.refCount} linked location${state.notifications.refCount === 1 ? '' : 's'}`;
  const writesOn = state.writeState === 'eligible';

  return (
    <div className="flex flex-col gap-4" data-testid="gbp-operator-controls">
      <GbpOperatorStateDetails
        state={state}
        onRequestRefresh={onRequestRefresh}
        refreshPending={refreshPending}
      />
      {mutationError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>
            {mutationError instanceof HttpError &&
            mutationError.code === 'GBP_NOTIFICATION_TOPIC_CONFLICT'
              ? 'Google notification topic conflict'
              : 'Google control update failed'}
          </AlertTitle>
          <AlertDescription>{mutationError.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="gbp-operator-password">Confirm your password</Label>
        <Input
          id="gbp-operator-password"
          type="password"
          autoComplete="current-password"
          aria-describedby="gbp-operator-password-help"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
        <Text variant="caption" id="gbp-operator-password-help">
          Every write or notification change asks for your password.
        </Text>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={writesOn ? 'destructive' : 'default'}
          disabled={!password || pending || state.writeState === 'revoking'}
          onClick={() => void runProtected('write')}
          className="[@media(pointer:coarse)]:min-h-11"
        >
          {writesOn ? 'Turn off Google writes' : 'Turn on Google writes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!password || pending}
          onClick={() => void runProtected('notifications')}
          className="[@media(pointer:coarse)]:min-h-11"
        >
          {state.notifications.enabled ? 'Turn off notifications' : 'Turn on notifications'}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Notifications: {state.notifications.enabled ? 'participating' : 'not participating'} ·{' '}
        {notificationLocations}
      </p>
      <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
        <Text variant="subheading" as="h4">
          Provider outcomes
        </Text>
        <Text variant="caption">Loaded fresh from Nabatable and never stored in this browser.</Text>
        {operator.terminalNoticesQuery.data ? (
          <GbpTerminalNotices data={operator.terminalNoticesQuery.data} />
        ) : (
          <p className="text-sm text-muted-foreground">No notice data is available.</p>
        )}
      </div>
    </div>
  );
}
