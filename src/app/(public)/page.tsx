import { CalendarCheck, Clock, Sparkles, MapPin, Users, Bell } from 'lucide-react';
import Link from 'next/link';


import { FeatureCard } from '@/components/shared/FeatureCard';
import { PageHero } from '@/components/shared/PageHero';
import { PageSection } from '@/components/shared/PageSection';
import { DEFAULT_RESTAURANT_SLUG } from '@shared/config/venue';
import { Button } from '@shared/ui/button';

import type { Metadata } from 'next';

const BRAND_NAME = 'Nab a Table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${BRAND_NAME} - Reserve Your Perfect Table`,
  description:
    'Discover and book tables at the best restaurants. Instant confirmation, easy management, unforgettable dining experiences powered by Lapen Inns.',
  openGraph: {
    title: `${BRAND_NAME} - Reserve Your Perfect Table`,
    description: 'Book your next dining experience in seconds',
    type: 'website',
  },
};

export default function Home() {
  const bookingSlug = DEFAULT_RESTAURANT_SLUG?.trim();
  const bookingPath = bookingSlug && bookingSlug !== 'default'
    ? `/restaurants/${bookingSlug}/book`
    : '/restaurants';

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <PageHero
        title="Reserve Your Perfect Table"
        description="Discover and book tables at the best restaurants. Instant confirmation, easy management, unforgettable dining experiences."
        size="large"
      >
        <Link href={bookingPath}>
          <Button size="lg" className="h-14 px-8 text-base font-semibold shadow-lg">
            <CalendarCheck className="mr-2 h-5 w-5" aria-hidden="true" />
            Find a Table
          </Button>
        </Link>
        <Link href="/auth/signin">
          <Button
            variant="outline"
            size="lg"
            className="h-14 px-8 text-base font-semibold"
          >
            Sign In
          </Button>
        </Link>
      </PageHero>

      {/* How It Works */}
      <PageSection
        id="how-it-works"
        title="How It Works"
        description="Book your table in three simple steps"
        className="bg-muted/30"
      >
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <ProcessStep
            step={1}
            icon={<MapPin className="h-6 w-6" />}
            title="Choose Your Restaurant"
            description="Browse our curated selection and find the perfect spot for your occasion."
          />
          <ProcessStep
            step={2}
            icon={<Clock className="h-6 w-6" />}
            title="Select Date & Time"
            description="Pick your preferred date, time, and party size with real-time availability."
          />
          <ProcessStep
            step={3}
            icon={<CalendarCheck className="h-6 w-6" />}
            title="Confirm & Enjoy"
            description="Get instant confirmation and manage your booking from anywhere."
          />
        </div>
      </PageSection>

      {/* Features */}
      <PageSection
        id="features"
        title={`Why Choose ${BRAND_NAME}?`}
        description="Everything you need for effortless dining reservations"
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Sparkles className="h-6 w-6" />}
            title="Instant Confirmation"
            description="No waiting, no uncertainty. Get confirmed reservations in seconds."
          />
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title="Easy Management"
            description="Modify or cancel your bookings anytime with just a few taps."
          />
          <FeatureCard
            icon={<Bell className="h-6 w-6" />}
            title="Timely Reminders"
            description="Never miss a reservation with smart notifications and email reminders."
          />
        </div>
      </PageSection>

      {/* CTA Section */}
      <PageSection className="bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="mx-auto max-w-[80vw] rounded-3xl border border-border bg-card p-8 text-center shadow-xl sm:p-12">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to dine?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Join thousands of diners who trust {BRAND_NAME} for their reservations.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href={bookingPath}>
              <Button size="lg" className="h-14 w-full px-10 text-base font-semibold shadow-lg sm:w-auto">
                <CalendarCheck className="mr-2 h-5 w-5" aria-hidden="true" />
                Book Now
              </Button>
            </Link>
          </div>
        </div>
      </PageSection>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[80vw]">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
                Product
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    href={bookingPath}
                    className="text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    Make a Reservation
                  </Link>
                </li>
                <li>
                  <Link
                    href="/guest/bookings"
                    className="text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    My Bookings
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
                Account
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/auth/signin"
                    className="text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link
                    href="/guest/dashboard"
                    className="text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
                Company
              </h3>
              <ul className="space-y-2">
                <li>
                  <span className="text-sm text-muted-foreground">About</span>
                </li>
                <li>
                  <span className="text-sm text-muted-foreground">Contact</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
                Legal
              </h3>
              <ul className="space-y-2">
                <li>
                  <span className="text-sm text-muted-foreground">Privacy Policy</span>
                </li>
                <li>
                  <span className="text-sm text-muted-foreground">Terms of Service</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ProcessStep({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="relative">
      {/* Step Number */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {step}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
      </div>

      {/* Content */}
      <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
        {description}
      </p>
    </div>
  );
}
