import { notFound } from 'next/navigation';

import {
    RestaurantDetailHero,
    RestaurantDetailsSection,
} from '@/components/restaurants/PublicSections';
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

    const mapEmbedUrl = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
        ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(restaurant.address ?? restaurant.name)}`
        : null;

    return (
        <div className="guest-theme bg-muted pb-16">
            <RestaurantDetailHero restaurant={{
                id: restaurant.id,
                slug: restaurant.slug ?? slug,
                name: restaurant.name,
                address: restaurant.address,
                logoUrl: restaurant.logoUrl,
            }} />
            <RestaurantDetailsSection
                restaurant={{
                    id: restaurant.id,
                    slug: restaurant.slug ?? slug,
                    name: restaurant.name,
                    address: restaurant.address,
                    contactEmail: restaurant.contactEmail,
                    contactPhone: restaurant.contactPhone,
                    logoUrl: restaurant.logoUrl,
                }}
                mapEmbedUrl={mapEmbedUrl}
            />
        </div>
    );
}
