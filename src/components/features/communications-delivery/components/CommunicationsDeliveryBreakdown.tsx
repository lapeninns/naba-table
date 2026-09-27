import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type DeliveryBreakdownSegment = {
  label: string;
  count: number;
  tone: 'success' | 'info' | 'warning' | 'danger';
};

const toneClasses = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-destructive',
} satisfies Record<DeliveryBreakdownSegment['tone'], string>;

export function CommunicationsDeliveryBreakdown({
  segments,
  isLoading,
}: {
  segments: DeliveryBreakdownSegment[] | null;
  isLoading: boolean;
}) {
  if (isLoading)
    return <Skeleton className="h-24 w-full" aria-label="Loading delivery breakdown" />;
  if (!segments) return <p className="text-sm text-muted-foreground">Summary unavailable.</p>;
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  return (
    <div className="space-y-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={toneClasses[segment.tone]}
            style={{ width: `${total ? (segment.count / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex min-w-0 items-start gap-2">
            <span
              className={cn('mt-1.5 size-2 shrink-0 rounded-full', toneClasses[segment.tone])}
              aria-hidden
            />
            <dt className="min-w-0 flex-1 text-muted-foreground">{segment.label}</dt>
            <dd className="font-medium tabular-nums">{segment.count.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No attempts in this range.</p>
      ) : null}
    </div>
  );
}
