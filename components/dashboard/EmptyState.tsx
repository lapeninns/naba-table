'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';

import { emit } from '@/lib/analytics/emit';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center" aria-live="polite">
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <Link href={ctaHref} className={cn(buttonVariants({ variant: 'default' }), 'inline-flex')}>
        {ctaLabel}
      </Link>
    </div>
  );
}
