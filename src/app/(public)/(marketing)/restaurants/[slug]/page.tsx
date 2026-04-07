import { notFound } from 'next/navigation';

import {
    RestaurantDetailHero,
    RestaurantDetailsSection,
} from '@/components/restaurants/PublicSections';
import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';
import { enrichRestaurantDirectoryEntry } from '@src/data/restaurant-directory';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
    const { slug } = await params;
    const restaurant = await getRestaurantBySlug(slug);

    if (!restaurant) {
        return {
            title: 'Restaurant Not Found · Nab a Table',
        };
    }

    const directoryRestaurant = enrichRestaurantDirectoryEntry(restaurant);

    return {
        title: `${restaurant.name} · Nab a Table`,
        description: `${directoryRestaurant.detailSummary} ${restaurant.address ?? ''}`.trim(),
    };
}

export default async function RestaurantPage({ params }: { params: RouteParams }) {
    const { slug } = await params;
    const restaurant = await getRestaurantBySlug(slug);

    if (!restaurant) {
        notFound();
    }

    const directoryRestaurant = enrichRestaurantDirectoryEntry(restaurant);
    const mapEmbedUrl = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
        ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(restaurant.address ?? restaurant.name)}`
        : null;

    return (
        <div className="guest-theme bg-muted pb-16">
            <RestaurantDetailHero restaurant={directoryRestaurant} />
            <RestaurantDetailsSection
                restaurant={directoryRestaurant}
                mapEmbedUrl={mapEmbedUrl}
            />
        </div>
    );
}
