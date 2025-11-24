'use client';

import {
  AlarmClock,
  CalendarClock,
  Clock3,
  Crown,
  Heart,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  Share2,
  Sparkles,
  TimerReset,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useBookings } from '@/hooks/useBookings';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useRestaurants } from '@/lib/restaurants/useRestaurants';
import { cn } from '@/lib/utils';
import { formatReservationDate, formatReservationTime } from '@reserve/shared/formatting/booking';
import { normalizeTime } from '@reserve/shared/time';
import { DEFAULT_RESTAURANT_SLUG } from '@shared/config/venue';

import { deriveBookingState, type FavoriteRestaurant } from './booking-derivations';

import type { BookingDTO } from '@/hooks/useBookings';
import type { RestaurantSummary } from '@/lib/restaurants/types';

type HeroState = 'hungry' | 'upcoming' | 'live';

const DISCOVERY_HREF = `/restaurants/${DEFAULT_RESTAURANT_SLUG}/book`;

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
    const when = formatReservationTime(normalizeTime(primaryBooking.startIso) ?? primaryBooking.startIso);
    const text = `Join me at ${primaryBooking.restaurantName} (${formatReservationDate(primaryBooking.startIso)} at ${when}).`;

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
    const message = `Running a few minutes late for ${primaryBooking.restaurantName}. ETA: ${formatReservationTime(
      normalizeTime(primaryBooking.startIso) ?? primaryBooking.startIso,
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-24 md:gap-8">
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
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:gap-8">
        <div className="space-y-6 md:space-y-7">
          <ActiveReservationCard booking={primaryBooking} isLoading={isLoading} onShare={shareInvite} onRunningLate={shareRunningLate} />
          <FavoritesRail favorites={derived.favorites} />
          <DiscoveryFeed restaurants={restaurants} isLoading={restaurantsQuery.isLoading} />
        </div>

        <aside className="space-y-6 md:space-y-7">
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
      return `${booking.restaurantName} is coming up soon`;
    }
    return 'What are you craving tonight?';
  })();

  const subcopy = (() => {
    if (state === 'live' && booking) return 'Peek the dessert menu or add a bottle while you dine.';
    if (state === 'upcoming' && booking) return 'Confirm details, share the invite, or add a note for the host.';
    return 'See tables nearby, trending lists, and your go-tos in one view.';
  })();

  const primaryHref = state === 'hungry' ? DISCOVERY_HREF : booking ? `/bookings/${booking.id}` : DISCOVERY_HREF;
  const secondaryHref = state === 'hungry'
    ? DISCOVERY_HREF
    : booking?.restaurantSlug
      ? `/restaurants/${booking.restaurantSlug}`
      : DISCOVERY_HREF;

  const timing = booking ? describeTiming(booking.startIso) : null;

  return (
    <Card className="relative overflow-hidden border-none bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15,23,42,0.9), rgba(15,23,42,0.8), rgba(15,23,42,0.6)), url(https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden
      />
      <CardContent className="relative flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3 text-left md:max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-100">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span>
              {greeting}
              {name}
            </span>
          </div>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-4xl">{headline}</h1>
          <p className="text-base text-slate-200 sm:text-lg">{subcopy}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href={primaryHref}
              className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'bg-white text-slate-900 hover:bg-slate-100')}
            >
              {state === 'hungry' ? 'Explore tables' : 'Open reservation'}
            </Link>
            <Link
              href={secondaryHref}
              className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'border-white/30 bg-white/10 text-white hover:bg-white/20')}
            >
              {state === 'hungry' ? 'View on map' : 'View menu'}
            </Link>
            {state !== 'hungry' && onShare ? (
              <Button variant="ghost" className="text-slate-200 hover:bg-white/10" onClick={() => onShare()}>
                <Share2 className="mr-2 h-4 w-4" aria-hidden /> Invite friends
              </Button>
            ) : null}
          </div>
        </div>

        {booking ? (
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 p-4 text-left shadow-md backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-200">Next up</p>
                <p className="text-lg font-semibold text-white">{booking.restaurantName}</p>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white">
                {timing ?? 'Soon'}
              </Badge>
            </div>
            <Separator className="my-3 bg-white/15" />
            <div className="space-y-2 text-sm text-slate-100">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" aria-hidden />
                <span>{formatReservationDate(booking.startIso)}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlarmClock className="h-4 w-4" aria-hidden />
                <span>{formatReservationTime(normalizeTime(booking.startIso) ?? booking.startIso)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" aria-hidden />
                <span className="truncate">Table for {booking.partySize}</span>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActiveReservationCard({ booking, isLoading, onShare, onRunningLate }: ActiveCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-36 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!booking) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <LocateFixed className="h-5 w-5" aria-hidden />
            No active tables yet
          </CardTitle>
          <CardDescription className="text-slate-600">
            Plan ahead or grab something nearby. We keep your recent favorites handy below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Link href={DISCOVERY_HREF} className={buttonVariants({ variant: 'default', size: 'lg' })}>
            Find a table now
          </Link>
          <Link href="/guest/bookings" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            View all bookings
          </Link>
        </CardContent>
      </Card>
    );
  }

  const detailHref = `/bookings/${booking.id}`;
  const googleMapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.restaurantName)}`;

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
        <div
          className="relative min-h-[220px] bg-slate-100"
          style={{
            backgroundImage:
              'linear-gradient(to top, rgba(15,23,42,0.8), rgba(15,23,42,0.2)), url(https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1200&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 text-white">
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-[0.12em] text-white/80">Active table</p>
              <p className="text-2xl font-semibold leading-snug">{booking.restaurantName}</p>
            </div>
            <Badge className="bg-white/20 text-white">Table for {booking.partySize}</Badge>
          </div>
        </div>

        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="text-primary">
              {formatReservationDate(booking.startIso)}
            </Badge>
            <Badge variant="outline">{formatReservationTime(normalizeTime(booking.startIso) ?? booking.startIso)}</Badge>
          </div>
          <p className="text-slate-700">Keep your party synced, update arrival, and navigate without leaving the dashboard.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={detailHref} className={buttonVariants({ variant: 'default' })}>
              Modify party
            </Link>
            <Link href={`${detailHref}?intent=cancel`} className={buttonVariants({ variant: 'outline' })}>
              Cancel
            </Link>
            <a
              href={googleMapsHref}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: 'secondary' }), 'flex items-center justify-center gap-2')}
            >
              <Navigation className="h-4 w-4" aria-hidden /> Directions
            </a>
            <Button variant="ghost" onClick={onShare} className="justify-start">
              <Share2 className="mr-2 h-4 w-4" aria-hidden /> Share invite link
            </Button>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <Button variant="link" className="px-0 text-primary" onClick={onRunningLate}>
              <TimerReset className="mr-2 h-4 w-4" aria-hidden /> Running late
            </Button>
            <Link href={detailHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-primary">
              <Heart className="h-4 w-4" aria-hidden /> Add special requests
            </Link>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function FavoritesRail({ favorites }: FavoritesProps) {
  return (
    <section aria-label="Your favorites" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Favorites</p>
          <h2 className="text-xl font-semibold text-slate-900">Eat it again</h2>
        </div>
        <Link href={DISCOVERY_HREF} className="text-sm font-semibold text-primary hover:text-primary/80">
          See all
        </Link>
      </div>

      {favorites.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-slate-600">
            <Heart className="h-4 w-4" aria-hidden />
            Once you dine a couple of times, we’ll pin your go-tos here for one-tap rebooking.
          </CardContent>
        </Card>
      ) : (
        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
          {favorites.map((item) => (
            <FavoritePill key={item.name} favorite={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function FavoritePill({ favorite }: { favorite: FavoriteRestaurant }) {
  const initial = favorite.name.charAt(0).toUpperCase();
  const href = favorite.slug ? `/restaurants/${favorite.slug}` : DISCOVERY_HREF;

  return (
    <Card className="min-w-[200px] snap-start bg-gradient-to-br from-white to-slate-50 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 bg-primary/10 text-primary">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900">{favorite.name}</span>
            <span className="text-xs text-slate-600">Booked {favorite.count}×</span>
          </div>
        </div>
        <Link href={href} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          Book again
        </Link>
      </CardContent>
    </Card>
  );
}

function DiscoveryFeed({ restaurants, isLoading }: { restaurants: RestaurantSummary[]; isLoading: boolean }) {
  return (
    <section aria-label="Discovery" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Discover</p>
          <h2 className="text-xl font-semibold text-slate-900">Tables available now</h2>
        </div>
        <Link href={DISCOVERY_HREF} className="text-sm font-semibold text-primary hover:text-primary/80">
          Open map
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {isLoading ? (
          <>
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </>
        ) : restaurants.length === 0 ? (
          <Card className="sm:col-span-2 border-dashed">
            <CardContent className="p-4 text-sm text-slate-600">
              No restaurants yet. Check back soon as partners come online.
            </CardContent>
          </Card>
        ) : (
          restaurants.slice(0, 4).map((restaurant) => {
            const href = restaurant.slug ? `/restaurants/${restaurant.slug}/book` : DISCOVERY_HREF;
            return (
              <article key={restaurant.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 p-4">
                  <Avatar className="h-12 w-12 bg-primary/10 text-primary">
                    <AvatarFallback>{restaurant.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{restaurant.name}</p>
                    <p className="truncate text-xs text-slate-600">
                      {restaurant.address ?? restaurant.timezone ?? 'View details'}
                    </p>
                  </div>
                  <Link
                    href={href}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
                  >
                    Book
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Collections</h3>
          <Link href={DISCOVERY_HREF} className="text-sm font-semibold text-primary hover:text-primary/80">
            See more
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {isLoading ? (
            <>
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </>
          ) : restaurants.length === 0 ? (
            <Card className="md:col-span-3 border-dashed">
              <CardContent className="p-4 text-sm text-slate-600">Add restaurants to see collections.</CardContent>
            </Card>
          ) : (
            restaurants.slice(0, 3).map((restaurant) => {
              const href = restaurant.slug ? `/restaurants/${restaurant.slug}/book` : DISCOVERY_HREF;
              return (
                <Link
                  href={href}
                  key={restaurant.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-sm"
                >
                  <div className="relative h-32 w-full bg-gradient-to-br from-primary/10 via-primary/5 to-slate-50" aria-hidden />
                  <div className="absolute inset-0 flex flex-col justify-end gap-2 p-4">
                    <Badge className="w-fit bg-primary/10 text-primary">Popular</Badge>
                    <p className="text-lg font-semibold leading-snug text-slate-900">{restaurant.name}</p>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                      {restaurant.timezone ?? 'See schedule'}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function PerksCard({ totalBookings }: { totalBookings: number }) {
  const progress = Math.min(totalBookings * 20, 100);
  const remaining = Math.max(0, Math.ceil((5 - totalBookings)));
  return (
    <Card className="bg-gradient-to-br from-amber-50 via-white to-amber-50">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-amber-700">
          <Crown className="h-5 w-5" aria-hidden />
          <p className="text-sm font-semibold">Loyalty & Perks</p>
        </div>
        <CardTitle className="text-2xl text-slate-900">Dining progress</CardTitle>
        <CardDescription className="text-amber-800">
          {remaining > 0 ? `${remaining} more visit${remaining === 1 ? '' : 's'} until your next reward.` : 'Rewards unlocked—enjoy priority seating.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center text-sm text-slate-700">
          <StatPill label="Visits" value={totalBookings} />
          <StatPill label="Next perk" value={`${Math.min(progress, 100)}%`} />
          <StatPill label="Status" value={totalBookings >= 5 ? 'Gold' : 'Starter'} />
        </div>
        <Link href="/guest/profile" className={buttonVariants({ variant: 'secondary' })}>
          View rewards wallet
        </Link>
      </CardContent>
    </Card>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-amber-100 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">{label}</p>
      <p className="text-base font-bold text-slate-900">{value}</p>
    </div>
  );
}

function NextStepsCard({ hasActive }: { hasActive: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Next steps</CardTitle>
        <CardDescription>Quick actions to keep plans smooth.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        <ActionRow icon={CalendarClock} label="See upcoming reservations" href="/guest/bookings" />
        <ActionRow icon={Search} label="Browse map view" href={DISCOVERY_HREF} />
        <ActionRow icon={User} label="Update dietary preferences" href="/guest/profile" />
        {!hasActive ? (
          <ActionRow icon={Heart} label="Build your saved list" href={DISCOVERY_HREF} />
        ) : null}
      </CardContent>
    </Card>
  );
}

type ActionRowProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
};

function ActionRow({ icon: Icon, label, href }: ActionRowProps) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 transition hover:border-primary/40 hover:bg-primary/5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-slate-800">{label}</span>
      </div>
      <Navigation className="h-4 w-4 text-slate-500" aria-hidden />
    </Link>
  );
}



function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Late night plans?';
}

function describeTiming(iso: string): string {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 'Soon';
  const diffMs = start.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes <= 0) return 'Now';
  if (diffMinutes < 60) return `in ${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return mins ? `in ${hours}h ${mins}m` : `in ${hours}h`;
}
