import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  MessageSquare,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const BOOKING_PATH = "/restaurants";
const SIGN_IN_PATH = "/auth/signin";
const GUEST_PATH = "/guest/bookings";

const HERO_STATS = [
  {
    label: "Instant slots",
    value: "42",
    detail: "available now",
  },
  {
    label: "Avg. confirmation",
    value: "2.4s",
    detail: "from tap",
  },
  {
    label: "Guest NPS",
    value: "+72",
    detail: "rolling 30d",
  },
];

const BOOKING_ROWS = [
  {
    id: "BKG-1042",
    guest: "Ava Chen",
    detail: "Tonight • 7:30 PM",
    status: "Confirmed",
  },
  {
    id: "BKG-1046",
    guest: "Mateo Rivera",
    detail: "Tonight • 8:00 PM",
    status: "Pending",
  },
  {
    id: "BKG-1051",
    guest: "Noah Patel",
    detail: "Tomorrow • 6:45 PM",
    status: "Confirmed",
  },
];

const METRIC_TILES = [
  {
    label: "Completion time",
    badge: "+21% faster",
    value: "8.4s",
    copy: "Average guest booking flow",
  },
  {
    label: "Waitlist to table",
    badge: "< 15m",
    value: "92%",
    copy: "Guests seated during peak hours",
  },
  {
    label: "Cancellation saves",
    badge: "Smart fill",
    value: "138",
    copy: "Tables automatically rebooked each week",
  },
];

const JOURNEY_STEPS = [
  {
    title: "Search & discover",
    copy: "Guided filters and live tags expose the right vibe instantly.",
    icon: Search,
  },
  {
    title: "Book & confirm",
    copy: "Inline validation plus device-friendly inputs keep errors at zero.",
    icon: CheckCircle2,
  },
  {
    title: "Manage & share",
    copy: "Receipts, calendar add, and change/cancel actions in one tap.",
    icon: MessageSquare,
  },
];

const JOURNEY_PROOF = [
  {
    title: "Live availability",
    copy: "Every status update ripples through the guest portal and host tablet in milliseconds.",
  },
  {
    title: "Trust & safety",
    copy: "Multi-factor links protect edits, while audit trails live with each booking.",
  },
  {
    title: "Accessibility first",
    copy: "Keyboard support, aria-live confirmations, and WCAG-compliant contrast by default.",
  },
];

const CTA_HIGHLIGHTS = [
  "No app download required",
  "Calendar-ready receipts",
  "Live concierge support",
];

export function HomeHeroSection() {
  return (
    <section className="px-4 py-12 sm:px-6 md:py-16 lg:py-20" aria-labelledby="home-hero-heading">
      <div className="mx-auto flex max-w-6xl flex-col gap-[var(--guest-space-2xl)] lg:flex-row">
        <div className="flex-1 space-y-[var(--guest-space-lg)]">
          <Badge
            variant="secondary"
            className="w-fit rounded-full px-4 py-1 text-[0.85rem] uppercase tracking-[0.2em] text-blue-900"
          >
            Guest OS • Always on
          </Badge>

          <div className="space-y-4">
            <h1
              id="home-hero-heading"
              className={cn(
                "guest-heading-hero text-[length:var(--guest-text-hero-lg)] font-bold",
                "text-slate-900",
              )}
            >
              Bookings built for real-time hospitality.
            </h1>
            <p className="text-[length:var(--guest-text-body)] text-slate-600">
              From first tap to final toast, every surface follows one cohesive playbook—tokens, content, and
              accessibility tuned for guests.
            </p>
          </div>

          <form
            className="rounded-[var(--guest-radius-xl)] bg-white/90 p-4 shadow-[var(--guest-shadow-lg)]"
            aria-label="Quick booking search"
            action={BOOKING_PATH}
            role="search"
          >
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <label className="sr-only" htmlFor="hero-search">
                  Search city or restaurant
                </label>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="hero-search"
                  name="hero-search"
                  type="search"
                  placeholder="Search by restaurant, city, or vibe"
                  className="h-12 rounded-[var(--guest-radius-lg)] border-transparent bg-slate-50 pl-12 text-base"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-12 rounded-[var(--guest-radius-lg)] text-base"
                asChild
              >
                <Link href={BOOKING_PATH}>
                  <CalendarCheck className="mr-2 h-5 w-5" aria-hidden />
                  Find a table
                </Link>
              </Button>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <Shield className="h-4 w-4" aria-hidden />
              Status syncs everywhere in real time.
            </p>
          </form>

          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link href={SIGN_IN_PATH}>Sign in</Link>
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full text-blue-700" asChild>
              <Link href={GUEST_PATH}>View my bookings</Link>
            </Button>
          </div>
        </div>

        <div className="flex-1">
          <Card className="flex flex-col gap-6 rounded-[var(--guest-radius-2xl)] border border-blue-100 bg-white/80 p-6 shadow-[var(--guest-shadow-xl)]">
            <header className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Live control room</p>
                  <p className="text-lg font-semibold text-slate-900">Bluebird Bistro</p>
                </div>
                <Badge className="rounded-full bg-blue-50 text-blue-700">Open</Badge>
              </div>
              <p className="text-sm text-slate-500">The same UI stack that powers the real guest dashboard.</p>
            </header>

            <div className="grid gap-4 sm:grid-cols-3">
              {HERO_STATS.map((stat) => (
                <div key={stat.label} className="rounded-[var(--guest-radius-lg)] border border-blue-100 bg-blue-50/60 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-blue-700">{stat.label}</p>
                  <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.detail}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[var(--guest-radius-xl)] border border-slate-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Upcoming arrivals</p>
                <Button variant="ghost" size="sm" className="text-blue-700" asChild>
                  <Link href={BOOKING_PATH}>Open board</Link>
                </Button>
              </div>
              <ul className="mt-4 space-y-3" aria-label="Sample bookings">
                {BOOKING_ROWS.map((row) => (
                  <li key={row.id} className="flex items-center justify-between rounded-[var(--guest-radius-lg)] border border-slate-100 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{row.guest}</p>
                      <p className="text-xs text-slate-500">{row.detail}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-3 py-1 text-xs",
                        row.status === "Confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                      )}
                    >
                      {row.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-slate-400">Reusable tiles, cards, and badges keep the language familiar for guests.</p>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function HomeMetricsSection() {
  return (
    <section className="px-4 py-16 sm:px-6" aria-labelledby="home-metrics-heading">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="space-y-4 text-center">
          <Badge variant="secondary" className="rounded-full px-4 py-1 text-blue-900">
            Product metrics
          </Badge>
          <h2 id="home-metrics-heading" className="guest-heading-page text-[length:var(--guest-text-page)] font-semibold text-slate-900">
            Highlights from the guest funnel
          </h2>
          <p className="text-slate-600">Consistent cards make new launches feel native on day one.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {METRIC_TILES.map((metric) => (
            <article
              key={metric.label}
              className="rounded-[var(--guest-radius-xl)] border border-slate-100 bg-white p-6 shadow-[var(--guest-shadow-lg)]"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <p className="text-slate-500">{metric.label}</p>
                <Badge className="rounded-full bg-blue-50 text-blue-700">{metric.badge}</Badge>
              </div>
              <p className="mt-4 text-4xl font-semibold text-slate-900">{metric.value}</p>
              <p className="mt-2 text-sm text-slate-500">{metric.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeJourneySection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:py-20" aria-labelledby="home-journey-heading">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[var(--guest-radius-2xl)] border border-slate-100 bg-white/90 p-6 shadow-[var(--guest-shadow-xl)]">
          <Badge variant="secondary" className="rounded-full px-4 py-1 text-blue-900">
            Flow blueprint
          </Badge>
          <h2 id="home-journey-heading" className="mt-4 guest-heading-page text-[length:var(--guest-text-page)] font-semibold text-slate-900">
            A journey that feels familiar everywhere
          </h2>
          <p className="mt-2 text-slate-600">Sections below mirror the building blocks used across the guest web and host portal.</p>

          <ol className="mt-8 space-y-6">
            {JOURNEY_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[var(--guest-radius-lg)] bg-blue-50 text-blue-700">
                  <step.icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Step {index + 1}</p>
                  <p className="text-lg font-semibold text-slate-900">{step.title}</p>
                  <p className="text-sm text-slate-600">{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-[var(--guest-radius-2xl)] border border-slate-100 bg-slate-900/90 p-6 text-white shadow-[var(--guest-shadow-xl)]">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Signal center</span>
            <span className="flex items-center gap-2 text-emerald-300">
              <Sparkles className="h-4 w-4" aria-hidden /> Live updates
            </span>
          </div>
          <div className="mt-6 space-y-4">
            {JOURNEY_PROOF.map((item) => (
              <article key={item.title} className="rounded-[var(--guest-radius-xl)] border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-300">{item.title}</p>
                <p className="text-base font-medium text-white">{item.copy}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-[var(--guest-radius-xl)] border border-white/10 bg-white/10 p-4">
            <p className="text-sm text-slate-200">Host response SLA</p>
            <p className="text-4xl font-semibold text-white">
              <span className="align-super text-lg">≈</span> 11m
            </p>
            <p className="text-xs text-slate-300">Average support speed for VIP waitlist requests.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeCTASection() {
  return (
    <section className="px-4 pb-20 pt-10 sm:px-6" aria-labelledby="home-cta-heading">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[calc(var(--guest-radius-2xl)*1.2)] border border-blue-100 bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 px-6 py-12 text-white shadow-[var(--guest-shadow-xl)]">
        <div className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-100">Ready state</p>
          <h2 id="home-cta-heading" className="guest-heading-hero text-[clamp(2rem,4vw,3rem)] font-semibold">
            Launch the guest flow in minutes
          </h2>
          <p className="text-base text-blue-100">Same spacing scale, focus treatments, and tone—without extra work.</p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            variant="secondary"
            className="h-14 rounded-full px-8 text-lg font-semibold text-blue-700"
            asChild
          >
            <Link href={BOOKING_PATH}>
              <CalendarCheck className="mr-2 h-5 w-5" aria-hidden />
              Start booking
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 rounded-full border-white/40 px-8 text-lg text-white hover:bg-white/10"
            asChild
          >
            <Link href={GUEST_PATH}>
              Explore dashboard <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
            </Link>
          </Button>
        </div>

        <ul className="mt-10 flex flex-wrap justify-center gap-4 text-sm text-blue-100">
          {CTA_HIGHLIGHTS.map((highlight) => (
            <li key={highlight} className="flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden />
              {highlight}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
