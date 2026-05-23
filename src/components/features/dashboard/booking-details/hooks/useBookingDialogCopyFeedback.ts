'use client';

import { useCallback, useEffect, useState } from 'react';

import { buildBookingSummaryText } from '../bookingDialogDomain';
import { copyToClipboard, getStatusLabel } from '../utils';

import type { FlattenedTable } from '../utils';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export function useBookingDialogCopyFeedback({
  assignedTableRows,
  booking,
  formattedDate,
  formattedEndTime,
  formattedStartTime,
  summary,
}: {
  assignedTableRows: FlattenedTable[];
  booking: OpsTodayBooking | null;
  formattedDate: string;
  formattedEndTime: string;
  formattedStartTime: string;
  summary: OpsTodayBookingsSummary | null;
}) {
  const [copySummaryStatus, setCopySummaryStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [srStatusMessage, setSrStatusMessage] = useState<string>('');

  useEffect(() => {
    if (copySummaryStatus === 'idle') return;
    const timer = window.setTimeout(() => setCopySummaryStatus('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [copySummaryStatus]);

  useEffect(() => {
    if (!srStatusMessage) return;
    const timer = window.setTimeout(() => setSrStatusMessage(''), 2000);
    return () => window.clearTimeout(timer);
  }, [srStatusMessage]);

  const handleCopySummary = useCallback(async () => {
    if (!booking || !summary) return;
    const statusLabel = getStatusLabel(booking.status);
    const summaryText = buildBookingSummaryText({
      assignedTableRows,
      booking,
      formattedDate,
      formattedEndTime,
      formattedStartTime,
      statusLabel,
    });

    const ok = await copyToClipboard(summaryText);
    setCopySummaryStatus(ok ? 'copied' : 'failed');
    setSrStatusMessage(ok ? 'Summary copied to clipboard.' : 'Unable to copy summary.');
  }, [assignedTableRows, booking, formattedDate, formattedEndTime, formattedStartTime, summary]);

  const handleCopyReference = useCallback(() => {
    if (!booking) return;
    const text = booking.reference ?? booking.id;
    void (async () => {
      const ok = await copyToClipboard(text);
      setSrStatusMessage(ok ? 'Reference copied to clipboard.' : 'Unable to copy reference.');
    })();
  }, [booking]);

  return {
    copySummaryStatus,
    handleCopyReference,
    handleCopySummary,
    srStatusMessage,
  };
}

export type BookingDialogCopyFeedback = ReturnType<typeof useBookingDialogCopyFeedback>;
