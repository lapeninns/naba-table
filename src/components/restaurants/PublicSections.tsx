import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  CarFront,
  ExternalLink,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import type { RestaurantDirectoryEntry } from '@src/data/restaurant-directory';

export function RestaurantsHeroSection({ restaurants }: { restaurants: RestaurantDirectoryEntry[] }) {
  const topCategories = [...new Set(restaurants.flatMap((restaurant) => restaurant.categories))].slice(0, 5);
  const localities = new Set(restaurants.map((restaurant) => restaurant.locality).filter(Boolean));

  return (
    <section className="px-4 py-12 sm:px-6 lg:py-16" aria-labelledby="restaurants-hero-heading">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 rounded-[var(--guest-radius-2xl)] border border-slate-100 bg-white/90 p-6 shadow-[var(--guest-shadow-xl)] md:flex-row md:items-center md:justify-between">
        <div className="flex-1 space-y-5">
          <Badge variant="secondary" className="rounded-full px-4 py-1 text-blue-900">
            Restaurant directory
          </Badge>
          <div className="space-y-3">
            <h1
              id="restaurants-hero-heading"
              className="guest-heading-hero text-[clamp(2rem,4vw,3.2rem)] font-bold text-slate-900"
            >
              Find the right restaurant, not just the next available slot.
            </h1>
            <p className="max-w-3xl text-base text-slate-600 sm:text-lg">
              Browse venues by atmosphere, group fit, food style, and booking context. This is the
              detail most pub directories skip: why a place works for the meal you are planning.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-600" aria-label="Popular filters">
            {topCategories.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-200 px-3 py-1">
                {tag}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <Button
              size="lg"
              className="h-12 rounded-[var(--guest-radius-lg)] bg-slate-950 text-base text-white hover:bg-slate-800"
              asChild
            >
              <Link href="/auth/signin">
                <ShieldCheck className="mr-2 h-5 w-5" aria-hidden />
                Save favourite venues
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-[var(--guest-radius-lg)] border-slate-200 text-base"
              asChild
            >
              <Link href="/restaurants/the-old-crown-girton">See an example guide</Link>
            </Button>
          </div>
        </div>
        <Card className="flex flex-1 flex-col gap-4 rounded-[var(--guest-radius-xl)] border-blue-100 bg-gradient-to-br from-blue-600/90 via-blue-500/90 to-blue-700/90 p-6 text-white shadow-[var(--guest-shadow-lg)]">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatPill label="Live venues" value={String(restaurants.length)} icon={Sparkles} />
            <StatPill label="Places covered" value={String(localities.size)} icon={MapPin} />
            <StatPill label="Guide cues" value={String(topCategories.length)} icon={BookOpenCheck} />
          </div>
          <div className="rounded-[var(--guest-radius-lg)] bg-white/10 p-4">
            <p className="text-sm font-medium">Built for decision-making</p>
            <p className="text-sm text-blue-100">
              Venue categories, practical visit notes, and a direct booking path stay together on
              the same page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-blue-100">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
              <UtensilsCrossed className="h-4 w-4" aria-hidden />
              Descriptions that help
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
              <Users className="h-4 w-4" aria-hidden />
              Group-fit guidance
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
              <CalendarCheck2 className="h-4 w-4" aria-hidden />
              Booking-ready details
            </span>
          </div>
        </Card>
      </div>
    </section>
  );
}

export function RestaurantsGridSection({ restaurants }: { restaurants: RestaurantDirectoryEntry[] }) {
  return (
    <section className="pb-14 pt-2" aria-labelledby="restaurants-grid-heading">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-blue-700">Directory results</p>
            <h2
              id="restaurants-grid-heading"
              className="guest-heading-page text-[length:var(--guest-text-page)] font-semibold text-slate-900"
            >
              Compare venues with more context
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            {restaurants.length} venue{restaurants.length === 1 ? '' : 's'} match your current
            view.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <article
              key={restaurant.id}
              className="group flex h-full flex-col overflow-hidden rounded-[var(--guest-radius-xl)] border border-slate-100 bg-white shadow-[var(--guest-shadow-md)]"
            >
              <Link
                href={`/restaurants/${restaurant.slug}`}
                className="relative block h-52 w-full overflow-hidden"
              >
                {restaurant.logoUrl ? (
                  <Image
                    src={restaurant.logoUrl}
                    alt={restaurant.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700">
                    <span className="text-4xl font-bold opacity-60">{restaurant.name.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />
                <div className="absolute left-4 top-4">
                  <span className="rounded-full bg-white/90 px-4 py-1 text-xs font-semibold text-blue-800 shadow">
                    {restaurant.badge}
                  </span>
                </div>
              </Link>
              <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {restaurant.categories.slice(0, 3).map((category) => (
                      <Badge key={category} variant="secondary" className="rounded-full">
                        {category}
                      </Badge>
                    ))}
                  </div>
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
                  <p className="text-sm leading-6 text-slate-600">{restaurant.listingSummary}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {restaurant.highlights.slice(0, 2).map((highlight) => (
                    <div
                      key={highlight.label}
                      className="rounded-[var(--guest-radius-lg)] border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                        {highlight.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{highlight.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                  {restaurant.bestFor.slice(0, 3).map((item) => (
                    <span key={item} className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                    <Users className="h-4 w-4" aria-hidden />
                    {restaurant.capacity
                      ? `Up to ${restaurant.capacity} guests`
                      : 'Flexible party sizes'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" className="rounded-full px-4" asChild>
                      <Link href={`/restaurants/${restaurant.slug}`}>View guide</Link>
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full bg-slate-950 px-4 text-white hover:bg-slate-800"
                      asChild
                    >
                      <Link href={`/restaurants/${restaurant.slug}/book`}>Book</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
        {restaurants.length === 0 ? (
          <div className="rounded-[var(--guest-radius-xl)] border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
            <p className="text-lg font-semibold">No restaurants match those filters yet</p>
            <p className="text-sm">
              Try a broader search term or clear the category filter to see more venues.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function RestaurantDetailHero({ restaurant }: { restaurant: RestaurantDirectoryEntry }) {
  return (
    <section className="relative min-h-[420px] w-full overflow-hidden rounded-b-[var(--guest-radius-2xl)]">
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
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/10" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-8 pt-24 text-white sm:px-6 sm:pt-28">
        <div className="flex flex-wrap gap-2">
          <Badge className="w-fit rounded-full bg-amber-300 text-amber-950">{restaurant.badge}</Badge>
          {restaurant.categories.slice(0, 3).map((category) => (
            <Badge key={category} className="rounded-full bg-white/10 text-white backdrop-blur">
              {category}
            </Badge>
          ))}
        </div>
        <div className="max-w-3xl space-y-3">
          <h1 className="guest-heading-hero text-[clamp(2.5rem,4vw,4rem)] font-semibold">
            {restaurant.name}
          </h1>
          <p className="text-base leading-7 text-slate-100 sm:text-lg">{restaurant.detailSummary}</p>
          {restaurant.address ? (
            <p className="flex items-center gap-2 text-sm text-slate-100 sm:text-base">
              <MapPin className="h-5 w-5 text-amber-300" aria-hidden />
              {restaurant.address}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {restaurant.bestFor.map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white"
            >
              {item}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            className="rounded-full bg-slate-950 text-base text-white hover:bg-slate-800"
            asChild
          >
            <Link href={`/restaurants/${restaurant.slug}/book`}>Book a table</Link>
          </Button>
          {restaurant.googleMapUrl ? (
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-white/25 bg-white/10 text-base text-white hover:bg-white/15"
              asChild
            >
              <Link href={restaurant.googleMapUrl} target="_blank" rel="noreferrer">
                Get directions
              </Link>
            </Button>
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
  restaurant: RestaurantDirectoryEntry;
  mapEmbedUrl?: string | null;
}) {
  const quickFacts = [
    {
      title: 'Best fit',
      icon: Star,
      value: restaurant.bestFor.slice(0, 2).join(' · '),
      sub: 'What this venue is most useful for',
    },
    {
      title: 'Group fit',
      icon: Users,
      value: restaurant.capacity ? `Up to ${restaurant.capacity} guests` : 'Flexible party sizes',
      sub: 'Good to know before opening the booking flow',
    },
    {
      title: 'Arrival',
      icon: CarFront,
      value: restaurant.locality ?? 'Check venue details',
      sub: 'Location context at a glance',
    },
    {
      title: 'Booking',
      icon: CalendarCheck2,
      value: 'Instant online reservation',
      sub: restaurant.bookingPolicy?.trim() || 'Direct link into the live booking flow',
    },
  ];

  return (
    <section className="px-4 py-10 sm:px-6" aria-labelledby="restaurant-details-heading">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,2fr)_360px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-700">Venue guide</p>
            <h2
              id="restaurant-details-heading"
              className="guest-heading-page text-[length:var(--guest-text-page)] font-semibold text-slate-900"
            >
              Why diners pick {restaurant.name}
            </h2>
          </div>

          <Card className="space-y-4 rounded-[var(--guest-radius-xl)] border-slate-100 bg-white p-6 shadow-[var(--guest-shadow-sm)]">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-slate-900">Venue story</h3>
              {restaurant.story.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-slate-600 sm:text-base">
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <CategoryBlock title="Categories" items={restaurant.categories} />
              <CategoryBlock title="Atmosphere" items={restaurant.vibeTags} />
              <CategoryBlock title="Best for" items={restaurant.bestFor} />
              <CategoryBlock title="Amenities" items={restaurant.amenityTags} />
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {quickFacts.map((fact) => (
              <Card
                key={fact.title}
                className="space-y-2 rounded-[var(--guest-radius-lg)] border-slate-100 bg-white p-4 shadow-[var(--guest-shadow-sm)]"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <fact.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-sm text-slate-500">{fact.title}</p>
                </div>
                <p className="text-base font-semibold text-slate-900">{fact.value}</p>
                <p className="text-sm text-slate-500">{fact.sub}</p>
              </Card>
            ))}
          </div>

          <Card className="rounded-[var(--guest-radius-xl)] border-slate-100 bg-white p-6 shadow-[var(--guest-shadow-sm)]">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-blue-700">Food and drink cues</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">What stands out on the table</h3>
              </div>
              <ul className="space-y-3">
                {restaurant.foodHighlights.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-slate-600 sm:text-base">
                    <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card className="rounded-[var(--guest-radius-xl)] border-slate-100 bg-white p-6 shadow-[var(--guest-shadow-sm)]">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-blue-700">Decision helpers</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">The practical details people compare</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {restaurant.highlights.map((highlight) => (
                  <div
                    key={highlight.label}
                    className="rounded-[var(--guest-radius-lg)] border border-slate-100 bg-slate-50 p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                      {highlight.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{highlight.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4 rounded-[var(--guest-radius-xl)] border-slate-100 bg-white p-6 shadow-[var(--guest-shadow-md)] lg:sticky lg:top-24">
            <div className="space-y-1">
              <p className="text-sm text-blue-700">Book with context</p>
              <p className="text-2xl font-semibold text-slate-900">Reserve at {restaurant.name}</p>
              <p className="text-sm text-slate-600">
                Keep the venue guide open until you are happy with the fit, then jump straight into
                the live booking flow.
              </p>
            </div>
            <Button
              size="lg"
              className="w-full rounded-full bg-slate-950 text-base text-white hover:bg-slate-800"
              asChild
            >
              <Link href={`/restaurants/${restaurant.slug}/book`}>Book a table</Link>
            </Button>
            <div className="rounded-[var(--guest-radius-lg)] border border-slate-100 bg-slate-50 p-4">
              <p className="flex items-start gap-2 text-sm text-slate-600">
                <Sparkles className="mt-0.5 h-4 w-4 text-amber-500" aria-hidden />
                <span>{restaurant.bookingTips[0] ?? 'Booking-ready details stay visible on this page.'}</span>
              </p>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-4">
              {restaurant.contactPhone ? (
                <DetailLinkRow icon={Phone} href={`tel:${restaurant.contactPhone}`} label={restaurant.contactPhone} />
              ) : null}
              {restaurant.contactEmail ? (
                <DetailLinkRow
                  icon={BookOpenCheck}
                  href={`mailto:${restaurant.contactEmail}`}
                  label={restaurant.contactEmail}
                />
              ) : null}
              {restaurant.googleMapUrl ? (
                <DetailLinkRow icon={MapPin} href={restaurant.googleMapUrl} label="Open in Google Maps" external />
              ) : null}
              {restaurant.googleReviewUrl ? (
                <DetailLinkRow
                  icon={ExternalLink}
                  href={restaurant.googleReviewUrl}
                  label="Check public reviews"
                  external
                />
              ) : null}
            </div>
          </Card>

          {mapEmbedUrl ? (
            <iframe
              title={`${restaurant.name} map`}
              width="100%"
              height="260"
              className="rounded-[var(--guest-radius-xl)] border border-slate-100 bg-white"
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
    <main className="guest-theme flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 via-slate-950 to-slate-900 px-4 py-12 text-white">
      <div className="w-full max-w-lg space-y-5 rounded-[var(--guest-radius-2xl)] border border-white/20 bg-white/5 p-8 text-center shadow-[var(--guest-shadow-xl)] backdrop-blur">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-200/20 text-emerald-300">
          <Sparkles className="h-10 w-10" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">{headline}</h1>
          <p className="text-sm text-blue-100">{body}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
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
        </div>
      </div>
    </main>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--guest-radius-lg)] bg-white/10 p-4">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="text-sm text-blue-100">{label}</p>
    </div>
  );
}

function CategoryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[var(--guest-radius-lg)] border border-slate-100 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function DetailLinkRow({
  icon: Icon,
  href,
  label,
  external = false,
}: {
  icon: typeof Phone;
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="flex items-center justify-between gap-3 rounded-[var(--guest-radius-lg)] border border-slate-100 px-3 py-3 text-sm text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-700"
    >
      <span className="inline-flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span>{label}</span>
      </span>
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}
