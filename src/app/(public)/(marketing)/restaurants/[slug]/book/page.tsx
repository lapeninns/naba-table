import { ArrowLeft, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ReservationWizardClient } from '@/components/features/booking/wizard/ReservationWizardClient';
import { GuestPageShell, GuestSurfaceCard } from '@/components/guest/ui/GuestPrimitives';
import { Button } from '@/components/ui/button';
import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { slug } = await params;
  const safeSlug = slug?.replace(/-/g, ' ').replace(/\s+/g, ' ').trim() || 'restaurant';
  return {
    title: `Book ${safeSlug} · Nab a Table`,
    description: 'Reserve your table instantly with live availability and instant confirmation.',
  };
}

export default async function BookingPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const normalized = slug?.trim().toLowerCase() ?? '';

  if (!normalized) {
    return notFound();
  }

  const restaurant = await getRestaurantBySlug(normalized);
  if (!restaurant) {
    return notFound();
  }

  return (
    <GuestPageShell
      hero={
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="rounded-full bg-background/90" asChild>
              <Link href={`/restaurants/${restaurant.slug ?? normalized}`}>
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Back to restaurant details
              </Link>
            </Button>
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="mr-2 h-4 w-4 text-primary" aria-hidden />
              Guest booking flow
            </span>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Restaurant booking</p>
            <h1 className="heading-hero max-w-3xl">Finish booking with calm, guided steps.</h1>
            <p className="text-body-warm max-w-2xl">
              Review live availability for {restaurant.name} and complete your reservation without leaving the guest system.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {restaurant.address ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2">
                <MapPin className="h-4 w-4 text-primary" aria-hidden />
                {restaurant.address}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Instant confirmation cues stay visible throughout booking
            </span>
          </div>
        </div>
      }
      contentClassName="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14"
    >
      <GuestSurfaceCard className="overflow-hidden p-4 sm:p-5">
        <ReservationWizardClient restaurant={restaurant} />
      </GuestSurfaceCard>
    </GuestPageShell>
  );
}
