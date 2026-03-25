import { Compass, SearchX } from 'lucide-react';
import Link from 'next/link';

import { GuestPageShell, GuestSurfaceCard } from '@/components/guest/ui/GuestPrimitives';
import { Button } from '@/components/ui/button';

export default function RestaurantNotFound() {
  return (
    <GuestPageShell
      hero={
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-14 text-center sm:px-6 sm:py-18">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Restaurant unavailable</p>
          <h1 className="heading-hero">We couldn’t find that restaurant page.</h1>
          <p className="text-body-warm mx-auto max-w-2xl">
            The link may be outdated or the venue is no longer available for guest booking. You can keep exploring from the main guest discovery routes.
          </p>
        </div>
      }
      contentClassName="mx-auto flex w-full max-w-4xl justify-center px-4 pb-14 sm:px-6"
    >
      <GuestSurfaceCard className="w-full max-w-2xl p-6 text-center sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <SearchX className="h-8 w-8" aria-hidden />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-foreground">Choose another guest-ready destination</h2>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Browse available restaurants or return to the bookings hub to pick up a supported guest flow.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button className="rounded-full px-6" asChild>
            <Link href="/restaurants">
              <Compass className="mr-2 h-4 w-4" aria-hidden />
              Browse restaurants
            </Link>
          </Button>
          <Button variant="outline" className="rounded-full px-6" asChild>
            <Link href="/bookings">Go to bookings</Link>
          </Button>
        </div>
      </GuestSurfaceCard>
    </GuestPageShell>
  );
}
