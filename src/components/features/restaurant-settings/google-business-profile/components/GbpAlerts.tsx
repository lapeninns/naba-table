'use client';

import {
  CheckCircle2,
  CircleAlert,
  Lock,
  OctagonAlert,
  PauseCircle,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { hasUnknownGbpPublishOutcome } from '../../dual-sync/gbpPublishOutcomeDomain';
import { formatGbpTime, type GbpReconnectReason } from '../gbpPageModel';

import type { GbpConnectionStateResponseV1, GbpPublishResponseV1 } from '@/services/ops/dual-sync';
import type { ReactNode } from 'react';

type Action = {
  readonly label: string;
  readonly onClick: () => void;
  readonly pending?: boolean;
  /** Shows the refresh icon (spinning while pending). */
  readonly refresh?: boolean;
};

export type GbpAlertsProps = {
  readonly operator: GbpConnectionStateResponseV1 | null;
  readonly operatorUnavailable: boolean;
  readonly onRetryOperator: () => void;
  readonly reauth: {
    /** Why Google must be reconnected; null when it need not be. */
    readonly reason: GbpReconnectReason | null;
    readonly account: string;
    readonly onReconnect: Action;
  } | null;
  readonly syncError: string | null;
  readonly refresh: Action & { readonly disabled?: boolean };
  readonly paused: { readonly reason: string; readonly onResume: Action } | null;
  readonly lastPublish: {
    readonly result: GbpPublishResponseV1;
    readonly onShow: () => void;
  } | null;
};

function ActionButton({
  action,
  primary = false,
}: {
  action: Action & { disabled?: boolean };
  primary?: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={primary ? 'default' : 'outline'}
      onClick={action.onClick}
      disabled={action.pending || action.disabled}
    >
      {action.refresh ? (
        <RefreshCw
          data-icon="inline-start"
          className={cn(action.pending && 'animate-spin motion-reduce:animate-none')}
          aria-hidden
        />
      ) : null}
      {action.label}
    </Button>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 flex flex-wrap items-center gap-2">{children}</div>;
}

/**
 * Everything that currently limits the page, most serious first. Each alert says what happened
 * and offers the one action that clears it.
 */
export function GbpAlerts({
  operator,
  operatorUnavailable,
  onRetryOperator,
  reauth,
  syncError,
  refresh,
  paused,
  lastPublish,
}: GbpAlertsProps) {
  const pending = operator?.pendingUpdates;
  const alerts: ReactNode[] = [];

  if (operatorUnavailable) {
    alerts.push(
      <Alert key="ops" variant="destructive" data-testid="gbp-alert-write-controls">
        <OctagonAlert className="size-4" aria-hidden />
        <AlertTitle>Write controls unavailable: publishing is off</AlertTitle>
        <AlertDescription>
          Nabatable could not load the connection’s write state. Until it loads, nothing can be sent
          to Google. Comparing and reading still work.
          <Actions>
            <ActionButton action={{ label: 'Try again', onClick: onRetryOperator }} />
          </Actions>
        </AlertDescription>
      </Alert>,
    );
  }

  if (pending?.state === 'unknown') {
    alerts.push(
      <Alert key="failstop" variant="destructive" role="alert" data-testid="gbp-alert-fail-stop">
        <OctagonAlert className="size-4" aria-hidden />
        <AlertTitle>Publishing stopped: Google has updates Nabatable can’t account for</AlertTitle>
        <AlertDescription>
          After the last publish, Google reported changes Nabatable cannot read. Publishing again
          now could overwrite them. Get the latest from Google, check the listing, then create a new
          preview.
          <span className="mt-2 flex flex-wrap gap-1.5" aria-label="Unknown paths">
            {pending.unknownPaths.map((path) => (
              <Badge key={path} variant="outline" className="font-mono font-normal">
                {path}
              </Badge>
            ))}
          </span>
          <span className="mt-1.5 block text-xs">
            Observed {formatGbpTime(pending.observedAt)} · stops blocking{' '}
            {formatGbpTime(pending.expiresAt)} at the latest · reason{' '}
            <span className="font-mono">{operator?.reasonCode ?? 'pending_updates_unknown'}</span>
          </span>
          <Actions>
            <ActionButton action={refresh} />
          </Actions>
        </AlertDescription>
      </Alert>,
    );
  }

  if (reauth?.reason === 'access_lost') {
    alerts.push(
      <Alert key="reauth" variant="destructive" data-testid="gbp-alert-reauth">
        <TriangleAlert className="size-4" aria-hidden />
        <AlertTitle>Reconnect Google: access to this listing was lost</AlertTitle>
        <AlertDescription>
          Google refused access to this listing
          {operator?.reasonCode ? (
            <>
              {' '}
              (<span className="font-mono">{operator.reasonCode}</span>)
            </>
          ) : null}
          , so Nabatable can’t read or compare it. This usually means {reauth.account} is no longer
          an owner or manager of the listing on Google. Reconnect with a Google account that manages
          it. The listing stays linked, and your Nabatable settings are unchanged.
          <Actions>
            <ActionButton action={reauth.onReconnect} primary />
          </Actions>
        </AlertDescription>
      </Alert>,
    );
  } else if (reauth?.reason === 'expired') {
    alerts.push(
      <Alert key="reauth" variant="destructive" data-testid="gbp-alert-reauth">
        <TriangleAlert className="size-4" aria-hidden />
        <AlertTitle>Reconnect Google to keep publishing</AlertTitle>
        <AlertDescription>
          Google access for {reauth.account} has expired
          {operator?.refresh.safeErrorCode ? (
            <>
              {' '}
              (<span className="font-mono">{operator.refresh.safeErrorCode}</span>)
            </>
          ) : null}
          . You can still read the last comparison
          {operator?.refresh.lastSucceededAt
            ? `, from ${formatGbpTime(operator.refresh.lastSucceededAt)}`
            : ''}
          . Reconnect with the same account to publish again.
          <Actions>
            <ActionButton action={reauth.onReconnect} primary />
          </Actions>
        </AlertDescription>
      </Alert>,
    );
  }

  // Retrying cannot fix lost or expired access, so the reconnect alert replaces the sync error.
  if (syncError !== null && !reauth?.reason) {
    alerts.push(
      <Alert key="sync-error" variant="destructive" data-testid="gbp-alert-sync-error">
        <CircleAlert className="size-4" aria-hidden />
        <AlertTitle>Couldn’t reach Google</AlertTitle>
        <AlertDescription>
          {syncError ? <span className="block break-words">{syncError}</span> : null}
          The differences below may be out of date.
          <Actions>
            <ActionButton action={refresh} />
          </Actions>
        </AlertDescription>
      </Alert>,
    );
  }

  if (operator && !operator.rollout.eligible) {
    alerts.push(
      <Alert key="rollout" variant="info" data-testid="gbp-alert-rollout">
        <Lock className="size-4" aria-hidden />
        <AlertTitle>Publishing to Google isn’t enabled for this venue yet</AlertTitle>
        <AlertDescription>
          Google writes are being rolled out venue by venue. This venue is not in the rollout (
          <span className="font-mono">{operator.rollout.reason}</span>). You can compare, and save
          Google’s values in Nabatable.
        </AlertDescription>
      </Alert>,
    );
  }

  if (paused) {
    alerts.push(
      <Alert key="paused" variant="warning" data-testid="gbp-alert-paused">
        <PauseCircle className="size-4" aria-hidden />
        <AlertTitle>Sync is paused</AlertTitle>
        <AlertDescription>
          {paused.reason} Nabatable is not comparing or publishing while sync is paused.
          <Actions>
            <ActionButton action={paused.onResume} />
          </Actions>
        </AlertDescription>
      </Alert>,
    );
  }

  if (lastPublish && lastPublish.result.mode === 'immediate') {
    const { result } = lastPublish;
    const unknown = hasUnknownGbpPublishOutcome(result);
    const failed = result.outcomes.some((outcome) => outcome.status === 'failed');
    alerts.push(
      <Alert
        key="last-publish"
        variant={unknown || failed ? 'warning' : 'success'}
        data-testid="gbp-alert-last-publish"
      >
        {unknown || failed ? (
          <TriangleAlert className="size-4" aria-hidden />
        ) : (
          <CheckCircle2 className="size-4" aria-hidden />
        )}
        <AlertTitle>
          {unknown
            ? 'Outcome unknown for part of the last publish'
            : failed
              ? 'Last publish did not complete'
              : 'Google confirmed the last publish'}
        </AlertTitle>
        <AlertDescription>
          {unknown
            ? 'Google did not confirm whether some writes were applied. They are not shown as published. Get the latest from Google before publishing again.'
            : failed
              ? 'Google rejected a write, so the rest of the bundle was not sent. Nothing marked “Not sent” reached Google.'
              : `${result.outcomes.length} ${result.outcomes.length === 1 ? 'write was' : 'writes were'} confirmed by Google.`}
          <Actions>
            <ActionButton action={{ label: 'See each change', onClick: lastPublish.onShow }} />
          </Actions>
        </AlertDescription>
      </Alert>,
    );
  } else if (lastPublish?.result.mode === 'queued') {
    alerts.push(
      <Alert key="last-publish" variant="info" data-testid="gbp-alert-last-publish">
        <CircleAlert className="size-4" aria-hidden />
        <AlertTitle>Last publish is queued, not complete</AlertTitle>
        <AlertDescription>
          Follow job <span className="font-mono">{lastPublish.result.jobId}</span> under Operations
          for Google’s final outcome.
        </AlertDescription>
      </Alert>,
    );
  }

  return alerts.length ? <div className="flex min-w-0 flex-col gap-3">{alerts}</div> : null;
}
