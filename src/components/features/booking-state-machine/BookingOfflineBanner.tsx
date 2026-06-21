'use client';

import { WifiOff, RefreshCcw } from 'lucide-react';

import { Alert, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useBookingOfflineQueue } from '@/contexts/booking-offline-queue';

export function BookingOfflineBanner() {
  const queue = useBookingOfflineQueue();

  if (!queue) {
    return null;
  }

  const { isOffline, pending } = queue;
  const hasPending = pending.length > 0;

  if (!isOffline && !hasPending) {
    return null;
  }

  const title = isOffline ? 'You are offline' : 'Syncing queued actions';
  const description = isOffline
    ? hasPending
      ? `${pending.length} action${pending.length === 1 ? '' : 's'} will run automatically once you reconnect.`
      : 'We will queue any changes you make while offline.'
    : hasPending
      ? `${pending.length} queued action${pending.length === 1 ? '' : 's'} processing…`
      : 'Resuming online operations.';

  return (
    <Alert
      variant="warning"
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertIcon>
          <WifiOff className="size-4" aria-hidden />
        </AlertIcon>
        <div className="space-y-1">
          <AlertTitle className="text-sm font-semibold text-primary">{title}</AlertTitle>
          <AlertDescription className="text-sm text-primary">
            {description}
            {hasPending ? (
              <span className="mt-1 block text-xs text-primary">
                Latest queued: {pending[0]?.label ?? 'Action'}
              </span>
            ) : null}
          </AlertDescription>
        </div>
      </div>
      {hasPending && !isOffline ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void queue.flush();
          }}
          className="mt-2 w-full sm:mt-0 sm:w-auto"
        >
          <RefreshCcw className="mr-1.5 size-4" aria-hidden />
          Sync now
        </Button>
      ) : null}
    </Alert>
  );
}

export default BookingOfflineBanner;
