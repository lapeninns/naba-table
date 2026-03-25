'use client';

import {
  ArrowRight,
  CalendarHeart,
  Compass,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import Link from 'next/link';

import {
  GuestPageSection,
  GuestPageShell,
  GuestSurfaceCard,
  HeadingLG,
  HeadingMD,
  HeadingXL,
  TextBody,
} from '@/components/guest/ui/GuestPrimitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface LandingPageProps {
  isAuthenticated: boolean;
}

export function LandingPage({ isAuthenticated }: LandingPageProps) {
  return (
    <GuestPageShell
      hero={
        <div className="guest-page mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-20">
          <div className="max-w-3xl space-y-6">
            <Badge variant="secondary" className="rounded-full px-4 py-1 text-xs tracking-[0.22em]">
              Guest-first dining discovery
            </Badge>
            <div className="space-y-4">
              <HeadingXL className="max-w-2xl">
                Book a table without second-guessing what happens next.
              </HeadingXL>
              <TextBody className="max-w-2xl text-lg text-muted-foreground">
                Start with trusted restaurants, see clear next steps, and keep every booking detail
                in one calm guest space from first visit to confirmation.
              </TextBody>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="rounded-full px-6 text-base" asChild>
                <Link href="/restaurants">Browse restaurants ready to book</Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full px-6 text-base" asChild>
                <Link href={isAuthenticated ? '/guest/dashboard' : '/bookings'}>
                  {isAuthenticated ? 'Open my guest dashboard' : 'Manage an existing booking'}
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {LANDING_TRUST_POINTS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm"
                >
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <GuestSurfaceCard className="w-full max-w-xl bg-background/95 p-6 sm:p-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                  Tonight&apos;s easiest route
                </p>
                <HeadingLG>From first browse to booked table in three calm steps.</HeadingLG>
              </div>
              <ol className="space-y-4">
                {LANDING_STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-4 rounded-2xl border border-border/60 bg-surface-warm px-4 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{step.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Button variant="secondary" size="lg" className="w-full rounded-full text-base" asChild>
                <Link href="/restaurants">
                  Explore restaurants
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </GuestSurfaceCard>
        </div>
      }
    >
      <div className="space-y-8 px-4 pt-8 sm:px-6">
        <GuestPageSection
          eyebrow="Why guests start here"
          title="A warmer way into discovery and booking."
          description="Every touchpoint uses the same guest language so you never fall into an ops-style flow."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {LANDING_FEATURES.map((feature) => (
              <GuestSurfaceCard key={feature.title} className="h-full p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" aria-hidden />
                </div>
                <HeadingMD className="mt-4 text-xl">{feature.title}</HeadingMD>
                <TextBody className="mt-2">{feature.description}</TextBody>
              </GuestSurfaceCard>
            ))}
          </div>
        </GuestPageSection>

        <GuestPageSection
          eyebrow="Keep moving"
          title="Choose the next guest-safe route."
          description="Clear entry points mean you always know whether you are browsing new places or checking an existing plan."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {LANDING_PATHWAYS.map((pathway) => (
              <GuestSurfaceCard key={pathway.title} className="flex h-full flex-col justify-between p-6">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <pathway.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <HeadingMD className="mt-4 text-xl">{pathway.title}</HeadingMD>
                  <TextBody className="mt-2">{pathway.description}</TextBody>
                </div>
                <Button
                  variant={pathway.variant}
                  className="mt-6 w-full rounded-full sm:w-fit"
                  asChild
                >
                  <Link href={pathway.href}>{pathway.cta}</Link>
                </Button>
              </GuestSurfaceCard>
            ))}
          </div>
        </GuestPageSection>
      </div>
    </GuestPageShell>
  );
}

export default LandingPage;

const LANDING_TRUST_POINTS = [
  {
    title: 'Clear next steps',
    detail: 'Browse, book, and check details without hunting for the right route.',
  },
  {
    title: 'Trusted booking flow',
    detail: 'The same guest shell follows you from discovery into confirmation.',
  },
  {
    title: 'Instant reassurance',
    detail: 'Confirmation and booking details stay easy to find after you sign in.',
  },
];

const LANDING_STEPS = [
  {
    title: 'Browse restaurants with confidence',
    description: 'See explicit detail and booking actions instead of guessing where to tap next.',
  },
  {
    title: 'Start a reservation in the same guest system',
    description: 'The booking flow keeps the same calm typography, cards, and trust cues.',
  },
  {
    title: 'Return to your plans any time',
    description: 'Signed-in guests land on the dashboard so current and upcoming bookings stay close.',
  },
];

const LANDING_FEATURES = [
  {
    icon: Compass,
    title: 'Guided discovery',
    description: 'Warm hierarchy above the fold points guests straight toward restaurants and booking.',
  },
  {
    icon: ShieldCheck,
    title: 'Trustworthy details',
    description: 'Important cues like confirmation, contact help, and route continuity stay visible.',
  },
  {
    icon: Sparkles,
    title: 'Consistent guest language',
    description: 'Shared shells, cards, and CTA styling keep every public page feeling connected.',
  },
];

const LANDING_PATHWAYS = [
  {
    icon: CalendarHeart,
    title: 'Start a new booking',
    description: 'Browse guest-ready restaurants and choose where you want to dine next.',
    cta: 'Browse restaurants',
    href: '/restaurants',
    variant: 'default' as const,
  },
  {
    icon: Star,
    title: 'Already have plans?',
    description: 'Open the booking hub to sign in or revisit reservation details without losing your place.',
    cta: 'View my bookings',
    href: '/bookings',
    variant: 'outline' as const,
  },
];
