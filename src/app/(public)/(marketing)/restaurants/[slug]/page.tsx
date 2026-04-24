import { notFound } from 'next/navigation';

import { RestaurantDetailPage } from '@/components/restaurants/PublicSections';
import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';

import type { Metadata } from 'next';

type RouteParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return {
      title: 'Restaurant Not Found · Nab a Table',
    };
  }

  return {
    title: `${restaurant.name} · Nab a Table`,
    description: `Book a table at ${restaurant.name}. ${restaurant.address ?? 'Fine dining and great atmosphere.'}`,
  };
}

export default async function RestaurantPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    notFound();
  }

  return <RestaurantDetailPage restaurant={restaurant} />;
}
