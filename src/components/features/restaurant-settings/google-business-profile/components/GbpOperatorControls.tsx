'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOpsGbpOperatorState } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { HttpError } from '@/lib/http/errors';

import { GbpOperatorStateDetails } from './GbpOperatorStateDetails';
import { GbpTerminalNotices } from './GbpTerminalNotices';

export function GbpOperatorControls({ restaurantId }: { readonly restaurantId: string }) {
  const operator = useOpsGbpOperatorState(restaurantId);
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
          state.writeState === 'eligible' ? 'Google writes disabled.' : 'Google writes enabled.',
        );
      } else {
        await operator.setNotificationParticipationMutation.mutateAsync({
          enabled: !state.notifications.enabled,
          password,
        });
        toast.success(
          state.notifications.enabled
            ? 'Google notifications disabled.'
            : 'Google notifications enabled.',
        );
      }
      setPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update Google controls.');
    }
  };

  if (operator.connectionQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading Google operator controls…</p>;
  }
  if (operator.connectionQuery.error || !state) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load Google operator controls</AlertTitle>
        <AlertDescription>
          The admin-gated connection state could not be verified. Writes remain unavailable.
        </AlertDescription>
      </Alert>
    );
  }

  const notificationLocations = `${state.notifications.refCount} linked location${state.notifications.refCount === 1 ? '' : 's'}`;

  return (
    <div className="flex flex-col gap-4" data-testid="gbp-operator-controls">
      <Card variant="compact" className="border-border/70 shadow-none">
        <CardHeader className="p-4 pb-3 sm:px-5">
          <CardTitle className="text-base">Google write controls</CardTitle>
          <CardDescription>
            Exact admin-gated state. Password confirmation is required for every eligibility or
            notification change.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 pb-4 sm:px-5">
          <GbpOperatorStateDetails state={state} />
          {mutationError ? (
            <Alert variant="destructive">
              <AlertTitle>
                {mutationError instanceof HttpError &&
                mutationError.code === 'GBP_NOTIFICATION_TOPIC_CONFLICT'
                  ? 'Google notification topic conflict'
                  : 'Google control update failed'}
              </AlertTitle>
              <AlertDescription>{mutationError.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="gbp-operator-password">Confirm your password</Label>
            <Input
              id="gbp-operator-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={state.writeState === 'eligible' ? 'destructive' : 'default'}
              disabled={!password || pending || state.writeState === 'revoking'}
              onClick={() => void runProtected('write')}
            >
              {state.writeState === 'eligible' ? 'Disable Google writes' : 'Enable Google writes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!password || pending}
              onClick={() => void runProtected('notifications')}
            >
              {state.notifications.enabled ? 'Disable notifications' : 'Enable notifications'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Notifications: {state.notifications.enabled ? 'participating' : 'not participating'} ·{' '}
            {notificationLocations}
          </p>
        </CardContent>
      </Card>

      <Card variant="compact" className="border-border/70 shadow-none">
        <CardHeader className="p-4 pb-3 sm:px-5">
          <CardTitle className="text-base">Operational outcomes</CardTitle>
          <CardDescription>
            Provider and delivery outcomes are loaded fresh and are never stored persistently.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          {operator.terminalNoticesQuery.data ? (
            <GbpTerminalNotices data={operator.terminalNoticesQuery.data} />
          ) : (
            <p className="text-sm text-muted-foreground">No notice data is available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
