import { Compass, LoaderCircle } from 'lucide-react';
import Link from 'next/link';

import { GuestPageShell, GuestSurfaceCard, GuestStatus } from '@/components/guest/ui/GuestPrimitives';
import { Button } from '@/components/ui/button';

export default function RestaurantBookingLoadingPage() {
  return (
    <GuestPageShell
      hero={
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Restaurant booking</p>
          <h1 className="heading-hero max-w-3xl">Preparing your booking experience…</h1>
          <p className="text-body-warm max-w-2xl">
            We’re confirming the restaurant details and the next available booking steps.
          </p>
        </div>
      }
      contentClassName="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14"
    >
      <GuestSurfaceCard className="p-6 sm:p-8">
        <GuestStatus
          title="Loading live availability"
          description="You’ll stay in the guest booking flow while we ready the reservation form."
          icon={LoaderCircle}
          className="border-border/70 bg-primary/5 text-foreground [&_svg]:animate-spin"
          aria-live="polite"
        />
        <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="space-y-3 rounded-[var(--guest-radius-xl)] border border-border/70 bg-surface-warm p-5">
              <div className="h-4 w-28 rounded-full bg-muted" />
              <div className="h-8 w-3/4 rounded-full bg-muted/80" />
              <div className="h-4 w-full rounded-full bg-muted/70" />
              <div className="h-4 w-5/6 rounded-full bg-muted/60" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 rounded-[var(--guest-radius-lg)] border border-dashed border-border/70 bg-background/70"
                />
              ))}
            </div>
          </div>
          <div className="space-y-4 rounded-[var(--guest-radius-xl)] border border-border/70 bg-background/90 p-5">
            <p className="text-sm font-semibold text-foreground">Need another route while this loads?</p>
            <p className="text-sm text-muted-foreground">
              You can keep browsing restaurants and come back to book whenever you’re ready.
            </p>
            <Button variant="outline" className="w-full rounded-full" asChild>
              <Link href="/restaurants">
                <Compass className="mr-2 h-4 w-4" aria-hidden />
                Browse restaurants
              </Link>
            </Button>
          </div>
        </div>
      </GuestSurfaceCard>
    </GuestPageShell>
  );
}
