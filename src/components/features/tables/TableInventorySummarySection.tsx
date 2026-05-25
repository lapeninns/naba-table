import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { SummaryCard } from './TableInventorySummary';

import type { TableInventorySummaryCardDescriptor } from './tableInventoryDisplayDomain';

type TableInventorySummarySectionProps = {
  isActive: boolean;
  summaryCards: TableInventorySummaryCardDescriptor[] | null;
};

export function TableInventorySummarySection({
  isActive,
  summaryCards,
}: TableInventorySummarySectionProps) {
  return (
    <section
      id="table-capacity-summary"
      hidden={!isActive}
      className={cn('scroll-mt-28 grid gap-4 sm:grid-cols-2 xl:grid-cols-4', !isActive && 'hidden')}
    >
      {summaryCards ? (
        summaryCards.map((card) => (
          <SummaryCard
            key={card.key}
            label={card.label}
            value={card.value}
            description={card.description}
          />
        ))
      ) : (
        <>
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </>
      )}
      <div className="rounded-lg border border-border/70 bg-muted/20 p-4 sm:col-span-2 xl:col-span-4">
        <p className="text-sm font-semibold text-foreground">Capacity depends on setup nearby</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Covers per service depend on turn times and booking types. Keep public address details
          aligned when planning the dining room.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={opsHref('/settings/restaurant/availability#booking-occasions')}>
              Open availability
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={opsHref('/settings/restaurant/profile#profile-contact')}>Open profile</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
