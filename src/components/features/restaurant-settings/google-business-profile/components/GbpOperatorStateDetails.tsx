import { OctagonAlert, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { GbpDetailList } from './GbpDetailList';

import type { GbpConnectionStateResponseV1 } from '@/services/ops/dual-sync';

function time(value: string | null): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function paths(values: readonly string[]) {
  if (values.length === 0) return <span className="text-muted-foreground">None</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Badge key={value} variant="outline" className="font-mono font-normal">
          {value}
        </Badge>
      ))}
    </span>
  );
}

export type GbpOperatorStateDetailsProps = {
  readonly state: GbpConnectionStateResponseV1;
  /** Starts a fresh Google refresh; omitted where the review workspace is unavailable. */
  readonly onRequestRefresh?: () => void;
  readonly refreshPending?: boolean;
};

export function GbpOperatorStateDetails({
  state,
  onRequestRefresh,
  refreshPending = false,
}: GbpOperatorStateDetailsProps) {
  const pending = state.pendingUpdates;

  return (
    <div className="flex flex-col gap-4">
      {pending.state === 'unknown' ? (
        <Alert variant="destructive">
          <OctagonAlert className="size-4" aria-hidden />
          <AlertTitle>Publishing is stopped: Google’s pending changes are unknown</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              Google has pending updates Nabatable can’t list. Request a fresh refresh, then create
              a new preview before publishing.
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-xs">Unknown paths</span>
              {paths(pending.unknownPaths)}
            </span>
            {onRequestRefresh ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-start"
                onClick={onRequestRefresh}
                disabled={refreshPending}
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={refreshPending ? 'animate-spin motion-reduce:animate-none' : undefined}
                  aria-hidden
                />
                {refreshPending ? 'Refreshing…' : 'Request a fresh refresh'}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <GbpDetailList
        items={[
          { label: 'Connection status', value: state.connectionStatus, mono: true },
          { label: 'Write state', value: state.writeState, mono: true },
          {
            label: 'Connection generation',
            value: String(state.connectionGeneration),
            mono: true,
          },
          { label: 'Consent epoch', value: String(state.consentEpoch), mono: true },
          { label: 'Safe reason code', value: state.reasonCode ?? 'none', mono: true },
          {
            label: 'Rollout',
            value: (
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono text-xs">
                  {state.rollout.eligible ? state.rollout.cohort : state.rollout.reason}
                </span>
                <span>{state.rollout.eligible ? 'Eligible' : 'Not eligible'}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {time(state.rollout.evaluatedAt)}
                </span>
              </span>
            ),
          },
          {
            label: 'Refresh state',
            value: (
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono text-xs">{state.refresh.status}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  Last succeeded {time(state.refresh.lastSucceededAt)}
                </span>
              </span>
            ),
          },
          { label: 'Refresh error', value: state.refresh.safeErrorCode ?? 'none', mono: true },
          {
            label: 'Pending location masks',
            value:
              pending.state === 'known'
                ? paths(pending.locationMasks)
                : pending.state === 'unknown'
                  ? 'Unknown. Publishing is stopped.'
                  : 'Google reports no pending location or attribute updates.',
          },
          ...(pending.state === 'known'
            ? [{ label: 'Pending attribute paths', value: paths(pending.attributePaths) }]
            : []),
        ]}
      />
    </div>
  );
}
