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
import {
  GuestHero,
  GuestMetricCard,
  GuestPrimaryButton,
  GuestSectionHeader,
  GuestSecondaryButton,
} from '@/components/guest/ui';
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
    <GuestHero
      eyebrow="Curated guest picks"
      title="Find the right table fast."
      description="Live-ready venues with the same flow guests see at checkout, so browsing and booking feel like one journey."
      compact
      meta={
        <>
          {TAGS.map((tag) => (
            <span key={tag} className="pg-chip">
              {tag}
            </span>
          ))}
        </>
      }
      aside={
        <Card className="pg-card w-full max-w-md space-y-4 p-5">
          <GuestMetricCard
            icon={Compass}
            label="Live venues"
            value={totalRestaurants}
            detail="Ready to book right now."
          />
          <div className="rounded-[var(--pg-radius-md)] bg-muted p-4">
            <p className="text-sm font-semibold text-foreground">Built for clarity</p>
            <p className="pg-caption">Same cards and spacing guests see in the booking flow.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="pg-chip">
              <Compass className="h-4 w-4" aria-hidden />
              Guided discovery
            </span>
            <span className="pg-chip">
              <Sparkles className="h-4 w-4" aria-hidden />
              Instant confirm
            </span>
          </div>
        </Card>
      }
    />
  );
}

function RestaurantSearchPanel() {
  return (
    <div className="pg-container -mt-6">
      <div className="pg-panel relative z-10 flex flex-col gap-3 p-3 md:flex-row md:items-center">
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
            className="h-12 rounded-full border-border bg-background pl-11"
          />
        </div>
        <Button size="lg" className="h-12 rounded-full text-base" asChild>
          <Link href="/auth/signin">
            <ShieldCheck className="mr-2 h-5 w-5" aria-hidden />
            Save favorites
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function RestaurantsGridSection({ restaurants }: { restaurants: RestaurantListItem[] }) {
  return (
    <>
      <RestaurantSearchPanel />
      <section className="pg-section-tight" aria-labelledby="restaurants-grid-heading">
        <div className="pg-container space-y-6">
          <GuestSectionHeader
            eyebrow="Carefully selected venues"
            title={<span id="restaurants-grid-heading">Pick a spot</span>}
            description="Tap a card for details, arrival notes, and the live booking flow."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((restaurant) => (
              <article
                key={restaurant.id}
                className="pg-card pg-card-interactive group flex h-full flex-col gap-4 p-4"
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
                Check back soon, we publish new venues as they pass our onboarding review.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

export function RestaurantDetailHero({ restaurant }: { restaurant: RestaurantDetail }) {
  return (
    <GuestHero
      eyebrow="Featured partner"
      title={restaurant.name}
      description={
        restaurant.address ? (
          <span className="inline-flex items-start gap-2">
            <MapPin className="mt-1 h-5 w-5 text-primary" aria-hidden />
            {restaurant.address}
          </span>
        ) : (
          'Book a table with live confirmation and clear arrival details.'
        )
      }
      actions={
        <>
          <GuestPrimaryButton href={`/restaurants/${restaurant.slug}/book`}>
            Book a table
          </GuestPrimaryButton>
          <GuestSecondaryButton href="/restaurants">Browse venues</GuestSecondaryButton>
        </>
      }
      aside={
        <div className="pg-card relative aspect-[4/3] w-full max-w-lg overflow-hidden">
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
            <div className="flex h-full items-center justify-center bg-muted text-primary">
              <span className="font-[var(--pg-font-display)] text-7xl font-bold opacity-60">
                {restaurant.name.charAt(0)}
              </span>
            </div>
          )}
        </div>
      }
      compact
    />
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
          <GuestSectionHeader
            eyebrow="Before you book"
            title={<span id="restaurant-details-heading">Experience snapshot</span>}
            description="Contact details, arrival expectations, and booking confidence in one scan."
          />
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
