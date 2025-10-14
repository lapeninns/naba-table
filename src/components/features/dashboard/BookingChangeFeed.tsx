'use client';

import { ChevronDown, ChevronRight, History } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type BookingChange = {
  versionId: string;
  bookingId: string;
  bookingReference: string | null;
  customerName: string | null;
  changeType: 'created' | 'updated' | 'cancelled' | 'status_changed';
  changedAt: string;
  changedBy: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
};

type BookingChangeFeedProps = {
  changes: BookingChange[];
  loading?: boolean;
  totalChanges?: number;
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  cancelled: 'Cancelled',
  status_changed: 'Status Changed',
};

const CHANGE_TYPE_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  created: 'default',
  updated: 'secondary',
  cancelled: 'destructive',
  status_changed: 'outline',
};

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

export function BookingChangeFeed({ changes, loading, totalChanges }: BookingChangeFeedProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (loading) {
    return <BookingChangeFeedSkeleton />;
  }

  if (changes.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/60 bg-muted/10">
      <CardHeader>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between text-left hover:opacity-80 transition-opacity"
          aria-expanded={isExpanded}
        >
          <CardTitle className="flex items-center gap-2 text-base md:text-lg font-semibold text-foreground">
            <History className="h-5 w-5" aria-hidden />
            Recent Changes
            {totalChanges !== undefined && totalChanges > 0 ? (
              <span className="text-sm font-normal text-muted-foreground">({totalChanges})</span>
            ) : null}
          </CardTitle>
          {isExpanded ? <ChevronDown className="h-5 w-5" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
        </button>
      </CardHeader>
      {isExpanded ? (
        <CardContent>
          <div className="space-y-3">
            {changes.map((change) => (
              <ChangeItem key={change.versionId} change={change} />
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

function ChangeItem({ change }: { change: BookingChange }) {
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const label = CHANGE_TYPE_LABELS[change.changeType] ?? change.changeType;
  const variant = CHANGE_TYPE_COLORS[change.changeType] ?? 'secondary';

  return (
    <Card className="border-border/60 bg-background">
      <CardContent className="py-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {change.customerName ?? change.bookingReference ?? change.bookingId.slice(0, 8)}
              </span>
              <Badge variant={variant} className="text-xs">
                {label}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatTimestamp(change.changedAt)}</span>
            </div>
            {(change.oldData || change.newData) ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDetailExpanded(!isDetailExpanded)}
                className="h-9 md:h-7 text-xs"
              >
                {isDetailExpanded ? 'Hide' : 'Details'}
              </Button>
            ) : null}
          </div>

          {isDetailExpanded ? (
            <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
              {change.changeType === 'created' && change.newData ? (
                <div>
                  <p className="mb-2 font-semibold text-foreground">Created with:</p>
                  <DiffDisplay data={change.newData} />
                </div>
              ) : change.changeType === 'cancelled' && change.oldData ? (
                <div>
                  <p className="mb-2 font-semibold text-foreground">Previous state:</p>
                  <DiffDisplay data={change.oldData} />
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-2 font-semibold text-muted-foreground">Before</p>
                    {change.oldData ? <DiffDisplay data={change.oldData} /> : <p className="italic text-muted-foreground">No data</p>}
                  </div>
                  <div>
                    <p className="mb-2 font-semibold text-foreground">After</p>
                    {change.newData ? <DiffDisplay data={change.newData} /> : <p className="italic text-muted-foreground">No data</p>}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DiffDisplay({ data }: { data: Record<string, unknown> }) {
  const filteredEntries = Object.entries(data).filter(
    ([key]) => !key.includes('_at') && !key.includes('_id') && key !== 'id'
  );

  if (filteredEntries.length === 0) {
    return <p className="italic text-muted-foreground">No changes</p>;
  }

  return (
    <dl className="space-y-1">
      {filteredEntries.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <dt className="font-medium text-muted-foreground">{key}:</dt>
          <dd className="text-foreground">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '--';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function BookingChangeFeedSkeleton() {
  return (
    <Card className="border-border/60 bg-muted/10">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
    </Card>
  );
}
