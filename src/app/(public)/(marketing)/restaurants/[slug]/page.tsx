import { MapPin, Clock, Phone, Mail, Calendar } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Hero Section */}
            <div className="relative h-[40vh] min-h-[400px] w-full overflow-hidden bg-slate-900">
                {restaurant.logoUrl ? (
                    <Image
                        src={restaurant.logoUrl}
                        alt={restaurant.name}
                        fill
                        className="object-cover opacity-60"
                        priority
                        unoptimized
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 lg:p-16">
                    <div className="mx-auto max-w-5xl space-y-4">
                        <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-500">
                            Open for Reservations
                        </Badge>
                        <h1 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
                            {restaurant.name}
                        </h1>
                        {restaurant.address && (
                            <div className="flex items-center gap-2 text-lg text-slate-200">
                                <MapPin className="h-5 w-5 text-amber-400" />
                                <span>{restaurant.address}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
                    <div className="space-y-8">
                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-slate-900">About</h2>
                            <p className="leading-relaxed text-slate-600">
                                Experience exceptional dining at {restaurant.name}. Whether you&apos;re planning a romantic dinner,
                                a family gathering, or a business lunch, we provide the perfect atmosphere and cuisine.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-slate-900">Details</h2>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {restaurant.contactPhone && (
                                    <Card>
                                        <CardContent className="flex items-center gap-3 p-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                                <Phone className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500">Phone</p>
                                                <p className="font-semibold text-slate-900">{restaurant.contactPhone}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                                {restaurant.contactEmail && (
                                    <Card>
                                        <CardContent className="flex items-center gap-3 p-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                                <Mail className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500">Email</p>
                                                <p className="font-semibold text-slate-900">{restaurant.contactEmail}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </section>
                    </div>

                    <div className="space-y-6">
                        <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200">
                            <CardContent className="space-y-6 p-6">
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-slate-900">Make a Reservation</h3>
                                    <p className="text-sm text-slate-500">
                                        Secure your table instantly. No booking fees.
                                    </p>
                                </div>

                                <Button asChild size="lg" className="w-full text-base font-semibold shadow-lg shadow-primary/20">
                                    <Link href={`/restaurants/${restaurant.slug}/book`}>
                                        <Calendar className="mr-2 h-5 w-5" />
                                        Book a Table
                                    </Link>
                                </Button>

                                <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        <span>Instant confirmation</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {restaurant.googleMapUrl && (
                            <Card className="overflow-hidden border-0 shadow-md">
                                <CardContent className="p-0">
                                    <iframe
                                        title="Map"
                                        width="100%"
                                        height="300"
                                        frameBorder="0"
                                        style={{ border: 0 }}
                                        src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(restaurant.address ?? restaurant.name)}`}
                                        allowFullScreen
                                    />
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
