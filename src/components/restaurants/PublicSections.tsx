import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import {
  GuestDetailList,
  GuestInsetCard,
  GuestMetricCard,
  GuestPageFrame,
  GuestPanel,
  GuestPanelHeader,
  GuestPrimaryButton,
  GuestReferenceStrip,
  GuestSecondaryButton,
  GuestSectionHeader,
  GuestSplitPanel,
} from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getReservationThankYouContent } from '@/guest/routes/auth-aware-content';

import type { ReactNode } from 'react';

type RestaurantListItem = {
  id: string | number;
  slug: string;
  name: string;
  timezone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  capacity?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  googleMapUrl?: string | null;
  reservationIntervalMinutes?: number | null;
  reservationDefaultDurationMinutes?: number | null;
};

type RestaurantDetail = RestaurantListItem;

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getMapsHref(restaurant: RestaurantDetail) {
  if (restaurant.googleMapUrl) {
    return restaurant.googleMapUrl;
  }

  const query = restaurant.address ?? restaurant.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function formatCapacity(capacity?: number | null) {
  return capacity ? `Up to ${capacity} guests` : 'Flexible seating';
}

function VenueImage({
  restaurant,
  priority = false,
  className,
}: {
  restaurant: RestaurantListItem;
  priority?: boolean;
  className?: string;
}) {
  if (restaurant.logoUrl) {
    return (
      <Image
        src={restaurant.logoUrl}
        alt=""
        fill
        className={className ?? 'object-cover'}
        sizes="(max-width: 768px) 100vw, 50vw"
        priority={priority}
        unoptimized
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-muted text-primary">
      <span
        aria-hidden="true"
        className="font-[var(--pg-font-display)] text-5xl font-bold tracking-tight opacity-70"
      >
        {getInitials(restaurant.name)}
      </span>
    </div>
  );
}

function RouteCrumbs({ current }: { current: ReactNode }) {
  return (
    <nav aria-label="Restaurant route" className="flex flex-wrap items-center gap-2 text-sm">
      <Link
        href="/restaurants"
        className="inline-flex min-h-11 items-center rounded-full text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Restaurants
      </Link>
      <ArrowRight className="h-4 w-4 text-muted-foreground/60" aria-hidden />
      <span className="min-h-11 rounded-full py-3 font-medium text-foreground">{current}</span>
    </nav>
  );
}

export function RestaurantsHeroSection({
  totalRestaurants,
  searchQuery = '',
}: {
  totalRestaurants: number;
  searchQuery?: string;
}) {
  const venueLabel = totalRestaurants === 1 ? 'venue' : 'venues';

  return (
    <section
      className="pg-section-tight border-b border-border/70 bg-background"
      aria-labelledby="restaurants-heading"
    >
      <div className="pg-container grid gap-6 lg:grid-cols-[7fr_5fr] lg:items-end">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="guest-chip" className="pg-chip">
              Restaurant discovery
            </Badge>
            <span className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {totalRestaurants} {venueLabel}
            </span>
          </div>
          <div className="space-y-3">
            <h1 id="restaurants-heading" className="pg-hero-title max-w-[18ch]">
              Pick the right table, then book without a detour.
            </h1>
            <p className="pg-lead max-w-[65ch]">
              Compare guest-ready venues, scan the essentials, and move straight into live
              availability for the restaurant you choose.
            </p>
          </div>
        </div>

        <GuestPanel className="p-4 sm:p-5">
          <form action="/restaurants" className="space-y-3">
            <label className="pg-kicker" htmlFor="restaurant-search">
              Search restaurants
            </label>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="restaurant-search"
                  name="q"
                  type="search"
                  defaultValue={searchQuery}
                  placeholder="Restaurant name"
                  className="h-11 rounded-full border-border bg-background pl-11 text-base sm:text-sm"
                />
              </div>
              <Button
                type="submit"
                variant="guest-primary"
                size="guest-lg"
                className="pg-action pg-touch"
              >
                Search
              </Button>
            </div>
          </form>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <GuestInsetCard
              icon={ShieldCheck}
              value="Live booking"
              detail="Same flow as checkout."
            />
            <GuestInsetCard icon={Clock3} value="Fast scan" detail="Address, capacity, contact." />
            <GuestInsetCard icon={Sparkles} value="Clear next step" detail="One primary action." />
          </div>
        </GuestPanel>
      </div>
    </section>
  );
}

export function RestaurantsGridSection({
  restaurants,
  searchQuery = '',
}: {
  restaurants: RestaurantListItem[];
  searchQuery?: string;
}) {
  return (
    <section className="pg-section-tight" aria-labelledby="restaurants-grid-heading">
      <div className="pg-container space-y-6">
        <GuestSectionHeader
          eyebrow={searchQuery ? 'Filtered venues' : 'Available venues'}
          title={<span id="restaurants-grid-heading">Choose a restaurant</span>}
          description={
            searchQuery
              ? `Showing matches for "${searchQuery}".`
              : 'Each card leads to restaurant details and a direct booking path.'
          }
          actions={
            searchQuery ? (
              <Button
                variant="guest-outline"
                size="guest-lg"
                className="pg-action pg-touch"
                asChild
              >
                <Link href="/restaurants">Clear search</Link>
              </Button>
            ) : null
          }
        />

        {restaurants.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {restaurants.map((restaurant) => (
              <GuestPanel
                key={restaurant.id}
                interactive
                className="group flex h-full flex-col overflow-hidden"
              >
                <Link
                  href={`/restaurants/${restaurant.slug}`}
                  className="relative block aspect-[16/10] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View details for ${restaurant.name}`}
                >
                  <VenueImage
                    restaurant={restaurant}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent"
                    aria-hidden
                  />
                  <Badge variant="guest-chip" className="absolute left-4 top-4 bg-background/95">
                    View details
                  </Badge>
                </Link>

                <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                  <div className="space-y-2">
                    <Link
                      href={`/restaurants/${restaurant.slug}`}
                      className="group/title flex min-h-11 items-start justify-between gap-3 rounded-[var(--pg-radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="pg-card-title text-xl">{restaurant.name}</span>
                      <ArrowRight
                        className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/title:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                    {restaurant.address ? (
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span className="line-clamp-2">{restaurant.address}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-auto grid gap-3 rounded-[var(--pg-radius-md)] border border-border/70 bg-muted/35 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4" aria-hidden />
                        {formatCapacity(restaurant.capacity)}
                      </span>
                      {restaurant.timezone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-4 w-4" aria-hidden />
                          {restaurant.timezone}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        variant="guest-outline"
                        size="guest-sm"
                        className="pg-action pg-touch"
                        asChild
                      >
                        <Link href={`/restaurants/${restaurant.slug}`}>Details</Link>
                      </Button>
                      <Button
                        variant="guest-primary"
                        size="guest-sm"
                        className="pg-action pg-touch"
                        asChild
                      >
                        <Link href={`/restaurants/${restaurant.slug}/book`}>Book</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </GuestPanel>
            ))}
          </div>
        ) : (
          <GuestPanel className="border-dashed p-8 text-center sm:p-10">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-primary">
                <Search className="h-5 w-5" aria-hidden />
              </span>
              <div className="space-y-2">
                <h2 className="pg-card-title">No restaurants match that search</h2>
                <p className="pg-body">
                  Try the venue name again, or clear the search to see every restaurant that is
                  ready to book.
                </p>
              </div>
              <Button
                variant="guest-primary"
                size="guest-lg"
                className="pg-action pg-touch"
                asChild
              >
                <Link href="/restaurants">Show all restaurants</Link>
              </Button>
            </div>
          </GuestPanel>
        )}
      </div>
    </section>
  );
}

export function RestaurantDetailPage({ restaurant }: { restaurant: RestaurantDetail }) {
  const mapsHref = getMapsHref(restaurant);

  return (
    <GuestPageFrame>
      <section className="pg-section-tight border-b border-border/70 bg-background">
        <div className="pg-container space-y-6">
          <RouteCrumbs current={restaurant.name} />
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
            <div className="min-w-0 space-y-5">
              <Badge variant="guest-chip" className="pg-chip">
                Restaurant detail
              </Badge>
              <div className="space-y-3">
                <h1 className="pg-hero-title max-w-[18ch]">{restaurant.name}</h1>
                <p className="pg-lead max-w-[65ch]">
                  Check the essentials, then reserve through the same live booking flow guests use
                  for confirmation and follow-up.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <GuestPrimaryButton href={`/restaurants/${restaurant.slug}/book`}>
                  Book a table
                </GuestPrimaryButton>
                <GuestSecondaryButton href="/restaurants">Browse restaurants</GuestSecondaryButton>
              </div>
            </div>

            <GuestPanel className="relative aspect-[4/3] min-h-56 w-full min-w-0 max-w-full overflow-hidden p-0 sm:min-h-72">
              <VenueImage restaurant={restaurant} priority />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 text-white">
                <p className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.18em] text-white/75">
                  Ready to book
                </p>
                <p className="mt-1 text-lg font-semibold">{formatCapacity(restaurant.capacity)}</p>
              </div>
            </GuestPanel>
          </div>
        </div>
      </section>

      <section className="pg-section-tight" aria-labelledby="restaurant-snapshot-heading">
        <div className="pg-container">
          <GuestSplitPanel
            primary={
              <div className="space-y-6">
                <GuestSectionHeader
                  eyebrow="Venue snapshot"
                  title={
                    <span id="restaurant-snapshot-heading">Everything needed before booking</span>
                  }
                  description="The page stays practical: location, contact, capacity, and the immediate path into availability."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <GuestMetricCard
                    icon={Users}
                    label="Capacity"
                    value={restaurant.capacity ?? 'Flexible'}
                    detail={formatCapacity(restaurant.capacity)}
                  />
                  <GuestMetricCard
                    icon={Clock3}
                    label="Time zone"
                    value="Local"
                    detail={
                      restaurant.timezone
                        ? `${restaurant.timezone} booking calendar.`
                        : 'Booking times follow the restaurant calendar.'
                    }
                  />
                </div>
                <GuestDetailList
                  title="Contact and arrival"
                  items={[
                    {
                      icon: MapPin,
                      label: 'Address',
                      value: restaurant.address ?? 'Address shared during confirmation',
                      detail: restaurant.address ? 'Use the map link for directions.' : undefined,
                    },
                    {
                      icon: Phone,
                      label: 'Phone',
                      value: restaurant.contactPhone ?? 'Contact through booking updates',
                    },
                    {
                      icon: Mail,
                      label: 'Email',
                      value: restaurant.contactEmail ?? 'Confirmation email after booking',
                    },
                  ]}
                />
              </div>
            }
            secondary={
              <>
                <GuestPanel className="space-y-4 p-5 sm:p-6">
                  <GuestPanelHeader
                    className="-mx-5 -mt-5 sm:-mx-6 sm:-mt-6"
                    eyebrow="Next step"
                    title="Reserve this restaurant"
                    description="Start with party size, date, and time. The wizard checks the restaurant's live schedule."
                  />
                  <div className="space-y-3">
                    <GuestInsetCard
                      icon={CalendarCheck2}
                      value="Instant booking flow"
                      detail={
                        restaurant.reservationIntervalMinutes
                          ? `${restaurant.reservationIntervalMinutes}-minute slot rhythm.`
                          : 'Live slots from the venue schedule.'
                      }
                    />
                    <Button
                      variant="guest-primary"
                      size="guest-lg"
                      className="pg-action pg-touch w-full"
                      asChild
                    >
                      <Link href={`/restaurants/${restaurant.slug}/book`}>Book a table</Link>
                    </Button>
                  </div>
                </GuestPanel>
                <GuestReferenceStrip
                  label="Map"
                  value={restaurant.address ? 'Directions' : 'Search'}
                >
                  <Button
                    variant="guest-outline"
                    size="guest-sm"
                    className="pg-action pg-touch"
                    asChild
                  >
                    <a href={mapsHref} target="_blank" rel="noreferrer">
                      Open map
                    </a>
                  </Button>
                </GuestReferenceStrip>
              </>
            }
          />
        </div>
      </section>
    </GuestPageFrame>
  );
}

export function RestaurantBookingShell({
  children,
}: {
  restaurant: RestaurantDetail;
  children: ReactNode;
}) {
  return <div className="guest-theme min-h-[100dvh] bg-background">{children}</div>;
}

export function ReservationThankYouCard({
  restaurant,
  isAuthenticated,
}: {
  restaurant: RestaurantDetail;
  isAuthenticated: boolean;
}) {
  const content = getReservationThankYouContent(isAuthenticated, restaurant.name);

  return (
    <GuestPageFrame>
      <section className="pg-section-tight">
        <div className="pg-container-sm">
          <GuestPanel className="overflow-hidden">
            <div className="border-b border-border/70 bg-muted/35 px-5 py-4 sm:px-6">
              <Link
                href={`/restaurants/${restaurant.slug}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-medium text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to {restaurant.name}
              </Link>
            </div>
            <div className="px-5 py-8 text-center sm:px-8 sm:py-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/[0.08] text-primary">
                <CheckCircle2 className="h-7 w-7" aria-hidden />
              </div>
              <div className="mx-auto mt-6 max-w-xl space-y-3">
                <p className="pg-kicker">Request received</p>
                <h1 className="pg-hero-title">Your table request is in.</h1>
                <p className="pg-lead text-base">{content.description}</p>
              </div>
              <div className="mx-auto mt-8 grid max-w-lg gap-3 sm:grid-cols-2">
                <Button
                  variant="guest-primary"
                  size="guest-lg"
                  className="pg-action pg-touch"
                  asChild
                >
                  <Link href={content.primaryAction.href}>{content.primaryAction.label}</Link>
                </Button>
                <Button
                  variant="guest-outline"
                  size="guest-lg"
                  className="pg-action pg-touch"
                  asChild
                >
                  <Link href="/restaurants">Explore restaurants</Link>
                </Button>
              </div>
            </div>
          </GuestPanel>
        </div>
      </section>
    </GuestPageFrame>
  );
}

export type { RestaurantDetail, RestaurantListItem };
