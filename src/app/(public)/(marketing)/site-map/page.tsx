import Link from 'next/link';

import {
  guestFacingPageCategories,
  guestFacingPagesByCategory,
  guestFacingPageSummary,
  type GuestFacingPage,
} from '@/app/guest-facing-pages';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guest Page Directory · Nab a Table',
  description:
    'Browse the guest-facing pages across discovery, booking, account, and support flows.',
  alternates: {
    canonical: 'https://nabatable.com/site-map',
  },
};

const accessBadgeStyles: Record<GuestFacingPage['access'], string> = {
  public: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'public with optional sign-in': 'border-sky-200 bg-sky-50 text-sky-800',
  'recovery link or sign-in': 'border-amber-200 bg-amber-50 text-amber-800',
  'signed-in guest': 'border-violet-200 bg-violet-50 text-violet-800',
};

const routeTypeBadgeStyles: Record<GuestFacingPage['routeType'], string> = {
  page: 'border-slate-200 bg-slate-100 text-slate-700',
  pattern: 'border-slate-200 bg-white text-slate-700',
  alias: 'border-primary/20 bg-primary/10 text-primary',
  redirect: 'border-orange-200 bg-orange-50 text-orange-800',
};

const seoBadgeStyles: Record<GuestFacingPage['seo'], string> = {
  indexed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'pattern-indexed': 'border-cyan-200 bg-cyan-50 text-cyan-800',
  excluded: 'border-zinc-200 bg-zinc-100 text-zinc-700',
};

const routeTypeLabels: Record<GuestFacingPage['routeType'], string> = {
  page: 'Primary page',
  pattern: 'Dynamic pattern',
  alias: 'Alias route',
  redirect: 'Redirect route',
};

const seoLabels: Record<GuestFacingPage['seo'], string> = {
  indexed: 'Indexed',
  'pattern-indexed': 'Indexed when concrete',
  excluded: 'Not indexed',
};

const summaryCards = [
  {
    label: 'Tracked routes',
    value: guestFacingPageSummary.total,
    description: 'All guest-facing pages, aliases, and redirects currently mapped.',
  },
  {
    label: 'Primary pages',
    value: guestFacingPageSummary.primaryPages,
    description: 'Canonical destinations guests can land on directly.',
  },
  {
    label: 'Indexed pages',
    value: guestFacingPageSummary.indexedStaticPages,
    description: 'Static public pages currently emitted into the XML sitemap.',
  },
  {
    label: 'Signed-in guest pages',
    value: guestFacingPageSummary.signedInGuestPages,
    description: 'Self-service routes inside the authenticated guest portal.',
  },
] as const;

function canNavigateToRoute(href: string): boolean {
  return !href.includes('[');
}

function RouteCard({ page }: { page: GuestFacingPage }) {
  const isNavigable = canNavigateToRoute(page.href);

  return (
    <li className="rounded-3xl border border-border bg-surface-elevated p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{page.title}</p>
          {isNavigable ? (
            <Link
              href={page.href}
              className="inline-flex items-center rounded-full border border-border px-3 py-1 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <code>{page.href}</code>
            </Link>
          ) : (
            <code className="inline-flex rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground">
              {page.href}
            </code>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${accessBadgeStyles[page.access]}`}
          >
            {page.access}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${routeTypeBadgeStyles[page.routeType]}`}
          >
            {routeTypeLabels[page.routeType]}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${seoBadgeStyles[page.seo]}`}
          >
            {seoLabels[page.seo]}
          </span>
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm text-body-warm">{page.description}</p>
      {page.note ? <p className="mt-3 text-sm text-muted-foreground">{page.note}</p> : null}
    </li>
  );
}

export default function GuestSiteMapPage() {
  return (
    <article className="guest-page space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Guest Page Directory
        </p>
        <h1 className="heading-page">All guest-facing pages</h1>
        <p className="max-w-3xl text-body-warm">
          This page maps the current guest surface area across discovery, booking, account, and
          support flows. It includes primary destinations, dynamic route patterns, and legacy helper
          routes so the structure is visible in one place.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Guest page summary">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-3xl border border-border bg-background/80 p-5 shadow-card"
          >
            <p className="text-sm font-semibold text-foreground">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {card.value}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
          </div>
        ))}
      </section>

      <nav
        aria-label="Guest page categories"
        className="rounded-3xl border border-border bg-surface-elevated p-5 shadow-card"
      >
        <p className="text-sm font-semibold text-foreground">Jump to a category</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {guestFacingPageCategories.map((category) => (
            <a
              key={category.id}
              href={`#${category.id}`}
              className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {category.title}
            </a>
          ))}
        </div>
      </nav>

      <section className="rounded-3xl border border-border bg-background/80 p-6 shadow-card">
        <h2 className="heading-section">How to read this directory</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Primary page</p>
            <p className="text-sm text-muted-foreground">
              A concrete destination guests can visit directly.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Dynamic pattern</p>
            <p className="text-sm text-muted-foreground">
              A real route family that needs a booking ID or restaurant slug before it becomes a
              concrete page.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Alias or redirect</p>
            <p className="text-sm text-muted-foreground">
              Helper paths kept for compatibility or smoother entry into the guest journey.
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-8">
        {guestFacingPagesByCategory.map((category) => (
          <section key={category.id} id={category.id} className="scroll-mt-28 space-y-4">
            <div className="space-y-2">
              <h2 className="heading-section">{category.title}</h2>
              <p className="max-w-3xl text-body-warm">{category.description}</p>
            </div>
            <ul className="grid gap-4 lg:grid-cols-2" aria-label={`${category.title} routes`}>
              {category.pages.map((page) => (
                <RouteCard key={page.href} page={page} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
