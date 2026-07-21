'use client';

import Link from 'next/link';
import React, { useEffect, useRef } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { emit } from '@/lib/analytics/emit';

export type EmptyStateProps = {
  title?: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
  analyticsEvent?: string;
};

const DEFAULT_EVENT = 'dashboard_empty_state_viewed';

export function EmptyState({
  title = 'No bookings yet',
  description = 'Once you make a reservation, it will appear here. Ready to secure your next table?',
  ctaHref = '/',
  ctaLabel = 'Start a new booking',
  analyticsEvent = DEFAULT_EVENT,
}: EmptyStateProps) {
  const emittedRef = useRef(false);

  useEffect(() => {
    if (emittedRef.current) return;
    emittedRef.current = true;
    void emit(analyticsEvent, {});
  }, [analyticsEvent]);

  return (
    <Alert
      variant="info"
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center"
    >
      <AlertTitle className="text-base font-semibold text-foreground">{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <span className="max-w-md">{description}</span>
        <Button asChild size="sm">
          <Link href={ctaHref} className="inline-flex">
            {ctaLabel}
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
