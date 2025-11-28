'use client';

import {
  CalendarClock,
  ChevronRight,
  Clock3,
  Crown,
  Heart,
  Map as MapIcon,
  MapPin,
  QrCode,
  Search,
  Share2,
  Sparkles,
  TimerReset,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useCallback, useMemo } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useBookings } from '@/hooks/useBookings';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useRestaurants } from '@/lib/restaurants/useRestaurants';
import { cn } from '@/lib/utils';
import { formatReservationDateFromDate, formatReservationTimeFromDate } from '@reserve/shared/formatting/booking';

import { deriveBookingState, type FavoriteRestaurant } from './booking-derivations';

import type { BookingDTO } from '@/hooks/useBookings';
import type { RestaurantSummary } from '@/lib/restaurants/types';

const DISCOVERY_HREF = '/restaurants';
type HeroState = 'hungry' | 'upcoming' | 'live';


type HeroBannerProps = {
  state: HeroState;
  booking: BookingDTO | null;
  userName: string | null;
  onShare: (() => void) | null;
};

type ActiveCardProps = {
  booking: BookingDTO | null;
  isLoading: boolean;
  onShare: () => void;
  onRunningLate: () => void;
};

type FavoritesProps = {
  favorites: FavoriteRestaurant[];
};

export function GuestDashboardClient() {
  const router = useRouter();
  const { data, isLoading, isError } = useBookings();
  const restaurantsQuery = useRestaurants({}, { placeholderData: [], retry: false, refetchOnWindowFocus: false });
  const { user } = useSupabaseSession();
  const { toast } = useToast();

  const derived = useMemo(() => deriveBookingState(data?.items ?? []), [data?.items]);
  const restaurants = restaurantsQuery.data ?? [];

  const heroState: HeroState = derived.liveBooking ? 'live' : derived.nextBooking ? 'upcoming' : 'hungry';
  const primaryBooking = derived.liveBooking ?? derived.nextBooking ?? null;

  const shareInvite = useCallback(() => {
    if (!primaryBooking) return;
    const url = `${window.location.origin}/bookings/${primaryBooking.id}`;
    const when = formatReservationTimeFromDate(new Date(primaryBooking.startIso), { timezone: primaryBooking.restaurantTimezone ?? undefined });
    const text = `Join me at ${primaryBooking.restaurantName} (${formatReservationDateFromDate(new Date(primaryBooking.startIso), { timezone: primaryBooking.restaurantTimezone ?? undefined })} at ${when}).`;

    const sharePayload = { title: 'Dinner plans', text, url };

    if (navigator.share) {
      void navigator.share(sharePayload).catch(() => {
        toast({ title: 'Share cancelled', description: 'No worries—copy the invite instead.' });
      });
      return;
    }

    void navigator.clipboard
      .writeText(`${text} ${url}`)
      .then(() => toast({ title: 'Link copied', description: 'Send it to your friends.' }))
      .catch(() => toast({ title: 'Unable to copy', description: 'Your browser blocked clipboard access.' }));
  }, [primaryBooking, toast]);

  const shareRunningLate = useCallback(() => {
    if (!primaryBooking) return;
    const url = `${window.location.origin}/bookings/${primaryBooking.id}`;
    const message = `Running a few minutes late for ${primaryBooking.restaurantName}. ETA: ${formatReservationTimeFromDate(
      new Date(primaryBooking.startIso),
      { timezone: primaryBooking.restaurantTimezone ?? undefined },
    )}.`;

    if (navigator.share) {
      void navigator.share({ title: 'Running late', text: message, url }).catch(() => undefined);
      return;
    }

    void navigator.clipboard
      .writeText(`${message} ${url}`)
      .then(() => toast({ title: 'Message copied', description: 'Send it to the host or your guests.' }))
      .catch(() => toast({ title: 'Could not copy', description: 'Use booking detail to notify the host.' }));
  }, [primaryBooking, toast]);

  const heroName = useMemo(() => {
    const metadata = (user?.user_metadata ?? null) as Record<string, unknown> | null;
    const fullName = typeof metadata?.['full_name'] === 'string' ? (metadata['full_name'] as string) : null;
    return fullName || user?.email || null;
  }, [user]);

  return (
    <div className="mx-auto flex w-full max-w-[80vw] flex-col gap-8 pb-24">
      <HeroBanner state={heroState} booking={primaryBooking} userName={heroName} onShare={primaryBooking ? shareInvite : null} />

      {isError ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">We couldn&apos;t load your bookings</CardTitle>
            <CardDescription className="text-amber-800">
              Check your connection and try again. Static discovery and perks are still available below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.refresh()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-8">
          <ActiveReservationCard booking={primaryBooking} isLoading={isLoading} onShare={shareInvite} onRunningLate={shareRunningLate} />
          <FavoritesRail favorites={derived.favorites} />
          <DiscoveryFeed restaurants={restaurants} isLoading={restaurantsQuery.isLoading} />
        </div>

        <aside className="space-y-8">
          <PerksCard totalBookings={derived.total} />
          <NextStepsCard hasActive={Boolean(primaryBooking)} />
        </aside>
      </div>
    </div>
  );
}

function HeroBanner({ state, booking, userName, onShare }: HeroBannerProps) {
  const greeting = getGreeting();
  const name = userName ? `, ${userName.split(' ')[0]}` : '';

  const headline = (() => {
    if (state === 'live' && booking) {
      return `Enjoy your meal at ${booking.restaurantName}`;
    }
    if (state === 'upcoming' && booking) {
      return `You have a table at ${booking.restaurantName}`;
    }
    return 'Where are we eating tonight?';
  })();

  const subcopy = (() => {
    if (state === 'live' && booking) return 'View the menu, order drinks, or ask for the check.';
    if (state === 'upcoming' && booking) return 'We’re holding your spot. See you soon.';
    return 'Discover top-rated tables, new openings, and your personal favorites.';
  })();

  const primaryHref = state === 'hungry' ? DISCOVERY_HREF : booking ? `/bookings/${booking.id}` : DISCOVERY_HREF;
  const secondaryHref = state === 'hungry'
    ? DISCOVERY_HREF
    : booking?.restaurantSlug
      ? `/restaurants/${booking.restaurantSlug}`
      : DISCOVERY_HREF;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl">
      {/* Background Image/Gradient */}
      <div
        className="absolute inset-0 opacity-60 mix-blend-overlay"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" />

      <div className="relative flex flex-col gap-6 px-6 py-10 sm:px-10 sm:py-12 md:flex-row md:items-center md:justify-between">
        <div className="space-y-4 md:max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {greeting}
              {name}
            </span>
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{headline}</h1>
          <p className="text-lg text-slate-300 sm:text-xl">{subcopy}</p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={primaryHref}
              className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'h-12 rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/20')}
            >
              {state === 'hungry' ? 'Find a Table' : 'View Ticket'}
            </Link>
            <Link
              href={secondaryHref}
              className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'h-12 rounded-full bg-white/10 px-8 text-base text-white backdrop-blur-sm hover:bg-white/20')}
            >
              {state === 'hungry' ? 'Open Map' : 'View Menu'}
            </Link>
            {onShare && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onShare}
                className="h-12 w-12 rounded-full bg-white/5 text-white hover:bg-white/10"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActiveReservationCard({ booking, isLoading, onShare, onRunningLate }: ActiveCardProps) {
  if (isLoading) {
    return (
      <Card className="rounded-3xl border-0 shadow-lg">
        <CardContent className="space-y-4 p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!booking) {
    return (
      <Card className="rounded-3xl border-dashed border-slate-200 bg-slate-50/50 shadow-none">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <UtensilsCrossed className="h-8 w-8 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">No active reservations</h3>
            <p className="text-slate-500">You don&apos;t have any upcoming bookings at the moment.</p>
          </div>
          <Link href={DISCOVERY_HREF} className={cn(buttonVariants({ variant: 'outline' }), "mt-2")}>
            Make a Reservation
          </Link>
        </CardContent>
      </Card>
    );
  }

  const detailHref = `/bookings/${booking.id}`;
  const googleMapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.restaurantName)}`;

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-900/5 transition-all hover:shadow-2xl">
      <div className="grid md:grid-cols-[1.5fr_1fr]">
        {/* Left Side: Details */}
        <div className="flex flex-col justify-between p-6 sm:p-8">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                  Upcoming
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">{booking.restaurantName}</h2>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <MapPin className="h-4 w-4" />
                  <span>Downtown • 2.4 mi</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Date</p>
                <p className="font-semibold text-slate-900">{formatReservationDateFromDate(new Date(booking.startIso), { timezone: booking.restaurantTimezone ?? undefined })}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Time</p>
                <p className="font-semibold text-slate-900">{formatReservationTimeFromDate(new Date(booking.startIso), { timezone: booking.restaurantTimezone ?? undefined })}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Guests</p>
                <p className="font-semibold text-slate-900">{booking.partySize} People</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={detailHref} className={cn(buttonVariants({ variant: 'default' }), 'rounded-full px-6 shadow-md shadow-primary/20')}>
              Modify Booking
            </Link>
            <a
              href={googleMapsHref}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: 'outline' }), 'rounded-full px-6')}
            >
              Directions
            </a>
            <Button variant="ghost" size="icon" onClick={onShare} className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
          <div className="mt-4">
            <Button variant="link" onClick={onRunningLate} className="h-auto p-0 text-xs text-slate-500 hover:text-amber-600">
              <TimerReset className="mr-1 h-3 w-3" />
              Running late?
            </Button>
          </div>
        </div>

        {/* Right Side: Ticket/QR Stub */}
        <div className="relative hidden flex-col items-center justify-center bg-slate-900 p-8 text-white md:flex">
          <div className="absolute left-0 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          <div className="absolute inset-y-0 left-0 border-l-2 border-dashed border-slate-700" />

          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-xl bg-white p-2">
              <QrCode className="h-full w-full text-slate-900" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-400">Reservation ID</p>
              <p className="font-mono text-xl tracking-widest text-white">{booking.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <p className="text-xs text-slate-500">Show this to the host upon arrival</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FavoritesRail({ favorites }: FavoritesProps) {
  if (favorites.length === 0) return null;

  return (
    <section aria-label="Your favorites" className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-slate-900">Your Favorites</h2>
        <Link href={DISCOVERY_HREF} className="group flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80">
          See all <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {favorites.map((item) => (
          <FavoriteCard key={item.name} favorite={item} />
        ))}
      </div>
    </section>
  );
}

function FavoriteCard({ favorite }: { favorite: FavoriteRestaurant }) {
  const initial = favorite.name.charAt(0).toUpperCase();
  const href = favorite.slug ? `/restaurants/${favorite.slug}` : DISCOVERY_HREF;

  return (
    <Link
      href={href}
      className="group relative flex h-40 w-40 flex-none snap-start flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
    >
      <Avatar className="h-10 w-10 border border-amber-100 bg-amber-50 text-amber-700">
        <AvatarFallback className="bg-amber-50 font-bold text-amber-700">{initial}</AvatarFallback>
      </Avatar>
      <div>
        <h3 className="line-clamp-2 font-semibold text-slate-900 group-hover:text-primary">{favorite.name}</h3>
        <p className="text-xs text-slate-500">{favorite.count} visits</p>
      </div>
    </Link>
  );
}

function DiscoveryFeed({ restaurants, isLoading }: { restaurants: RestaurantSummary[]; isLoading: boolean }) {
  return (
    <section aria-label="Discovery" className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-slate-900">Explore New Tables</h2>
        <Link href={DISCOVERY_HREF} className="group flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80">
          Open Map <MapIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {isLoading ? (
          <>
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </>
        ) : restaurants.length === 0 ? (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <p className="text-slate-500">No restaurants available right now.</p>
            </CardContent>
          </Card>
        ) : (
          restaurants.slice(0, 4).map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))
        )}
      </div>
    </section>
  );
}

const RestaurantCard = memo(function RestaurantCard({ restaurant }: { restaurant: RestaurantSummary }) {
  const href = restaurant.slug ? `/restaurants/${restaurant.slug}/book` : DISCOVERY_HREF;

  return (
    <Link href={href} className="group block h-full">
      <Card className="h-full overflow-hidden rounded-2xl border-0 shadow-sm transition-all hover:shadow-lg">
        <div className="relative h-48 bg-slate-100">
          {restaurant.logoUrl ? (
            <Image
              src={restaurant.logoUrl}
              alt={restaurant.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority={false}
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300">
              <UtensilsCrossed className="h-12 w-12" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 transition-opacity group-hover:opacity-70" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h3 className="text-xl font-bold leading-tight">{restaurant.name}</h3>
            <p className="text-sm text-white/90">{restaurant.address ?? 'Downtown'}</p>
          </div>
        </div>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock3 className="h-4 w-4" />
            <span>Next available: Today</span>
          </div>
          <Badge variant="secondary" className="group-hover:bg-primary group-hover:text-white transition-colors">
            Book Now
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
});

function PerksCard({ totalBookings }: { totalBookings: number }) {
  const progress = Math.min(totalBookings * 20, 100);
  const remaining = Math.max(0, Math.ceil((5 - totalBookings)));

  return (
    <Card className="overflow-hidden rounded-3xl border-0 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <Crown className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Membership</span>
          </div>
          <span className="font-mono text-xs text-slate-400">MEMBER ID • 9928</span>
        </div>
        <CardTitle className="mt-2 text-2xl">Gold Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Progress to Platinum</span>
            <span className="font-bold text-amber-400">{Math.min(progress, 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
            <div className="h-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-400">
            {remaining > 0 ? `${remaining} more visits to unlock priority seating.` : 'You have unlocked all rewards!'}
          </p>
        </div>
        <Button variant="outline" className="w-full border-slate-700 bg-transparent text-white hover:bg-slate-800 hover:text-white">
          View Wallet
        </Button>
      </CardContent>
    </Card>
  );
}

function NextStepsCard({ hasActive }: { hasActive: boolean }) {
  return (
    <Card className="rounded-3xl border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ActionRow icon={CalendarClock} label="Upcoming Reservations" href="/guest/bookings" />
        <ActionRow icon={Search} label="Browse Map" href={DISCOVERY_HREF} />
        <ActionRow icon={User} label="Dietary Preferences" href="/guest/profile" />
        {!hasActive && (
          <ActionRow icon={Heart} label="Saved Restaurants" href={DISCOVERY_HREF} />
        )}
      </CardContent>
    </Card>
  );
}

function ActionRow({ icon: Icon, label, href }: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-slate-50"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-medium text-slate-700">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-400" />
    </Link>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Late night';
}
