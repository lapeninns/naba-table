import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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

export function GbpOperatorStateDetails({ state }: { state: GbpConnectionStateResponseV1 }) {
  const rolloutLabel = state.rollout.eligible ? state.rollout.cohort : state.rollout.reason;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{state.connectionStatus}</Badge>
        <Badge variant={state.writeState === 'eligible' ? 'status-confirmed' : 'status-pending'}>
          {state.writeState}
        </Badge>
        <Badge variant="outline">Generation {state.connectionGeneration}</Badge>
        <Badge variant="outline">Consent epoch {state.consentEpoch}</Badge>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Reason</dt>
          <dd className="font-mono">{state.reasonCode ?? 'none'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rollout</dt>
          <dd className="flex items-center gap-2">
            <span className="font-mono">{rolloutLabel}</span>
            <span className="text-xs text-muted-foreground">{time(state.rollout.evaluatedAt)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Refresh</dt>
          <dd className="flex items-center gap-2">
            <Badge variant="outline">{state.refresh.status}</Badge>
            <span>{time(state.refresh.lastSucceededAt)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Refresh error</dt>
          <dd className="font-mono">{state.refresh.safeErrorCode ?? 'none'}</dd>
        </div>
      </dl>

      {state.pendingUpdates.state === 'unknown' ? (
        <Alert variant="destructive">
          <AlertTitle>Pending Google paths are unknown — publishing is stopped</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>Refresh Google and review a new exact preview before publishing.</span>
            {paths(state.pendingUpdates.unknownPaths)}
          </AlertDescription>
        </Alert>
      ) : state.pendingUpdates.state === 'known' ? (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 font-medium">Pending location masks</p>
            {paths(state.pendingUpdates.locationMasks)}
          </div>
          <div>
            <p className="mb-1 font-medium">Pending attribute paths</p>
            {paths(state.pendingUpdates.attributePaths)}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Google reports no pending location or attribute updates.
        </p>
      )}
    </div>
  );
}
