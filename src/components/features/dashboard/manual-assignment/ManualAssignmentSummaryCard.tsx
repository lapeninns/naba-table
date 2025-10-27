'use client';

import { useMemo, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

import type { ManualAssignmentContextHold, ManualValidationResult } from '@/services/ops/bookings';

const SECTION_LABEL = 'Selection summary';

function formatZoneLabel(summary: ManualValidationResult['summary'] | null): string {
  if (!summary) {
    return '—';
  }
  if (!summary.zoneId) {
    return 'Mixed zones';
  }
  return 'Single zone';
}

function formatSlackLabel(slackLabel: string | null, summary: ManualValidationResult['summary'] | null): string {
  if (slackLabel) {
    return slackLabel;
  }
  if (!summary) {
    return 'Awaiting selection';
  }
  return 'Calculated automatically';
}

function formatPartySize(partySize: number | null | undefined): string {
  if (typeof partySize === 'number' && !Number.isNaN(partySize)) {
    return `${partySize}`;
  }
  return '—';
}

function renderTableNumbers(tableNumbers: string[]): ReactNode {
  if (tableNumbers.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {tableNumbers.map((tableNumber) => (
        <Badge key={tableNumber} variant="secondary" className="text-[11px]">
          #{tableNumber}
        </Badge>
      ))}
    </div>
  );
}

function HoldList({ holds, heading }: { holds: ManualAssignmentContextHold[]; heading: string }): ReactNode {
  if (holds.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{heading}</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {holds.map((hold) => {
          const createdBy = hold.createdByName ?? hold.createdByEmail ?? 'Unknown staff';
          return (
            <li key={hold.id} className="flex flex-wrap gap-1">
              <span className="font-medium">{hold.tableIds.length} table{hold.tableIds.length === 1 ? '' : 's'}</span>
              <span aria-hidden>•</span>
              <span>{createdBy}</span>
              <span aria-hidden>•</span>
              <span>Expires {new Date(hold.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type ManualAssignmentSummaryCardProps = {
  summary: ManualValidationResult['summary'] | null;
  slackLabel: string | null;
  partySize: number | null;
  tableNumbers: string[];
  requireAdjacency: boolean;
  onAdjacencyChange: (next: boolean) => void;
  isLoading?: boolean;
  activeHold: ManualAssignmentContextHold | null;
  holdCountdownLabel: string | null;
  otherHolds: ManualAssignmentContextHold[];
};

export function ManualAssignmentSummaryCard({
  summary,
  slackLabel,
  partySize,
  tableNumbers,
  requireAdjacency,
  onAdjacencyChange,
  isLoading = false,
  activeHold,
  holdCountdownLabel,
  otherHolds,
}: ManualAssignmentSummaryCardProps) {
  const derivedTableNumbers = summary?.tableNumbers ?? tableNumbers;
  const partySizeLabel = formatPartySize(summary?.partySize ?? partySize);
  const zoneLabel = useMemo(() => formatZoneLabel(summary), [summary]);
  const slackSummary = useMemo(() => formatSlackLabel(slackLabel, summary), [slackLabel, summary]);
  const activeHoldList = activeHold ? [activeHold] : [];

  return (
    <Card className="border-border/60 bg-white">
      <CardHeader className="space-y-3 pb-0">
        <div className="flex flex-col gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">{SECTION_LABEL}</CardTitle>
            <CardDescription>Review capacity, adjacency, and holds before confirming.</CardDescription>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Adjacency</p>
              <p className="text-sm text-foreground">
                {requireAdjacency ? 'Contiguous tables required' : 'Mixed tables allowed'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="manual-assignment-adjacency" className="text-xs text-muted-foreground">
                Require adjacency
              </Label>
              <Switch
                id="manual-assignment-adjacency"
                checked={requireAdjacency}
                onCheckedChange={onAdjacencyChange}
                aria-label="Toggle adjacency requirement"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div className="space-y-0.5">
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Party size</dt>
                <dd className="text-sm font-medium text-foreground">{partySizeLabel}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Selected tables</dt>
                <dd className="text-sm font-medium text-foreground">{summary?.tableCount ?? 0}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Total capacity</dt>
                <dd className="text-sm font-medium text-foreground">
                  {summary ? summary.totalCapacity : '—'}
                  {summary ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{slackSummary}</span>
                  ) : null}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Zone</dt>
                <dd className="text-sm font-medium text-foreground">
                  {zoneLabel}
                  {summary?.zoneId ? (
                    <span className="ml-1 text-xs text-muted-foreground">({summary.zoneId.slice(0, 8)})</span>
                  ) : null}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Table numbers</dt>
                <dd>{renderTableNumbers(derivedTableNumbers)}</dd>
              </div>
            </dl>

            {activeHold ? (
              <HoldList holds={activeHoldList} heading={`Active hold ${holdCountdownLabel ? `(${holdCountdownLabel} left)` : ''}`} />
            ) : (
              <p className="text-xs text-muted-foreground">
                No hold yet. Validating a selection will create one automatically for three minutes.
              </p>
            )}

            {otherHolds.length > 0 ? (
              <HoldList holds={otherHolds} heading="Other holds in this window" />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
