import { CalendarCheck, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';

import { GuestHero, GuestSection, GuestCard } from '@/components/guest/ui';
import { MarketingLayout } from '@/components/layouts/MarketingLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { Metadata } from 'next';

const BRAND_NAME = 'Nab a Table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${BRAND_NAME} - Reserve Your Perfect Table`,
  description: 'Discover and book tables at the best restaurants. Instant confirmation, easy management, unforgettable dining experiences.',
  openGraph: {
    title: `${BRAND_NAME} - Reserve Your Perfect Table`,
    description: 'Book your next dining experience in seconds',
    type: 'website',
  },
};

export default function Home() {
  const bookingPath = '/restaurants';

  return (
    <MarketingLayout>
      <div className="guest-page guest-sections">
        <GuestHero
          badge="Instant confirmations"
          title="Book the perfect table in seconds."
          description="Mobile-first flows, transparent status, and shareable confirmations. Everything a guest needs to feel confident about their reservation."
          ctas={
            <>
              <Link href={bookingPath}>
                <Button size="lg" className="h-12 px-6 text-base font-semibold rounded-full shadow-lg shadow-blue-300/50 guest-btn-primary">
                  <CalendarCheck className="mr-2 h-5 w-5" aria-hidden />
                  Find a table
                </Button>
              </Link>
              <Link href="/auth/signin">
                <Button variant="outline" size="lg" className="h-12 border-blue-200 px-6 text-base font-semibold text-blue-900 hover:bg-blue-50 rounded-full">
                  Sign in
                </Button>
              </Link>
            </>
          }
          className="bg-white"
        />

        <GuestSection
          eyebrow="How it works"
          title="A guest flow that stays clear"
          description="From discovery to confirmation, every step is predictable, fast, and accessible on any device."
          actions={
            <Link href={bookingPath}>
              <Button variant="ghost" className="text-blue-700 hover:bg-blue-50 rounded-full">
                Explore restaurants
              </Button>
            </Link>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 guest-stagger">
            {steps.map((step) => (
              <GuestCard
                key={step.title}
                className="guest-hover-card"
                header={
                  <div className="flex items-center gap-3">
                    <div className="guest-icon-box">
                      {step.icon}
                    </div>
                    <p className="text-sm font-semibold text-blue-700">{step.label}</p>
                  </div>
                }
              >
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.copy}</p>
                </div>
              </GuestCard>
            ))}
          </div>
        </GuestSection>

        <div className="grid gap-5 lg:grid-cols-[1.2fr,1fr]">
          <GuestSection
            eyebrow="Why guests stay"
            title="Clarity at every step"
            description="We keep states obvious: loading, pending, confirmed, or cancelled. Guests always know what's next—with inline actions for manage or cancel."
            padding="md"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {['Shareable confirmations', 'Calendar-ready receipts', 'Live status updates', 'Keyboard & screen-reader friendly'].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </GuestSection>

          <GuestSection
            eyebrow="Everywhere you are"
            title="Responsive by design"
            description="Built mobile-first with generous touch targets (≥44px), thumb-friendly CTAs, and reduced-motion support."
            padding="md"
            className="bg-gradient-to-br from-blue-50 via-white to-white"
          >
            <Badge className="bg-blue-600 text-white hover:bg-blue-600 rounded-full">Mobile · Tablet · Desktop</Badge>
          </GuestSection>
        </div>

        <GuestHero
          title="Ready to dine?"
          description="Join thousands of guests who book and manage tables in seconds."
          ctas={
            <>
              <Link href={bookingPath}>
                <Button size="lg" className="h-12 w-full px-8 text-base font-semibold shadow-md shadow-blue-300/50 sm:w-auto rounded-full guest-btn-primary">
                  <CalendarCheck className="mr-2 h-5 w-5" aria-hidden />
                  Book now
                </Button>
              </Link>
              <Link href="/guest/bookings">
                <Button variant="outline" size="lg" className="h-12 w-full border-blue-200 px-8 text-base font-semibold text-blue-800 hover:bg-blue-50 sm:w-auto rounded-full">
                  View my bookings
                </Button>
              </Link>
            </>
          }
          className="bg-white"
        />
      </div>
    </MarketingLayout>
  );
}

const steps = [
  {
    label: 'Step 1',
    title: 'Pick the vibe',
    copy: 'Browse curated restaurants with photos, tags, and live availability—no dead ends or guesswork.',
    icon: <MapPin className="h-4 w-4" aria-hidden />,
  },
  {
    label: 'Step 2',
    title: 'Lock the time',
    copy: 'See real-time slots with timezone-safe summaries. Inline validation keeps details accurate.',
    icon: <Clock className="h-4 w-4" aria-hidden />,
  },
  {
    label: 'Step 3',
    title: 'Get instant proof',
    copy: 'Shareable confirmations, calendar add, and manage/cancel in one tap—on any device.',
    icon: <CalendarCheck className="h-4 w-4" aria-hidden />,
  },
];
