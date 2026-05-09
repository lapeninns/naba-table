'use client';

import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';

import { SUMMARY_STALE_AFTER_MS } from '@/lib/ops/realtime';
import { formatRelativeTime } from '@/lib/utils/relative-time';

import { OpsStatusBadge } from '../ops-shell/patterns/OpsStatusBadge';

import type { OpsStatusBadgeProps } from '../ops-shell/patterns/OpsStatusBadge';

export type ConnectionStatusBeaconProps = {
  initialNowIso: string;
  dataUpdatedAt?: number | null;
  dataStaleAfterMs?: number;
  realtimeEnabled?: boolean;
  realtimeHealthy?: boolean;
  isPolling?: boolean;
  isSummaryLoading?: boolean;
  hasSummaryError?: boolean;
};

type BeaconStatus = 'initializing' | 'connected' | 'stale' | 'error';

type BeaconConfig = {
  label: string;
  tone: NonNullable<OpsStatusBadgeProps['tone']>;
  dotClass: string;
  ringClass: string;
  pulseClass: string;
};

const STATUS_CONFIG: Record<BeaconStatus, BeaconConfig> = {
  initializing: {
    label: 'Initializing',
    tone: 'muted',
    dotClass: 'bg-muted-foreground/70',
    ringClass: 'ring-muted-foreground/20',
    pulseClass: 'hidden',
  },
  connected: {
    label: 'Live',
    tone: 'success',
    dotClass: 'bg-primary/10',
    ringClass: 'ring-primary/30',
    pulseClass: 'bg-primary/10 animate-ping',
  },
  stale: {
    label: 'Stale',
    tone: 'warning',
    dotClass: 'bg-primary/10',
    ringClass: 'ring-primary/30',
    pulseClass: 'bg-primary/10 animate-pulse',
  },
  error: {
    label: 'Error',
    tone: 'danger',
    dotClass: 'bg-destructive/10',
    ringClass: 'ring-destructive/25',
    pulseClass: 'hidden',
  },
};

function resolveInitialNowMs(initialNowIso: string): number {
  const parsed = Date.parse(initialNowIso);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function ConnectionStatusBeacon({
  initialNowIso,
  dataUpdatedAt,
  dataStaleAfterMs = SUMMARY_STALE_AFTER_MS,
  realtimeEnabled,
  realtimeHealthy,
  isPolling,
  isSummaryLoading = false,
  hasSummaryError = false,
}: ConnectionStatusBeaconProps) {
  const [nowMs, setNowMs] = useState(() => resolveInitialNowMs(initialNowIso));

  useEffect(() => {
    setNowMs(Date.now());
    const interval = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);

  const hasData = typeof dataUpdatedAt === 'number';
  const isLoading = isSummaryLoading && !hasData;
  const isDataStale = hasData && nowMs - dataUpdatedAt > dataStaleAfterMs;
  const effectiveStatus: BeaconStatus =
    hasSummaryError && !hasData
      ? 'error'
      : isLoading || !hasData
        ? 'initializing'
        : isDataStale
          ? 'stale'
          : 'connected';
  const beacon = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.initializing;
  const label = beacon.label;
  const resolvedIsPolling =
    typeof isPolling === 'boolean'
      ? isPolling
      : realtimeEnabled === false || realtimeHealthy === false;
  const syncLabel = resolvedIsPolling ? 'Polling' : 'Realtime';

  const reference = useMemo(() => DateTime.fromMillis(nowMs), [nowMs]);

  const formatRelative = (value: number | Date | null | undefined) => {
    if (!value) return null;
    const dateTime =
      typeof value === 'number' ? DateTime.fromMillis(value) : DateTime.fromJSDate(value);
    return formatRelativeTime(dateTime, reference, { style: 'short', includeSeconds: true });
  };

  const updatedRelative = hasData ? formatRelative(dataUpdatedAt) : null;
  const syncClassName = resolvedIsPolling ? 'text-primary' : 'text-muted-foreground';

  return (
    <div
      className="inline-flex flex-col gap-1 rounded-xl border border-border/70 bg-card/70 px-2.5 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur-xl sm:gap-1.5 sm:rounded-2xl sm:px-3 sm:py-2 sm:text-xs"
      title={`Connection status: ${label}`}
      aria-label={`Connection status: ${label}. Sync: ${syncLabel}.`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="sr-only">
        Connection status: {label}. Sync: {syncLabel}.
      </span>
      <div className="flex items-center gap-2">
        <span className="relative flex size-3 items-center justify-center">
          <span
            className={`absolute inline-flex h-4 w-4 rounded-full ${beacon.pulseClass} motion-reduce:animate-none`}
            aria-hidden="true"
          />
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ${beacon.dotClass} ${beacon.ringClass}`}
            aria-hidden="true"
          />
        </span>
        <OpsStatusBadge
          label={label}
          tone={beacon.tone}
          className="px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px]"
        />
      </div>

      <div
        className="flex items-center gap-1 text-[10px] text-muted-foreground sm:hidden"
        aria-hidden="true"
      >
        {updatedRelative ? (
          <span className={isDataStale ? 'text-primary' : 'text-muted-foreground'}>
            Updated {updatedRelative}
          </span>
        ) : (
          <span>Updating…</span>
        )}
        <span aria-hidden="true">·</span>
        <span className={syncClassName}>{syncLabel}</span>
      </div>

      <div
        className="hidden flex-wrap items-center gap-1 text-[10px] text-muted-foreground sm:flex"
        aria-hidden="true"
      >
        {updatedRelative ? (
          <>
            <span className={isDataStale ? 'text-primary' : 'text-muted-foreground'}>
              Bookings updated {updatedRelative}
            </span>
            <span aria-hidden="true">·</span>
            <span>Summary updated {updatedRelative}</span>
            <span aria-hidden="true">·</span>
          </>
        ) : null}
        <span className={syncClassName}>Sync: {syncLabel}</span>
      </div>
    </div>
  );
}
