import { Mail, Phone } from 'lucide-react';

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
    description: 'Share your venue, opening hours, and what you want to improve.',
    href: `mailto:${salesContact.email}`,
    value: salesContact.email,
    Icon: Mail,
  },
  {
    title: 'Call sales',
    description: 'Talk through setup, rollout, and how the system fits your service.',
    href: salesContact.phoneHref,
    value: salesContact.phone,
    Icon: Phone,
  },
] as const;

export default function ContactPage() {
  return (
    <article className="pg-container pg-section space-y-10">
      <header className="space-y-4">
        <p className="pg-kicker">
          Contact Sales
        </p>
        <h1 className="pg-section-title">Talk to sales</h1>
        <p className="pg-body max-w-3xl">
          Reach out if you want help rolling out Nab a Table, replacing manual booking admin, or
          tightening service-period and capacity setup for your venue.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Sales contact methods">
        {contactCards.map(({ title, description, href, value, Icon }) => (
          <a
            key={title}
            href={href}
            className="pg-card pg-card-interactive p-6 hover:border-primary/40 hover:bg-background"
          >
            <div className="flex items-start gap-4">
              <span className="rounded-full bg-primary/10 p-3 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="break-all text-lg font-semibold text-foreground sm:text-xl">{value}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          </a>
        ))}
      </section>

      <section className="pg-card p-6">
        <h2 className="pg-card-title">What to include</h2>
        <p className="pg-body mt-3 max-w-3xl">
          The fastest way to get a useful reply is to include your venue name, website, how you
          currently take bookings, and whether you want help with setup, migration, or guest
          operations.
        </p>
      </section>
    </article>
  );
}
