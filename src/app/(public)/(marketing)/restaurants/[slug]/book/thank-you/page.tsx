import { notFound } from 'next/navigation';

import { ReservationThankYouCard } from '@/components/restaurants/PublicSections';
import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';

import type { Metadata } from 'next';

type RouteParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  return {
    title: restaurant
      ? `${restaurant.name} Reservation Request · Nab a Table`
      : 'Reservation Request · Nab a Table',
    description: restaurant
      ? `Your table request for ${restaurant.name} has been received.`
      : 'Your table request has been received.',
  };
}

export default async function ReservationThankYouPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    notFound();
  }

  return <ReservationThankYouCard restaurant={restaurant} />;
}
