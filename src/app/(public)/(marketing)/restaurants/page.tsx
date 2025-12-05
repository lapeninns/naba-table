import { MapPin, Users } from 'lucide-react';
import Link from 'next/link';

import { GuestCard, GuestHero, GuestSection } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listRestaurants } from '@/server/restaurants/listRestaurants';

export const dynamic = 'force-dynamic';

export default async function RestaurantsPage() {
    const restaurants = await listRestaurants();

    return (
        <div className="guest-page guest-sections">
            <GuestHero
                badge="Curated list"
                title="Browse restaurants curated for memorable nights"
                description="Filters-free browsing with fast visual scanning—pick a place, see the essentials, and book instantly."
                ctas={
                    <Link href="/restaurants">
                        <Button size="lg" className="rounded-full shadow-sm">
                            Explore restaurants
                        </Button>
                    </Link>
                }
            />

            <GuestSection
                title="Pick a spot"
                description="See the essentials at a glance and book without friction."
                padding="md"
            >
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 guest-stagger">
                    {restaurants.map((restaurant) => (
                        <GuestCard
                            key={restaurant.id}
                            className="h-full guest-hover-card"
                            footer={
                                <Button asChild variant="outline" className="w-full rounded-lg">
                                    <Link href={`/restaurants/${restaurant.slug}`}>Book a table</Link>
                                </Button>
                            }
                        >
                            <Link href={`/restaurants/${restaurant.slug}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
                                <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-100">
                                    {restaurant.logoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={restaurant.logoUrl}
                                            alt={restaurant.name}
                                            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600">
                                            <span className="text-4xl font-bold opacity-60">{restaurant.name.charAt(0)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold text-slate-900">{restaurant.name}</h3>
                                        <Badge variant="secondary" className="guest-badge">
                                            Instant confirm
                                        </Badge>
                                    </div>
                                    {restaurant.address && (
                                        <p className="flex items-start gap-2 text-sm text-slate-600">
                                            <MapPin className="mt-0.5 h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="line-clamp-2">{restaurant.address}</span>
                                        </p>
                                    )}
                                    {restaurant.capacity ? (
                                        <p className="flex items-center gap-2 text-sm text-slate-600">
                                            <Users className="h-4 w-4 text-slate-400" />
                                            Up to {restaurant.capacity} guests
                                        </p>
                                    ) : null}
                                </div>
                            </Link>
                        </GuestCard>
                    ))}

                    {restaurants.length === 0 && (
                        <div className="col-span-full py-16 text-center text-slate-500">
                            <p className="text-lg">No restaurants found at the moment.</p>
                            <p className="mt-2 text-sm">Check back soon for new additions.</p>
                        </div>
                    )}
                </div>
            </GuestSection>
        </div>
    );
}
