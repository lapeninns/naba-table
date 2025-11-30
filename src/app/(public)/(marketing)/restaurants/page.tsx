import { MapPin, Users } from 'lucide-react';
import Link from 'next/link';

import { PageHero } from '@/components/shared/PageHero';
import { listRestaurants } from '@/server/restaurants/listRestaurants';

export const dynamic = 'force-dynamic';

export default async function RestaurantsPage() {
    const restaurants = await listRestaurants();

    return (
        <main className="min-h-screen bg-background">
            <PageHero
                title="Our Restaurants"
                description="Explore our curated selection of fine dining experiences."
            />

            <div className="mx-auto max-w-[80vw] px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {restaurants.map((restaurant) => (
                        <Link
                            key={restaurant.id}
                            href={`/restaurants/${restaurant.slug}`}
                            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:border-primary/30"
                        >
                            <div className="aspect-video w-full bg-muted overflow-hidden">
                                {restaurant.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={restaurant.logoUrl} alt={restaurant.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-primary/5 text-muted-foreground">
                                        <span className="text-4xl font-bold opacity-20">{restaurant.name.charAt(0)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-1 flex-col p-6">
                                <h3 className="mb-2 text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                    {restaurant.name}
                                </h3>

                                <div className="mt-auto space-y-3 text-sm text-muted-foreground">
                                    {restaurant.address && (
                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                                            <span className="line-clamp-2">{restaurant.address}</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4">
                                        {restaurant.capacity && (
                                            <div className="flex items-center gap-1.5">
                                                <Users className="h-4 w-4" />
                                                <span>Up to {restaurant.capacity} guests</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <span className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 w-full">
                                        Book a Table
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}

                    {restaurants.length === 0 && (
                        <div className="col-span-full text-center py-12">
                            <p className="text-lg text-muted-foreground">No restaurants found at the moment.</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
