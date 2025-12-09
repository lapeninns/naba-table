import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Layers,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const BOOKING_PATH = "/restaurants";
const SIGN_IN_PATH = "/auth/signin";
const BOOKINGS_PATH = "/guest/bookings";

const STATS = [
  { label: "Avg. confirmation", value: "2.4s", detail: "from tap to ticket" },
  { label: "Guests seated", value: "92%", detail: "during peak slots" },
  { label: "NPS", value: "+72", detail: "rolling 30 days" },
];

const LIVE_SLOTS = [
  { guest: "Ava", time: "7:30 PM • Tonight", status: "Confirmed" },
  { guest: "Mateo", time: "8:00 PM • Tonight", status: "Pending" },
  { guest: "Noah", time: "6:45 PM • Tomorrow", status: "Confirmed" },
];

const STEPS = [
  { title: "Pick a spot", copy: "Filter by vibe, city, or capacity in seconds.", icon: MapPin },
  { title: "Lock it in", copy: "Real-time inventory with inline validation.", icon: CheckCircle2 },
  { title: "Stay synced", copy: "Receipts, calendar add, and live status updates.", icon: Sparkles },
];

const BENEFITS = [
  { title: "No guesswork", copy: "Clarity-first UI, consistent tokens, and obvious CTAs.", icon: Layers },
  { title: "Trusted surface", copy: "Secure links, WCAG focus states, and keyboard support.", icon: Lock },
  { title: "Fast paths", copy: "Pre-filled details for return guests; no app install required.", icon: Clock3 },
];

export function HomeHeroSection() {
  return (
    <section className="px-4 py-14 sm:px-6 lg:py-20" aria-labelledby="home-hero-heading">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Badge variant="secondary" className="w-fit rounded-full px-4 py-1 text-blue-900">
            Guest OS • Always on
          </Badge>
          <div className="space-y-3">
            <h1 id="home-hero-heading" className="heading-xl text-slate-900">
              Book a great table in under 10 seconds.
            </h1>
            <p className="text-body text-subtle">
              We watch live availability across curated venues so you can pick, confirm, and share faster—on the same
              interface guests use after sign-in.
            </p>
          </div>
          <div className="rounded-[var(--guest-radius-xl)] border-sem bg-elevated p-4 shadow-card">
            <form action={BOOKING_PATH} role="search" className="flex flex-col gap-3 md:flex-row" aria-label="Quick booking search">
              <div className="relative flex-1">
                <label className="sr-only" htmlFor="hero-search">
                  Search city or restaurant
                </label>
                <Input
                  id="hero-search"
                  name="hero-search"
                  type="search"
                  placeholder="Search by restaurant, city, or vibe"
                  className="input-base h-12 rounded-[var(--guest-radius-lg)] pl-12"
                />
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
              </div>
              <Button type="submit" size="lg" className="h-12 rounded-[var(--guest-radius-lg)] text-base" asChild>
                <Link href={BOOKING_PATH}>
                  <CalendarCheck className="mr-2 h-5 w-5" aria-hidden />
                  Find a table
                </Link>
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-subtle">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden />
                Instant confirmation, synced everywhere.
              </span>
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
                No app download required.
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" className="rounded-full px-6" asChild>
              <Link href={BOOKING_PATH}>Start booking</Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full px-6" asChild>
              <Link href={BOOKINGS_PATH}>View my bookings</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-blue-700" asChild>
              <Link href={SIGN_IN_PATH}>Sign in</Link>
            </Button>
          </div>
        </div>

        <Card className="flex flex-col gap-5 rounded-[var(--guest-radius-2xl)] border-sem bg-elevated p-6 shadow-card">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-subtle">Live board</p>
              <p className="text-lg font-semibold text-slate-900">Tonight&apos;s flow</p>
            </div>
            <Badge className="rounded-full bg-blue-50 text-blue-700">Open</Badge>
          </header>
          <div className="grid grid-cols-3 gap-3 rounded-[var(--guest-radius-lg)] bg-muted p-3">
            {STATS.map((stat) => (
              <div key={stat.label} className="rounded-[var(--guest-radius-md)] bg-white/70 p-3 text-left shadow-card">
                <p className="text-xs uppercase tracking-wide text-subtle">{stat.label}</p>
                <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
                <p className="text-xs text-subtle">{stat.detail}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[var(--guest-radius-lg)] border-sem bg-white/80 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Incoming guests</p>
              <Button variant="ghost" size="sm" className="text-blue-700" asChild>
                <Link href={BOOKING_PATH}>See availability</Link>
              </Button>
            </div>
            <ul className="mt-4 space-y-3" aria-label="Sample bookings">
              {LIVE_SLOTS.map((slot) => (
                <li key={slot.guest + slot.time} className="flex items-center justify-between rounded-[var(--guest-radius-md)] border-sem px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{slot.guest}</p>
                    <p className="text-xs text-subtle">{slot.time}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full px-3 py-1 text-xs",
                      slot.status === "Confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {slot.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </section>
  );
}

export function HomeMetricsSection() {
  return (
    <section className="px-4 py-12 sm:px-6" aria-labelledby="home-metrics-heading">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-3 text-center">
          <Badge variant="secondary" className="mx-auto w-fit rounded-full px-4 py-1 text-blue-900">
            Proof in motion
          </Badge>
          <h2 id="home-metrics-heading" className="heading-lg font-semibold text-slate-900">
            A guest flow that converts quickly
          </h2>
          <p className="text-body text-subtle">Borrowed from our live dashboard—clear spacing, strong CTAs, and zero surprises.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {STATS.map((stat) => (
            <article key={stat.label} className="rounded-[var(--guest-radius-xl)] border-sem bg-elevated p-5 shadow-card">
              <p className="text-sm text-subtle">{stat.label}</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{stat.value}</p>
              <p className="text-sm text-subtle">{stat.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeJourneySection() {
  return (
    <section className="px-4 py-14 sm:px-6" aria-labelledby="home-journey-heading">
      <div className="mx-auto max-w-6xl rounded-[var(--guest-radius-2xl)] border-sem bg-elevated p-6 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-subtle">How it works</p>
            <h2 id="home-journey-heading" className="heading-lg font-semibold text-slate-900">
              Three steps, all on-brand
            </h2>
            <p className="text-body text-subtle">Same tokens and focus states across search, booking, and receipt.</p>
          </div>
          <Badge className="rounded-full bg-blue-50 text-blue-700">Built with our design system</Badge>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <article key={step.title} className="rounded-[var(--guest-radius-lg)] border-sem bg-white/90 p-4 shadow-card">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <step.icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-xs uppercase tracking-wide text-subtle">Step {index + 1}</p>
              </div>
              <p className="mt-3 text-lg font-semibold text-slate-900">{step.title}</p>
              <p className="text-sm text-subtle">{step.copy}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {BENEFITS.map((item) => (
            <article key={item.title} className="rounded-[var(--guest-radius-lg)] border-sem bg-muted p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-700 shadow-card">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              </div>
              <p className="mt-2 text-sm text-subtle">{item.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeCTASection() {
  return (
    <section className="px-4 pb-20 pt-10 sm:px-6" aria-labelledby="home-cta-heading">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[calc(var(--guest-radius-2xl)*1.2)] border border-blue-100 bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 px-6 py-12 text-white shadow-card">
        <div className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-100">Ready state</p>
          <h2 id="home-cta-heading" className="heading-lg text-white">
            Launch the guest flow in minutes
          </h2>
          <p className="text-base text-blue-100">Pre-styled inputs, cards, and CTAs—already aligned to the live experience.</p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" variant="secondary" className="h-14 rounded-full px-8 text-lg font-semibold text-blue-700" asChild>
            <Link href={BOOKING_PATH}>
              Start booking
              <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-14 rounded-full border-white/40 px-8 text-lg text-white hover:bg-white/10" asChild>
            <Link href={BOOKINGS_PATH}>View my bookings</Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-3 text-center text-sm text-blue-100 sm:grid-cols-3">
          <span className="inline-flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" aria-hidden /> No app download
          </span>
          <span className="inline-flex items-center justify-center gap-2">
            <CalendarCheck className="h-4 w-4" aria-hidden /> Calendar-ready receipts
          </span>
          <span className="inline-flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Secure share links
          </span>
        </div>
      </div>
    </section>
  );
}
