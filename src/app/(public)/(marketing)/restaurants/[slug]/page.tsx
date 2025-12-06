import { MapPin, Clock, Phone, Mail, Calendar } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GuestCard, GuestSection } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';

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

    return (
        <div className="min-h-screen pb-16">
            {/* Hero Image Section */}
            <div className="relative h-[40vh] min-h-[320px] w-full overflow-hidden rounded-b-[var(--guest-radius-2xl)] bg-slate-900">
                {restaurant.logoUrl ? (
                    <Image
                        src={restaurant.logoUrl}
                        alt={restaurant.name}
                        fill
                        className="guest-img-premium object-cover opacity-70"
                        priority
                        unoptimized
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-12">
                    <div className="container-default space-y-3 text-white">
                        <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-500 rounded-full shadow-sm">
                            Open for Reservations
                        </Badge>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">{restaurant.name}</h1>
                        {restaurant.address && (
                            <div className="flex items-center gap-2 text-base text-slate-100 sm:text-lg">
                                <MapPin className="h-5 w-5 text-amber-300 shrink-0" />
                                <span>{restaurant.address}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="container-default px-4 py-10 sm:px-6 lg:px-8 guest-sections">
                <GuestSection title="About" description={`Experience exceptional dining at ${restaurant.name}.`} padding="md">
                    <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                        Experience exceptional dining at {restaurant.name}. Whether you&apos;re planning a romantic dinner, a family gathering, or a business lunch, we provide the perfect atmosphere and cuisine.
                    </p>
                </GuestSection>

                <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
                    <div className="space-y-6">
                        <GuestSection title="Details" padding="md" className="bg-white">
                            <div className="grid gap-4 sm:grid-cols-2">
                                {restaurant.contactPhone && (
                                    <GuestCard className="bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                                                <Phone className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500">Phone</p>
                                                <p className="font-semibold text-slate-900">{restaurant.contactPhone}</p>
                                            </div>
                                        </div>
                                    </GuestCard>
                                )}
                                {restaurant.contactEmail && (
                                    <GuestCard className="bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                                                <Mail className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500">Email</p>
                                                <p className="font-semibold text-slate-900">{restaurant.contactEmail}</p>
                                            </div>
                                        </div>
                                    </GuestCard>
                                )}
                            </div>
                        </GuestSection>
                    </div>

                    <div className="space-y-6">
                        <GuestCard className="bg-white shadow-md">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-slate-900">Make a Reservation</h3>
                                    <p className="text-sm text-slate-600">Secure your table instantly. No booking fees.</p>
                                </div>

                                <Button asChild size="lg" className="w-full text-base font-semibold rounded-full animate-pulse-glow">
                                    <Link href={`/restaurants/${restaurant.slug}/book`}>
                                        <Calendar className="mr-2 h-5 w-5" />
                                        Book a Table
                                    </Link>
                                </Button>

                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-amber-500" />
                                        <span>Instant confirmation</span>
                                    </div>
                                </div>
                            </div>
                        </GuestCard>

                        {restaurant.googleMapUrl && (
                            <GuestCard className="overflow-hidden p-0">
                                <iframe
                                    title="Map"
                                    width="100%"
                                    height="300"
                                    frameBorder="0"
                                    style={{ border: 0 }}
                                    src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(restaurant.address ?? restaurant.name)}`}
                                    allowFullScreen
                                />
                            </GuestCard>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
