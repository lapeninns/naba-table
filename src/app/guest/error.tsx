'use client';

import Link from 'next/link';

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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-background px-4 py-16 text-center">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Guest area</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          We couldn’t load this page. Please retry or head back to your bookings.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Retry</Button>
        <Button asChild variant="outline">
          <Link href="/guest/bookings">My bookings</Link>
        </Button>
      </div>
      {process.env.NODE_ENV !== 'production' && error?.digest ? (
        <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
      ) : null}
    </div>
  );
}
