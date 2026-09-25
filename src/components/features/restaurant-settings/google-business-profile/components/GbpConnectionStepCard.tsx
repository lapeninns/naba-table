'use client';

import { AlertCircle, Info, Loader2, Lock, RefreshCcw, Unplug } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { GbpDetailList } from './GbpDetailList';
import { GbpStepCard } from './GbpStepCard';
import { StatusBadge, connectionStatusBadge } from './StatusBadge';
import { formatLastSync } from '../lib/formatters';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

const HOW_CONNECTING_WORKS = [
  'Sign in with the Google account that manages your listing.',
  'Choose the listing for this restaurant.',
  'Review the differences before anything is published.',
] as const;

export type GbpConnectionStepCardProps = {
  readonly data: GoogleBusinessProfileConnection;
  readonly accountLabel: string;
  readonly description: string;
  readonly done: boolean;
  /** A failed connect attempt reported by the API while Google is not linked. */
  readonly connectError: string | null;
  readonly onConnect: () => void;
  readonly isConnecting: boolean;
  readonly onRefresh: (() => void) | null;
  readonly isRefreshing: boolean;
  readonly onRequestDisconnect: (() => void) | null;
  readonly isDisconnecting: boolean;
};

export function GbpConnectionStepCard({
  data,
  accountLabel,
  description,
  done,
  connectError,
  onConnect,
  isConnecting,
  onRefresh,
  isRefreshing,
  onRequestDisconnect,
  isDisconnecting,
}: GbpConnectionStepCardProps) {
  const { status } = data;
  const badge = connectionStatusBadge(status);
  const needsConnect = status === 'unlinked' || status === 'pending_auth';
  const needsReconnect = status === 'reauth_required';

  return (
    <GbpStepCard
      id="gbp-connection"
      testId="gbp-connection-card"
      step={1}
      title="Connection"
      description={description}
      done={done}
      status={<StatusBadge tone={badge.tone} label={badge.label} />}
    >
      {status === 'unlinked' ? (
        <ol
          aria-label="How connecting works"
          className="flex list-decimal flex-col gap-1 pl-5 text-sm leading-6 text-foreground"
        >
          {HOW_CONNECTING_WORKS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      ) : (
        <GbpDetailList
          items={[
            { label: 'Google account', value: status === 'pending_auth' ? '—' : accountLabel },
            {
              label: 'Connection status',
              value: (
                <span className="flex flex-wrap items-center gap-x-2">
                  <span>{badge.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{status}</span>
                </span>
              ),
            },
            {
              label: 'Last checked',
              value: <span className="tabular-nums">{formatLastSync(data.lastPullAt)}</span>,
            },
          ]}
        />
      )}

      {!data.isConfigured ? (
        <Alert variant="warning">
          <Lock className="size-4" aria-hidden />
          <AlertTitle>Google connection is not set up for this workspace</AlertTitle>
          <AlertDescription>
            Google Business Profile credentials are not configured in this environment, so
            connecting is unavailable. Ask your Nabatable administrator to add them.
          </AlertDescription>
        </Alert>
      ) : null}

      {status === 'pending_auth' ? (
        <Alert>
          <Info className="size-4" aria-hidden />
          <AlertTitle>Waiting for Google</AlertTitle>
          <AlertDescription>
            Finish the Google consent screen to complete the connection. If you closed it, select
            Connect Google again.
          </AlertDescription>
        </Alert>
      ) : null}

      {status === 'sync_error' ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Couldn’t reach Google</AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            {data.lastError ? <span className="break-words">{data.lastError}</span> : null}
            <span>The differences below may be out of date. Check again to retry.</span>
          </AlertDescription>
        </Alert>
      ) : null}

      {needsConnect && connectError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Google did not connect</AlertTitle>
          <AlertDescription className="break-words">{connectError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {needsConnect || needsReconnect ? (
          <Button
            type="button"
            onClick={onConnect}
            disabled={!data.isConfigured || isConnecting}
            aria-busy={isConnecting || undefined}
            className="[@media(pointer:coarse)]:min-h-11"
          >
            {isConnecting ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}
            {isConnecting ? 'Connecting…' : needsReconnect ? 'Reconnect Google' : 'Connect Google'}
          </Button>
        ) : null}
        {onRefresh ? (
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="[@media(pointer:coarse)]:min-h-11"
          >
            <RefreshCcw
              data-icon="inline-start"
              className={isRefreshing ? 'animate-spin motion-reduce:animate-none' : undefined}
              aria-hidden
            />
            {isRefreshing ? 'Checking…' : 'Check again'}
          </Button>
        ) : null}
        {onRequestDisconnect ? (
          <Button
            type="button"
            variant="ghost"
            data-testid="gbp-disconnect-button"
            onClick={onRequestDisconnect}
            disabled={isDisconnecting}
            className="text-destructive hover:text-destructive [@media(pointer:coarse)]:min-h-11"
          >
            <Unplug data-icon="inline-start" aria-hidden />
            {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        ) : null}
      </div>
    </GbpStepCard>
  );
}
