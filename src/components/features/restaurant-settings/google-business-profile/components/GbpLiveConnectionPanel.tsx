'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  gbpLiveConnectionSchema,
  gbpRetentionStatusSchema,
  type GbpLiveConnection,
  type GbpRetentionStatus,
} from '@/lib/google-business-profile/liveConnection';
import { fetchJson } from '@/lib/http/fetchJson';

import { SettingsCard } from '../../shared/SettingsCard';
import { formatGbpTime } from '../gbpPageModel';

type Props = {
  readonly restaurantId: string;
  readonly connectionKey: string;
  readonly connectionLoading?: boolean;
  readonly savedStatus: string;
  readonly onCheckFailed: () => void;
  readonly operations: ReactNode;
  readonly children: ReactNode;
};

export function GbpLiveConnectionPanel(props: Props) {
  return <LiveConnectionPanel key={props.restaurantId} {...props} />;
}

function LiveConnectionPanel({
  restaurantId,
  connectionKey,
  connectionLoading = false,
  savedStatus,
  onCheckFailed,
  operations,
  children,
}: Props) {
  const [retention, setRetention] = useState<GbpRetentionStatus | null>(null);
  const readinessRef = useRef<AbortController | null>(null);
  const endpoint = `/api/ops/restaurants/${encodeURIComponent(restaurantId)}/google-business-profile/live`;

  useEffect(() => {
    const controller = new AbortController();
    readinessRef.current = controller;
    void fetchJson<unknown>(`${endpoint}/readiness`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setRetention(gbpRetentionStatusSchema.parse(value));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setRetention({ status: 'blocked', reason: 'readiness_unavailable' });
      });
    return () => {
      controller.abort();
    };
  }, [endpoint]);

  const onRetention = useCallback((next: GbpRetentionStatus) => {
    readinessRef.current?.abort();
    setRetention(next);
  }, []);

  const liveCard = (
    <LiveConnectionCard
      key={connectionKey}
      endpoint={endpoint}
      connectionLoading={connectionLoading}
      savedStatus={savedStatus}
      onCheckFailed={onCheckFailed}
      onRetention={onRetention}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {retention?.status === 'ready' ? (
        <>
          {children}
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-medium">Connection diagnostics</summary>
            <div className="mt-4">{liveCard}</div>
          </details>
        </>
      ) : (
        <>
          {liveCard}
          <SettingsCard
            title={
              retention ? 'Saved comparison unavailable' : 'Checking saved comparison readiness'
            }
            contentClassName="flex flex-col gap-2"
          >
            <p className="text-sm text-muted-foreground">
              {!retention
                ? 'Checking whether Google content can be saved for comparison.'
                : retention.reason === 'retention_not_ready'
                  ? 'Nabatable’s checks for safely storing Google details are incomplete. You can check the live listing above; saving and refreshing comparisons are unavailable.'
                  : 'Nabatable could not verify that Google details can be safely stored. Saved comparison remains unavailable. A live check will also retry this check.'}
            </p>
          </SettingsCard>
          {operations}
        </>
      )}
    </div>
  );
}

function LiveConnectionCard({
  endpoint,
  connectionLoading,
  savedStatus,
  onCheckFailed,
  onRetention,
}: {
  readonly endpoint: string;
  readonly connectionLoading: boolean;
  readonly savedStatus: string;
  readonly onCheckFailed: () => void;
  readonly onRetention: (retention: GbpRetentionStatus) => void;
}) {
  const [live, setLive] = useState<GbpLiveConnection | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function checkLiveConnection() {
    if (requestRef.current || connectionLoading) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLive(null);
    setFailed(false);
    setPending(true);
    try {
      const response = await fetchJson<unknown>(endpoint, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const result = gbpLiveConnectionSchema.parse(response);
      if (!controller.signal.aborted) {
        setLive(result);
        onRetention(result.retention);
      }
    } catch {
      if (!controller.signal.aborted) {
        setFailed(true);
        onCheckFailed();
      }
    } finally {
      if (!controller.signal.aborted) {
        setPending(false);
        requestRef.current = null;
      }
    }
  }

  return (
    <SettingsCard
      title="Live Google connection"
      description="Check the linked listing directly with Google. Details are shown only on this page and are not saved."
      contentClassName="flex flex-col gap-3"
      headerAction={
        <Button
          type="button"
          variant="outline"
          onClick={() => void checkLiveConnection()}
          disabled={pending || connectionLoading}
        >
          {connectionLoading
            ? 'Loading connection…'
            : pending
              ? 'Checking live connection…'
              : 'Check live connection'}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        {savedStatus === 'sync_error'
          ? 'Saved sync failed; any prior comparison may be out of date.'
          : 'Saved comparison is separate from this live check.'}{' '}
        A live check does not enable imports or publishing.
      </p>
      {pending ? (
        <p role="status" className="text-sm">
          Checking access to the linked Google listing…
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Could not verify the live Google connection. Check again, or reconnect Google if access
          has expired.
        </p>
      ) : null}
      {live ? (
        <div className="flex min-w-0 flex-col gap-2" role="status">
          <p className="text-sm font-semibold">Live connection verified</p>
          <p className="text-xs text-muted-foreground">
            Verified at {formatGbpTime(live.verifiedAt)}. This confirms access at that time.
          </p>
          <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
            {(
              [
                ['Business', live.location.title],
                ['Address', live.location.address],
                ['Phone', live.location.phone],
                ['Website', live.location.website],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="[overflow-wrap:anywhere]">{value || 'Not supplied by Google'}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </SettingsCard>
  );
}
