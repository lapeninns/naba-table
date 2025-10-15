'use client';

import Link from 'next/link';

import config from '@/config';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$0',
    cadence: 'per month',
    description: 'Perfect for testing ideas and running a single venue.',
    features: [
      'Up to 50 reservations per month',
      'Guest confirmation emails',
      'Basic analytics dashboard',
      'Community support',
    ],
    ctaLabel: 'Get started',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$99',
    cadence: 'per month',
    description: 'Everything you need to scale your hospitality operations.',
    features: [
      'Unlimited reservations',
      'Operations dashboard & exports',
      'Team invitations and roles',
      'Priority email support',
    ],
    highlight: true,
    ctaLabel: 'Start 14-day trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Let’s chat',
    cadence: '',
    description: 'Multi-location rollouts with advanced security controls.',
    features: [
      'Custom onboarding & data migration',
      'SSO & SLA-backed support',
      'Advanced analytics and reporting',
      'Dedicated success manager',
    ],
    ctaLabel: 'Book a demo',
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-24">
      <header className="mx-auto max-w-2xl text-center">
        <span className="rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
          Pricing
        </span>
        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Choose a plan that grows with your restaurant
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          Transparent pricing with no hidden fees. Upgrade or downgrade at any time as your business evolves.
        </p>
      </header>

      <section className="grid gap-8 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={cn(
              'flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm',
              plan.highlight ? 'ring-2 ring-primary/40' : ''
            )}
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{plan.name}</h2>
              <p className="text-sm text-slate-600">{plan.description}</p>
            </div>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
              {plan.cadence ? <span className="text-sm text-slate-500">{plan.cadence}</span> : null}
            </div>

            <ul className="mt-6 space-y-2 text-sm text-slate-700">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={plan.id === 'enterprise' ? '/contact' : '/signup'}
              className={cn(
                buttonVariants({ variant: plan.highlight ? 'default' : 'outline', size: 'lg' }),
                'mt-8 w-full justify-center'
              )}
            >
              {plan.ctaLabel}
            </Link>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center sm:p-12">
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Frequently asked questions</h2>
        <p className="mt-3 text-base text-slate-600">
          Need help finding the right plan?{' '}
          <a
            className="font-medium text-primary underline-offset-4 hover:underline"
            href={`mailto:${config.email.supportEmail ?? 'support@example.com'}`}
          >
            Email our team
          </a>{' '}
          and we’ll respond within one business day.
        </p>
      </section>
    </main>
  );
}
