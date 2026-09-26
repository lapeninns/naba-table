'use client';

import { ExternalLink, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { GbpStatusPill } from './GbpStatusPill';
import { describeGbpConnection, describeGbpWrites, formatGbpTime } from '../gbpPageModel';

import type { GoogleBusinessProfileLinkedLocationDetails } from '../googleBusinessProfileSectionStateDomain';
import type { GbpConnectionStateResponseV1 } from '@/services/ops/dual-sync';
import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';
import type { ReactNode } from 'react';

export type GbpOverviewCardProps = {
  readonly data: GoogleBusinessProfileConnection;
  readonly location: GoogleBusinessProfileLinkedLocationDetails;
  readonly accountLabel: string;
  /** Admin-only write state; null when it is not loaded or not visible to this user. */
  readonly operator: GbpConnectionStateResponseV1 | null;
  readonly operatorUnavailable: boolean;
  /** When Nabatable last compared with Google. */
  readonly checkedAt: string | null;
  readonly manageHref: string | null;
  readonly refresh: {
    readonly label: string;
    readonly onClick: () => void;
    readonly pending: boolean;
    readonly disabled: boolean;
  };
};

function Evidence({ items }: { items: ReadonlyArray<{ label: string; value: ReactNode }> }) {
  return (
    <dl
      aria-label="Evidence"
      className="mt-3.5 flex flex-wrap items-baseline gap-x-5 gap-y-1.5 rounded-lg bg-muted px-3.5 py-2.5 text-xs"
    >
      <span className="font-semibold">Evidence</span>
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="font-mono font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <span className="font-sans font-normal text-muted-foreground">{children}</span>;
}

/**
 * The linked listing at a glance: who it is, whether Google is connected and writable, and the
 * raw values that gate a publish, in one evidence line.
 */
export function GbpOverviewCard({
  data,
  location,
  accountLabel,
  operator,
  operatorUnavailable,
  checkedAt,
  manageHref,
  refresh,
}: GbpOverviewCardProps) {
  const connection = describeGbpConnection(data.status);
  const writes = describeGbpWrites({ operator, unavailable: operatorUnavailable });
  const pending = operator?.pendingUpdates;

  return (
    <section
      id="gbp-connection"
      aria-labelledby="gbp-overview-title"
      data-testid="gbp-overview-card"
      className="min-w-0 scroll-mt-24 rounded-xl border bg-background px-4 py-4 sm:px-5"
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div id="gbp-location" className="grid min-w-0 flex-[1_1_380px] gap-0.5">
          <span className="text-xs text-muted-foreground">Linked Google listing</span>
          <h2 id="gbp-overview-title" className="text-xl font-semibold tracking-tight">
            {location.business}
          </h2>
          <span className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {location.address}
            {data.externalLocationName ? (
              <>
                {' · '}
                <span className="font-mono text-xs">{data.externalLocationName}</span>
              </>
            ) : null}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={refresh.onClick}
            disabled={refresh.disabled || refresh.pending}
          >
            <RefreshCw
              data-icon="inline-start"
              className={cn(refresh.pending && 'animate-spin motion-reduce:animate-none')}
              aria-hidden
            />
            {refresh.label}
          </Button>
          {manageHref ? (
            <Button type="button" variant="ghost" asChild>
              <a href={manageHref} target="_blank" rel="noreferrer">
                <ExternalLink data-icon="inline-start" aria-hidden />
                Open on Google
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2" aria-label="Status">
        <GbpStatusPill label="Connection" value={connection.label} tone={connection.tone} />
        {writes ? (
          <GbpStatusPill label="Google writes" value={writes.label} tone={writes.tone} />
        ) : null}
        <GbpStatusPill label="Checked" value={formatGbpTime(checkedAt, 'Not yet')} tone="off" />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {writes ? `${writes.sentence}. ` : null}Signed in as {accountLabel}.
        {data.status === 'sync_error' && data.lastError ? (
          <span className="block break-words">Last error: {data.lastError}</span>
        ) : null}
      </p>

      {operatorUnavailable ? (
        <Evidence
          items={[
            {
              label: 'Write state',
              value: (
                <>
                  unavailable <Quiet>treated as off</Quiet>
                </>
              ),
            },
          ]}
        />
      ) : operator ? (
        <Evidence
          items={[
            { label: 'Connection', value: operator.connectionStatus },
            { label: 'Write state', value: operator.writeState },
            { label: 'Generation', value: operator.connectionGeneration },
            { label: 'Consent epoch', value: operator.consentEpoch },
            { label: 'Reason code', value: operator.reasonCode ?? 'none' },
            {
              label: 'Rollout',
              value: operator.rollout.eligible ? (
                <>
                  {operator.rollout.cohort} <Quiet>eligible</Quiet>
                </>
              ) : (
                <>
                  {operator.rollout.reason} <Quiet>not eligible</Quiet>
                </>
              ),
            },
            {
              label: 'Refresh',
              value: (
                <>
                  {operator.refresh.status}{' '}
                  <Quiet>
                    {formatGbpTime(operator.refresh.lastSucceededAt)}
                    {operator.refresh.safeErrorCode ? ` · ${operator.refresh.safeErrorCode}` : ''}
                  </Quiet>
                </>
              ),
            },
            {
              label: 'Pending updates',
              value:
                pending?.state === 'unknown' ? (
                  <>
                    unknown <Quiet>{pending.unknownPaths.length} paths</Quiet>
                  </>
                ) : pending?.state === 'known' ? (
                  <>
                    known{' '}
                    <Quiet>
                      {pending.locationMasks.length + pending.attributePaths.length} paths
                    </Quiet>
                  </>
                ) : (
                  'none'
                ),
            },
          ]}
        />
      ) : null}
    </section>
  );
}
