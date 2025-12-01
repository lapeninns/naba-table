'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowRight, Loader2 } from 'lucide-react';

import { BookingStatusBadge } from '@/components/features/booking-state-machine';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { BookingHistoryDialogProps } from '../types';

/**
 * Dialog for displaying booking lifecycle history
 * Single Responsibility: Display booking history entries
 */
export function BookingHistoryDialog({
  open,
  onOpenChange,
  bookingId,
  timezone: _timezone,
}: BookingHistoryDialogProps) {
  const bookingService = useBookingService();

  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyError,
    error: historyErrorObject,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: queryKeys.bookings.history(bookingId),
    queryFn: async () => bookingService.getBookingHistory(bookingId),
    enabled: open,
    staleTime: 60_000,
  });

  const historyEntries = historyData?.entries ?? [];
  const historyErrorMessage =
    historyErrorObject instanceof Error ? historyErrorObject.message : 'Unable to load history';

  const formatHistoryDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;
    return format(parsed, 'dd MMM yyyy, HH:mm');
  };

  const getMetadataString = (
    metadata: Record<string, unknown>,
    key: string
  ): string | null => {
    const value = metadata?.[key as keyof typeof metadata];
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (isOpen) {
          void refetchHistory();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Booking history</DialogTitle>
          <DialogDescription>
            Lifecycle changes recorded for this reservation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {historyLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading history…
            </div>
          ) : historyError ? (
            <p className="text-sm text-destructive">{historyErrorMessage}</p>
          ) : historyEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No lifecycle changes have been recorded yet.
            </p>
          ) : (
            historyEntries.map((entry) => {
              const actorLabel = entry.actor?.name ?? entry.actor?.email ?? 'System';
              const actionValue = getMetadataString(entry.metadata, 'action');
              const actionLabel = actionValue ? actionValue.replace(/[-_]/g, ' ') : null;
              const performedAtLabel = formatHistoryDate(
                getMetadataString(entry.metadata, 'performedAt')
              );
              const changedAtLabel = formatHistoryDate(entry.changedAt) ?? entry.changedAt;

              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-border/60 bg-muted/10 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {entry.fromStatus ? (
                        <BookingStatusBadge status={entry.fromStatus} size="sm" showTooltip />
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold uppercase tracking-wide"
                        >
                          New
                        </Badge>
                      )}
                      <ArrowRight
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden
                      />
                      <BookingStatusBadge status={entry.toStatus} size="sm" showTooltip />
                    </div>
                    <span className="text-xs text-muted-foreground">{changedAtLabel}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">{actorLabel}</p>
                  {actionLabel ? (
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Action: {actionLabel}
                    </p>
                  ) : null}
                  {entry.reason ? (
                    <p className="mt-1 text-sm text-muted-foreground">Reason: {entry.reason}</p>
                  ) : null}
                  {performedAtLabel ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Performed at: {performedAtLabel}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
