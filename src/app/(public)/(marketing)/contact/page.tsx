import { CheckCircle2, Mail, MessageSquare, Phone, ShieldCheck } from 'lucide-react';

import {
  GuestContent,
  GuestHero,
  GuestInsetCard,
  GuestMetricCard,
  GuestPageFrame,
  GuestPanel,
  GuestSectionHeader,
} from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { salesContact } from '@/config/sales-contact';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Sales · Nab a Table',
  description:
    'Speak with Nab a Table sales about reservations, venue operations, and rollout support.',
  alternates: {
    canonical: 'https://nabatable.com/contact',
  },
};

const contactCards = [
  {
    title: 'Email sales',
    description: 'Best for sharing current booking pain, venue links, and rollout timing.',
    href: `mailto:${salesContact.email}`,
    value: salesContact.email,
    Icon: Mail,
  },
  {
    title: 'Call sales',
    description: 'Best for talking through setup, capacity, and restaurant-service fit.',
    href: salesContact.phoneHref,
    value: salesContact.phone,
    Icon: Phone,
  },
] as const;

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
            <GuestMetricCard icon={MessageSquare} label="Best first step" value="Email" />
            <GuestMetricCard icon={ShieldCheck} label="Scope" value="Setup" detail="No pressure" />
          </div>
        }
        compact
      />

      <GuestContent>
        <GuestSectionHeader
          eyebrow="Direct channels"
          title="Reach the team without a support maze"
          description="Use the channel that matches how much context you already have. Both routes go to the same rollout team."
        />

        <section className="grid gap-4 md:grid-cols-2" aria-label="Sales contact methods">
          {contactCards.map(({ title, description, href, value, Icon }) => (
            <Button
              key={title}
              asChild
              variant="ghost"
              className="pg-panel pg-card-interactive group block h-auto whitespace-normal border-border/80 bg-[color:color-mix(in_srgb,var(--pg-surface-raised)_88%,white)] p-5 text-left shadow-[var(--pg-shadow-edge)] hover:border-primary/40 sm:p-6"
            >
              <a href={href}>
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="break-words text-lg font-semibold text-foreground sm:text-xl">
                      {value}
                    </p>
                    <p className="pg-caption">{description}</p>
                  </div>
                </div>
              </a>
            </Button>
          ))}
        </section>

        <GuestPanel className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[5fr_7fr]">
          <div className="space-y-2">
            <p className="pg-kicker">What helps us help you</p>
            <h2 className="pg-section-title">Send the operational basics</h2>
            <p className="pg-body">
              A short note is enough. The goal is to understand the booking workflow before
              recommending setup.
            </p>
            <Button
              asChild
              variant="guest-primary"
              size="guest-lg"
              className="pg-action pg-focus-ring pg-touch mt-4"
            >
              <a href={`mailto:${salesContact.email}`}>Email the rollout team</a>
            </Button>
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
