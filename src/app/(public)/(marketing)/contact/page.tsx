import { CheckCircle2, MessageSquare, ShieldCheck } from 'lucide-react';

import {
  GuestContent,
  GuestHero,
  GuestInsetCard,
  GuestMetricCard,
  GuestPageFrame,
  GuestPanel,
} from '@/components/guest/ui';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Sales · Nab a Table',
  description:
    'Speak with Nab a Table sales about reservations, venue operations, and rollout support.',
  alternates: {
    canonical: 'https://nabatable.com/contact',
  },
};

const prepItems = [
  'Venue name and website',
  'Current booking process',
  'Opening hours and service periods',
  'What you want to reduce: admin, no-shows, or empty-table gaps',
];

export default function ContactPage() {
  return (
    <GuestPageFrame>
      <GuestHero
        eyebrow="Contact sales"
        title="Talk through the rollout before you change the floor."
        description="Share how bookings work today, where staff lose time, and what guest experience you want after launch."
        aside={
          <div className="grid grid-cols-2 gap-3">
            <GuestMetricCard icon={MessageSquare} label="Best first step" value="Your basics" />
            <GuestMetricCard icon={ShieldCheck} label="Scope" value="Setup" detail="No pressure" />
          </div>
        }
        compact
      />

      <GuestContent>
        <GuestPanel className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[5fr_7fr]">
          <div className="space-y-2">
            <p className="pg-kicker">What helps us help you</p>
            <h2 className="pg-section-title">Send the operational basics</h2>
            <p className="pg-body">
              A short note is enough. The goal is to understand the booking workflow before
              recommending setup.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Helpful details to include">
            {prepItems.map((item) => (
              <GuestInsetCard key={item} icon={CheckCircle2} value={item} className="h-full" />
            ))}
          </ul>
        </GuestPanel>
      </GuestContent>
    </GuestPageFrame>
  );
}
