import { CalendarPlus, Download, Share2 } from 'lucide-react';

import { GuestError } from '@/components/guest/ui';
import { Skeleton } from '@/components/ui/skeleton';

import { ActionButtonRow, SecondaryButton, SummaryActions } from '../ui/BookingComponents';

export function ReservationDetailLoadingState() {
  return (
    <section className="pg-surface min-h-[100dvh] py-8 pb-20 sm:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8 px-4 sm:px-6">
        <div className="pg-card pg-appear space-y-6 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </section>
  );
}

export function ReservationDetailErrorState({
  description,
  onRetry,
}: {
  description: string;
  onRetry: () => void;
}) {
  return (
    <div className="pg-surface flex min-h-[60vh] items-center justify-center">
      <GuestError
        description={description}
        onRetry={onRetry}
        redirectHref="/guest/dashboard"
        redirectLabel="Return to dashboard"
      />
    </div>
  );
}

export function ReservationDetailActionControls({
  onDownload,
  onShare,
  onAddToCalendar,
  layout,
}: {
  onDownload: () => void;
  onShare: () => void;
  onAddToCalendar: () => void;
  layout: 'summary' | 'mobile';
}) {
  const actions = (
    <>
      <SecondaryButton onClick={onDownload}>
        <Download className="mr-2 size-4" /> PDF
      </SecondaryButton>
      <SecondaryButton onClick={onShare}>
        <Share2 className="mr-2 size-4" /> Share
      </SecondaryButton>
      <SecondaryButton onClick={onAddToCalendar}>
        <CalendarPlus className="mr-2 size-4" /> Add to calendar
      </SecondaryButton>
    </>
  );

  if (layout === 'summary') {
    return <SummaryActions>{actions}</SummaryActions>;
  }

  return <ActionButtonRow>{actions}</ActionButtonRow>;
}
