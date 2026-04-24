'use client';

import Link from 'next/link';

import { GuestContent, GuestPageFrame, GuestPanel } from '@/components/guest/ui';
import { Button } from '@/components/ui/button';

export default function GuestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[guest] render error', error);

  return (
    <GuestPageFrame>
      <GuestContent className="flex min-h-[70vh] items-center justify-center py-16">
        <GuestPanel className="max-w-xl space-y-5 p-6 text-center sm:p-8">
          <div className="space-y-2">
            <p className="pg-kicker">Guest area</p>
            <h1 className="pg-section-title">Something went wrong</h1>
            <p className="pg-body">
              We couldn’t load this page. Please retry or head back to your bookings.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="guest-primary"
              size="guest-lg"
              className="pg-action pg-focus-ring pg-touch"
              onClick={reset}
            >
              Retry
            </Button>
            <Button
              asChild
              variant="guest-outline"
              size="guest-lg"
              className="pg-action pg-focus-ring pg-touch"
            >
              <Link href="/guest/bookings">My bookings</Link>
            </Button>
          </div>
          {process.env.NODE_ENV !== 'production' && error?.digest ? (
            <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
          ) : null}
        </GuestPanel>
      </GuestContent>
    </GuestPageFrame>
  );
}
