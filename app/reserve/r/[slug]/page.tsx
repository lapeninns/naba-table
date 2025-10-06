import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import BookingFlowPage from '@/components/reserve/booking-flow';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getRestaurantBySlug } from '@/server/restaurants';
import { DEFAULT_VENUE } from '@shared/config/venue';

import type { Metadata } from 'next';

type RouteParams = Promise<{ slug: string }>;

const resolveRestaurant = cache(async (slug: string) => getRestaurantBySlug(slug));

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await resolveRestaurant(slug);

  if (!restaurant) {
    return {
      title: 'Restaurant not found · SajiloReserveX',
      description: 'The requested restaurant does not exist.',
    };
  }

  return {
    title: `Book ${restaurant.name} · SajiloReserveX`,
    description: `Reserve your table at ${restaurant.name} with SajiloReserveX.`,
  };
}

export default async function RestaurantBookingPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const restaurant = await resolveRestaurant(slug);

  if (!restaurant) {
    notFound();
  }

  const initialDetails = {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantTimezone: restaurant.timezone ?? DEFAULT_VENUE.timezone,
    restaurantAddress: DEFAULT_VENUE.address,
  } as const;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            ← All restaurants
          </Link>
          <span className="text-sm text-muted-foreground">Currently booking: {restaurant.name}</span>
        </div>
      </nav>
      <BookingFlowPage initialDetails={initialDetails} />
    </div>
  );
}
