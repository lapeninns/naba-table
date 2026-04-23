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
    <section className="pg-section-tight" aria-labelledby="restaurants-hero-heading">
      <div className="pg-container pg-panel flex flex-col gap-10 p-6 md:grid md:grid-cols-[7fr_5fr] md:items-center">
        <div className="flex-1 space-y-4">
          <Badge variant="secondary" className="pg-chip">
            Curated guest picks
          </Badge>
          <div className="space-y-3">
            <h1 id="restaurants-hero-heading" className="pg-hero-title">
              Find the right table fast.
            </h1>
            <p className="pg-lead">
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
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="restaurant-discovery"
                name="restaurant-discovery"
                type="search"
                placeholder="Search by neighborhood, cuisine, or vibe"
                className="h-12 rounded-[var(--pg-radius-md)] border-border bg-background pl-11"
              />
            </div>
            <Button size="lg" className="h-12 rounded-full text-base" asChild>
              <Link href="/auth/signin">
                <ShieldCheck className="mr-2 h-5 w-5" aria-hidden />
                Save favorites
              </Link>
            </Button>
          </div>
          <ul
            className="flex flex-wrap gap-3 text-sm text-muted-foreground"
            aria-label="Popular filters"
          >
            {TAGS.map((tag) => (
              <li key={tag} className="pg-chip">
                {tag}
              </li>
            ))}
          </ul>
        </div>
        <Card className="pg-card flex flex-1 flex-col gap-4 p-6">
          <div className="space-y-1">
            <p className="pg-kicker">Live venues</p>
            <p className="font-[var(--pg-font-mono)] text-4xl font-semibold text-foreground">
              {totalRestaurants}
            </p>
            <p className="text-sm text-muted-foreground">Ready to book right now.</p>
          </div>
          <div className="rounded-[var(--pg-radius-md)] bg-muted p-4">
            <p className="text-sm font-medium">Built for clarity</p>
            <p className="pg-on-muted text-sm">
              Same cards and spacing you’ll see in the booking flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="pg-chip">
              <Compass className="h-4 w-4" aria-hidden />
              Guided discovery
            </span>
            <span className="pg-chip">
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
    <section className="pg-section-tight pt-0" aria-labelledby="restaurants-grid-heading">
      <div className="pg-container space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="pg-kicker">Carefully selected venues</p>
            <h2 id="restaurants-grid-heading" className="pg-section-title">
              Pick a spot
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">Tap a card for details and booking.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <article key={restaurant.id} className="pg-card group flex h-full flex-col gap-4 p-4">
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
                  <div className="flex h-48 items-center justify-center bg-muted text-primary">
                    <span className="text-4xl font-bold opacity-60">
                      {restaurant.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="pg-chip absolute left-4 top-4 bg-background/90 text-xs font-semibold">
                  Instant confirm
                </div>
              </Link>
              <div className="flex flex-1 flex-col gap-3">
                <div>
                  <Link
                    href={`/restaurants/${restaurant.slug}`}
                    className="inline-flex items-center gap-2 text-lg font-semibold text-foreground hover:text-primary"
                  >
                    {restaurant.name}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  {restaurant.address ? (
                    <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                      <span className="line-clamp-2">{restaurant.address}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
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
          <div className="pg-card border-dashed p-10 text-center text-muted-foreground">
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
    <section className="relative h-[45vh] min-h-[320px] w-full overflow-hidden border-b border-border bg-muted">
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
        <div className="absolute inset-0 bg-muted" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/35 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 text-background">
          <Badge className="w-fit rounded-full bg-background/90 text-foreground">
            Featured partner
          </Badge>
          <h1 className="pg-hero-title text-[clamp(2.5rem,4vw,3.5rem)] font-semibold">
            {restaurant.name}
          </h1>
          {restaurant.address ? (
            <p className="flex items-center gap-2 text-base text-background/90">
              <MapPin className="h-5 w-5 text-background/80" aria-hidden />
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
    <section className="pg-section-tight" aria-labelledby="restaurant-details-heading">
      <div className="pg-container grid gap-8 lg:grid-cols-[7fr_5fr]">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 id="restaurant-details-heading" className="pg-section-title">
              Experience snapshot
            </h2>
            <p className="text-sm text-muted-foreground">
              Same layout and cues you’ll see when you book.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {insights.map((insight) => (
              <Card key={insight.title} className="pg-card space-y-2 p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <insight.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-sm text-muted-foreground">{insight.title}</p>
                </div>
                <p className="text-base font-semibold text-foreground">{insight.value}</p>
                <p className="text-sm text-muted-foreground">{insight.sub}</p>
              </Card>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Card className="pg-card space-y-4 p-6">
            <div className="space-y-1">
              <p className="pg-kicker">Powered by Nab a Table</p>
              <p className="pg-card-title">Make a reservation</p>
              <p className="text-sm text-muted-foreground">
                Secure a table with the same wizard guests use after sign-in.
              </p>
            </div>
            <Button size="lg" className="w-full rounded-full text-base" asChild>
              <Link href={`/restaurants/${restaurant.slug}/book`}>Book a table</Link>
            </Button>
            <div className="rounded-[var(--pg-radius-md)] border border-border bg-muted p-4 text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Instant confirmation, synced everywhere.
              </p>
            </div>
          </Card>
          {mapEmbedUrl ? (
            <iframe
              title={`${restaurant.name} map`}
              width="100%"
              height="260"
              className="rounded-[var(--pg-radius-lg)] border border-border"
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
          <Button variant="outline" size="lg" className="w-full rounded-full sm:w-auto" asChild>
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
      className="h-14 w-20 text-primary"
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
