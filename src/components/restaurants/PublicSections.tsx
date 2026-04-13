 

import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  Compass,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { BookingMessageShell } from '@/components/features/booking/ui/BookingComponents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type RestaurantListItem = {
  id: string | number;
  slug: string;
  name: string;
  address?: string | null;
  logoUrl?: string | null;
  capacity?: number | null;
};

type RestaurantDetail = RestaurantListItem & {
  contactPhone?: string | null;
  contactEmail?: string | null;
};

const TAGS = ['Chef-led', 'Terrace', 'Live fire'];

export function RestaurantsHeroSection({ totalRestaurants }: { totalRestaurants: number }) {
  return (
    <section className="px-4 py-12 sm:px-6 lg:py-16" aria-labelledby="restaurants-hero-heading">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 rounded-[var(--guest-radius-2xl)] border border-slate-100 bg-white/90 p-6 shadow-[var(--guest-shadow-xl)] md:flex-row md:items-center md:justify-between">
        <div className="flex-1 space-y-4">
          <Badge variant="secondary" className="rounded-full px-4 py-1 text-blue-900">
            Curated guest picks
          </Badge>
          <div className="space-y-3">
            <h1
              id="restaurants-hero-heading"
              className="guest-heading-hero text-[clamp(2rem,4vw,3rem)] font-bold text-slate-900"
            >
              Find the right table fast.
            </h1>
            <p className="text-base text-slate-600 sm:text-lg">
              Live-ready venues with the same flow guests see at checkout—no surprises between
              browsing and booking.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <label className="sr-only" htmlFor="restaurant-discovery">
                Search restaurants
              </label>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <Input
                id="restaurant-discovery"
                name="restaurant-discovery"
                type="search"
                placeholder="Search by neighborhood, cuisine, or vibe"
                className="h-12 rounded-[var(--guest-radius-lg)] border-slate-200 bg-slate-50 pl-11"
              />
            </div>
            <Button size="lg" className="h-12 rounded-[var(--guest-radius-lg)] text-base" asChild>
              <Link href="/auth/signin">
                <ShieldCheck className="mr-2 h-5 w-5" aria-hidden />
                Save favorites
              </Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-3 text-sm text-slate-600" aria-label="Popular filters">
            {TAGS.map((tag) => (
              <li key={tag} className="rounded-full border border-slate-200 px-3 py-1">
                {tag}
              </li>
            ))}
          </ul>
        </div>
        <Card className="flex flex-1 flex-col gap-4 rounded-[var(--guest-radius-xl)] border-blue-100 bg-gradient-to-br from-blue-600/90 via-blue-500/90 to-blue-700/90 p-6 text-white shadow-[var(--guest-shadow-lg)]">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.28em] text-blue-100">Live venues</p>
            <p className="text-4xl font-semibold">{totalRestaurants}</p>
            <p className="text-sm text-blue-100">Ready to book right now.</p>
          </div>
          <div className="rounded-[var(--guest-radius-lg)] bg-white/10 p-4">
            <p className="text-sm font-medium">Built for clarity</p>
            <p className="text-sm text-blue-100">
              Same cards and spacing you’ll see in the booking flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-blue-100">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
              <Compass className="h-4 w-4" aria-hidden />
              Guided discovery
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
              <Sparkles className="h-4 w-4" aria-hidden />
              Instant confirm
            </span>
            <ListingIllustration />
          </div>
        </Card>
      </div>
    </section>
  );
}

export function RestaurantsGridSection({ restaurants }: { restaurants: RestaurantListItem[] }) {
  return (
    <section className="px-4 pb-14 pt-4 sm:px-6" aria-labelledby="restaurants-grid-heading">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-blue-700">Carefully selected venues</p>
            <h2
              id="restaurants-grid-heading"
              className="guest-heading-page text-[length:var(--guest-text-page)] font-semibold text-slate-900"
            >
              Pick a spot
            </h2>
          </div>
          <p className="text-sm text-slate-500">Tap a card for details and booking.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <article
              key={restaurant.id}
              className="group flex h-full flex-col gap-4 rounded-[var(--guest-radius-xl)] border border-slate-100 bg-white p-4 shadow-[var(--guest-shadow-md)]"
            >
              <Link
                href={`/restaurants/${restaurant.slug}`}
                className="relative block h-48 w-full overflow-hidden rounded-[var(--guest-radius-lg)]"
              >
                {restaurant.logoUrl ? (
                  <Image
                    src={restaurant.logoUrl}
                    alt={restaurant.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600">
                    <span className="text-4xl font-bold opacity-60">
                      {restaurant.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-1 text-xs font-semibold text-blue-800 shadow">
                  Instant confirm
                </div>
              </Link>
              <div className="flex flex-1 flex-col gap-3">
                <div>
                  <Link
                    href={`/restaurants/${restaurant.slug}`}
                    className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900 hover:text-blue-700"
                  >
                    {restaurant.name}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  {restaurant.address ? (
                    <p className="mt-1 flex items-start gap-2 text-sm text-slate-600">
                      <MapPin className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden />
                      <span className="line-clamp-2">{restaurant.address}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" aria-hidden />
                    {restaurant.capacity
                      ? `Up to ${restaurant.capacity} guests`
                      : 'Flexible seating'}
                  </span>
                  <Button variant="secondary" size="sm" className="rounded-full px-4" asChild>
                    <Link href={`/restaurants/${restaurant.slug}`}>View</Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {restaurants.length === 0 ? (
          <div className="rounded-[var(--guest-radius-xl)] border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
            <p className="text-lg font-semibold">No restaurants found</p>
            <p className="text-sm">
              Check back soon—we publish new venues as they pass our onboarding review.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function RestaurantDetailHero({ restaurant }: { restaurant: RestaurantDetail }) {
  return (
    <section className="relative h-[45vh] min-h-[320px] w-full overflow-hidden rounded-b-[var(--guest-radius-2xl)]">
      {restaurant.logoUrl ? (
        <Image
          src={restaurant.logoUrl}
          alt={restaurant.name}
          fill
          className="object-cover"
          priority
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 text-white">
          <Badge className="w-fit rounded-full bg-amber-400 text-amber-950">Featured partner</Badge>
          <h1 className="guest-heading-hero text-[clamp(2.5rem,4vw,3.5rem)] font-semibold">
            {restaurant.name}
          </h1>
          {restaurant.address ? (
            <p className="flex items-center gap-2 text-base text-slate-100">
              <MapPin className="h-5 w-5 text-amber-300" aria-hidden />
              {restaurant.address}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function RestaurantDetailsSection({
  restaurant,
  mapEmbedUrl,
}: {
  restaurant: RestaurantDetail;
  mapEmbedUrl?: string | null;
}) {
  const insights = [
    {
      title: 'Contact',
      icon: Phone,
      value: restaurant.contactPhone ?? 'Call concierge',
      sub: 'Direct line for host desk',
    },
    {
      title: 'Email',
      icon: BookOpenCheck,
      value: restaurant.contactEmail ?? 'team@nabatable.com',
      sub: 'Replies within 15 minutes',
    },
    {
      title: 'Arrivals',
      icon: CalendarCheck2,
      value: 'Instant confirmation',
      sub: 'Status synced everywhere',
    },
  ];

  return (
    <section className="px-4 py-10 sm:px-6" aria-labelledby="restaurant-details-heading">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2
              id="restaurant-details-heading"
              className="guest-heading-page text-[length:var(--guest-text-page)] font-semibold text-slate-900"
            >
              Experience snapshot
            </h2>
            <p className="text-sm text-slate-600">Same layout and cues you’ll see when you book.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {insights.map((insight) => (
              <Card
                key={insight.title}
                className="space-y-2 rounded-[var(--guest-radius-lg)] border-slate-100 bg-white p-4 shadow-[var(--guest-shadow-sm)]"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <insight.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-sm text-slate-500">{insight.title}</p>
                </div>
                <p className="text-base font-semibold text-slate-900">{insight.value}</p>
                <p className="text-sm text-slate-500">{insight.sub}</p>
              </Card>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Card className="space-y-4 rounded-[var(--guest-radius-xl)] border-slate-100 bg-white p-6 shadow-[var(--guest-shadow-md)]">
            <div className="space-y-1">
              <p className="text-sm text-blue-700">Powered by Nab a Table</p>
              <p className="text-2xl font-semibold text-slate-900">Make a reservation</p>
              <p className="text-sm text-slate-600">
                Secure a table with the same wizard guests use after sign-in.
              </p>
            </div>
            <Button size="lg" className="w-full rounded-full text-base" asChild>
              <Link href={`/restaurants/${restaurant.slug}/book`}>Book a table</Link>
            </Button>
            <div className="rounded-[var(--guest-radius-lg)] border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
                Instant confirmation, synced everywhere.
              </p>
            </div>
          </Card>
          {mapEmbedUrl ? (
            <iframe
              title={`${restaurant.name} map`}
              width="100%"
              height="260"
              className="rounded-[var(--guest-radius-xl)] border border-slate-100"
              src={mapEmbedUrl}
              allowFullScreen
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ReservationThankYouCard({
  headline = 'Reservation confirmed!',
  body = 'Confirmation email sent with your details and link.',
}: {
  headline?: string;
  body?: string;
}) {
  return (
    <BookingMessageShell
      icon={Sparkles}
      title={headline}
      description={body}
      tone="success"
      actions={
        <>
          <Button size="lg" className="w-full rounded-full sm:w-auto" asChild>
            <Link href="/guest/bookings">View my bookings</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full rounded-full border-white/30 text-white hover:bg-white/10 sm:w-auto"
            asChild
          >
            <Link href="/restaurants">Explore restaurants</Link>
          </Button>
        </>
      }
    />
  );
}

export type { RestaurantDetail, RestaurantListItem };

function ListingIllustration() {
  return (
    <svg
      role="img"
      aria-label="Restaurants illustration"
      className="h-14 w-20 text-blue-50"
      width="80"
      height="56"
      viewBox="0 0 200 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="14"
        y="22"
        width="172"
        height="76"
        rx="14"
        fill="rgba(255,255,255,0.15)"
        stroke="rgba(255,255,255,0.35)"
      />
      <rect x="30" y="36" width="70" height="14" rx="6" fill="white" opacity="0.65" />
      <rect x="30" y="58" width="52" height="10" rx="5" fill="white" opacity="0.4" />
      <rect x="30" y="76" width="86" height="10" rx="5" fill="white" opacity="0.25" />
      <rect x="114" y="36" width="42" height="10" rx="5" fill="var(--primary)" opacity="0.25" />
      <rect x="114" y="52" width="54" height="32" rx="8" fill="var(--primary)" opacity="0.18" />
      <rect x="124" y="60" width="32" height="10" rx="5" fill="var(--primary)" opacity="0.65" />
      <rect x="124" y="76" width="40" height="8" rx="4" fill="var(--primary)" opacity="0.35" />
      <circle cx="168" cy="68" r="8" fill="white" opacity="0.9" />
      <path
        d="M164 68l2.8 3 5.2-6.5"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
