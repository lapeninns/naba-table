import {
  AlarmCheck,
  ArrowRight,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Layers,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Timer,
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
const PRIMARY_REGION = "Cambridgeshire, Norfolk and Bedfordshire";
const BRAND_NAME = "Nab a Table";

const METRICS = [
  { label: "Avg. confirmation", value: "2.4s", detail: "from tap to ticket" },
  { label: "Guests seated on time", value: "92%", detail: "during peak slots" },
  { label: "NPS", value: "+72", detail: "last 30 days" },
];

const HIGHLIGHTS = [
  { title: "Real-time openings", copy: "See live openings across curated venues in our region.", icon: BellRing },
  { title: "Guest-ready flow", copy: "Same booking steps before and after sign-in—no relearning.", icon: Sparkles },
  { title: "Instant receipts", copy: "Calendar files and share links ship with every booking.", icon: AlarmCheck },
];

const STEPS = [
  { title: "Pick a spot", copy: "Search by restaurant, city, or ambience. See live capacity and Instant confirm badges.", icon: MapPin },
  { title: "Lock it in", copy: "One simple booking flow with inline checks, secure steps, and instant status.", icon: CheckCircle2 },
  { title: "Stay synced", copy: "Receipt with calendar file and shareable link. View or change it anytime in My Bookings.", icon: Sparkles },
];

const PROMISES = [
  { title: "No surprises", copy: "What you see before booking matches your confirmation and receipt.", icon: Layers },
  { title: "Secure & accessible", copy: "Keyboard-friendly, visible focus, secure share links.", icon: Lock },
  { title: "Fast for returners", copy: "Prefilled details for signed-in guests; no app download required.", icon: Clock3 },
];

const LOCAL_VENUES = [
  "The Barley Mow Pub — Hartford, near Huntingdon, Cambridgeshire",
  "The Queen Elizabeth Pub — King’s Lynn, Norfolk",
  "Prince of Wales Pub — Bromham, near Bedford, Bedfordshire",
  "White Horse Pub — Waterbeach, Cambridgeshire",
  "The Corner House Pub — Cambridge, Cambridgeshire",
  "Old Crown Pub — Girton, Cambridgeshire",
  "The Bell — Sawtry, Cambridgeshire",
  "The Railway Pub — Whittlesey, Cambridgeshire",
];

const LIVE_FEED = LOCAL_VENUES.slice(0, 6).map((venue, idx) => {
  const times = ["6:45 PM · tonight", "7:10 PM · tonight", "7:45 PM · tonight", "12:30 PM · tomorrow", "8:05 PM · tonight", "1:00 PM · tomorrow"];
  const parties = ["Table for 2", "Party of 4", "Table for 3", "Lunch for 2", "Table for 5", "Brunch for 3"];
  const statuses = ["Confirmed", "Pending", "Confirmed", "Confirmed", "Pending", "Confirmed"];
  return {
    venue,
    time: times[idx % times.length],
    party: parties[idx % parties.length],
    status: statuses[idx % statuses.length],
  };
});

const TRUST_PILLS = ["Instant confirmation", "Calendar-ready receipts"];

type HomeHeroSectionProps = {
  isAuthenticated?: boolean;
};

export function HomeHeroSection({ isAuthenticated = false }: HomeHeroSectionProps) {
  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:py-18" aria-labelledby="home-hero-heading">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left column */}
        <div className="space-y-6 rounded-[var(--guest-radius-2xl)] border-sem bg-white/90 p-6 shadow-card">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-subtle">
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-blue-800">Live availability</span>
            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">{PRIMARY_REGION}</span>
          </div>
          <div className="space-y-3">
            <h1 id="home-hero-heading" className="heading-xl text-slate-900">
              Book great restaurants in seconds.
            </h1>
            <p className="text-body text-subtle">See curated openings nearby, lock a table, and keep the receipt synced.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
            <form
              action={BOOKING_PATH}
              role="search"
              className="flex flex-col gap-3 rounded-[var(--guest-radius-xl)] border-sem bg-elevated p-4 shadow-card"
              aria-label="Quick booking search"
            >
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
              <div className="flex flex-wrap gap-2 text-xs text-subtle">
                {TRUST_PILLS.map((pill) => (
                  <span
                    key={pill}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1 text-blue-800"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    {pill}
                  </span>
                ))}
              </div>
            </form>
            <Card className="flex flex-col justify-between rounded-[var(--guest-radius-xl)] border-blue-100 bg-gradient-to-br from-blue-600/90 via-blue-500/90 to-blue-700/90 p-5 text-white shadow-card">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.24em] text-blue-100">Instant confirm</p>
                <p className="text-lg font-semibold">See what’s open now</p>
                <HeroIllustration />
                <p className="text-sm text-blue-100">Built for fast booking and clear receipts.</p>
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="rounded-full px-6 bg-primary text-white shadow-card transition-colors hover:bg-primary/90"
              asChild
            >
              <Link href={BOOKING_PATH}>Find a table</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-6 border-blue-200 bg-white text-blue-700 transition-colors hover:border-blue-500 hover:bg-blue-50"
              asChild
            >
              <Link href={BOOKINGS_PATH}>View my bookings</Link>
            </Button>
            {!isAuthenticated ? (
              <Button variant="ghost" size="sm" className="text-blue-700 hover:text-blue-800" asChild>
                <Link href={SIGN_IN_PATH}>Sign in</Link>
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-subtle">Trusted by local favourites across {PRIMARY_REGION}.</p>
        </div>

        {/* Right column */}
        <div className="grid gap-4">
          <Card className="rounded-[var(--guest-radius-2xl)] border-sem bg-elevated p-6 shadow-card">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-subtle">Live snapshot</p>
                <p className="text-lg font-semibold text-slate-900">Fast, reliable, ready</p>
              </div>
              <Badge className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700">
                <Timer className="h-4 w-4" aria-hidden />
                2.4s avg
              </Badge>
            </header>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {METRICS.map((stat) => (
                <div key={stat.label} className="rounded-[var(--guest-radius-md)] bg-white/90 p-4 text-left shadow-card">
                  <p className="text-xs uppercase tracking-wide text-subtle">{stat.label}</p>
                  <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-subtle">{stat.detail}</p>
                </div>
              )).slice(0, 3)}
            </div>
          </Card>

          <div className="rounded-[var(--guest-radius-2xl)] border-sem bg-white/90 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Recent confirmations</p>
                <p className="text-xs text-subtle">Flowing through {BRAND_NAME}</p>
              </div>
            <Button variant="ghost" size="sm" className="text-blue-700" asChild>
              <Link href={BOOKING_PATH}>See availability</Link>
            </Button>
          </div>
            <ul className="mt-4 space-y-3" aria-label="Sample bookings">
              {LIVE_FEED.slice(0, 3).map((slot) => (
                <li
                  key={slot.venue + slot.time}
                  className="flex flex-col gap-1 rounded-[var(--guest-radius-md)] border-sem px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{slot.venue}</p>
                    <p className="text-xs text-subtle">
                      {slot.time} • {slot.party}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-fit rounded-full px-3 py-1 text-xs",
                      slot.status === "Confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {slot.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroIllustration() {
  return (
    <svg
      role="img"
      aria-label="Illustration of a reservation flow"
      className="h-36 w-full"
      viewBox="0 0 320 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="14" y="22" width="292" height="116" rx="18" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" />
      <rect x="32" y="40" width="120" height="24" rx="8" fill="var(--primary)" opacity="0.9" />
      <rect x="32" y="72" width="88" height="16" rx="6" fill="rgba(255,255,255,0.65)" />
      <rect x="32" y="96" width="140" height="14" rx="6" fill="rgba(255,255,255,0.35)" />
      <rect x="172" y="46" width="64" height="12" rx="6" fill="rgba(255,255,255,0.55)" />
      <rect x="172" y="68" width="104" height="38" rx="10" fill="rgba(255,255,255,0.2)" />
      <rect x="184" y="78" width="56" height="10" rx="5" fill="var(--primary)" opacity="0.9" />
      <rect x="184" y="94" width="72" height="8" rx="4" fill="rgba(255,255,255,0.55)" />
      <circle cx="270" cy="86" r="10" fill="var(--primary)" opacity="0.9" />
      <path d="M266 86l3 3 6-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="212" y="112" width="72" height="12" rx="6" fill="rgba(255,255,255,0.3)" />
      <rect x="74" y="122" width="92" height="12" rx="6" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

export function HomeMetricsSection() {
  return (
    <section className="px-4 py-10 sm:px-6" aria-labelledby="home-metrics-heading">
      <div className="mx-auto max-w-6xl space-y-6 rounded-[var(--guest-radius-2xl)] border-sem bg-white/90 p-6 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit rounded-full px-4 py-1 text-blue-900">
              Real bookings, real results
            </Badge>
            <h2 id="home-metrics-heading" className="heading-lg font-semibold text-slate-900">
              Live statistics from recent guest bookings on {BRAND_NAME}.
            </h2>
            <p className="text-body text-subtle">
              The same metrics guests see inside the app—fast confirmations, high seat rate, and happy diners.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-subtle">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Live feed</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Peak reliability</span>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 sm:grid-cols-3">
            {METRICS.map((stat) => (
              <article key={stat.label} className="rounded-[var(--guest-radius-xl)] border-sem bg-elevated p-5 shadow-card">
                <p className="text-sm text-subtle">{stat.label}</p>
                <p className="mt-3 text-4xl font-semibold text-slate-900">{stat.value}</p>
                <p className="text-sm text-subtle">{stat.detail}</p>
              </article>
            ))}
          </div>
          <div className="space-y-3 rounded-[var(--guest-radius-xl)] border-sem bg-muted p-4 shadow-card">
            {HIGHLIGHTS.map((item) => (
              <article
                key={item.title}
                className="flex items-start gap-3 rounded-[var(--guest-radius-lg)] border border-white/60 bg-white/90 p-3 shadow-card"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-subtle">{item.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeTrustedSection() {
  return (
    <section className="px-4 py-12 sm:px-6" aria-labelledby="home-trusted-heading">
      <div className="mx-auto max-w-6xl space-y-6 rounded-[var(--guest-radius-2xl)] border-sem bg-elevated p-6 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-subtle">Trusted by local favourites</p>
            <h2 id="home-trusted-heading" className="heading-lg font-semibold text-slate-900">
              Trusted by pubs and restaurants across {PRIMARY_REGION}
            </h2>
            <p className="text-body text-subtle">
              {BRAND_NAME} already powers bookings for much-loved venues in our region.
            </p>
          </div>
          <Badge className="rounded-full bg-blue-50 text-blue-700">Instant confirm partners</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {LOCAL_VENUES.map((venue) => (
            <div
              key={venue}
              className="flex items-start gap-3 rounded-[var(--guest-radius-lg)] border-sem bg-white/90 p-4 shadow-card"
            >
              <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" aria-hidden />
              <p className="text-sm text-slate-800">{venue}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-subtle">
          Trusted by local favourites across {PRIMARY_REGION}
        </p>
      </div>
    </section>
  );
}

export function HomeJourneySection() {
  return (
    <section className="px-4 py-12 sm:px-6" aria-labelledby="home-journey-heading">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-3 rounded-[var(--guest-radius-2xl)] border-sem bg-elevated p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-subtle">How it works</p>
              <h2 id="home-journey-heading" className="heading-lg font-semibold text-slate-900">
                A clear path from search to seat
              </h2>
            </div>
            <Badge className="rounded-full bg-blue-50 text-blue-700">Design system aligned</Badge>
          </div>
          <p className="text-body text-subtle">
            One simple booking flow with the same tokens and focus states guests see after sign-in.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
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
        </div>

        <div className="space-y-3 rounded-[var(--guest-radius-2xl)] border-sem bg-muted p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-subtle">Why it’s trustworthy</p>
          <h3 className="heading-md font-semibold text-slate-900">Built to match confirmation & receipt views</h3>
          <div className="mt-3 space-y-3">
            {PROMISES.map((item) => (
              <article
                key={item.title}
                className="flex items-start gap-3 rounded-[var(--guest-radius-lg)] border border-white/60 bg-white/90 p-3 shadow-card"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-subtle">{item.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeCTASection() {
  return (
    <section className="px-4 pb-14 pt-8 sm:px-6" aria-labelledby="home-cta-heading">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[calc(var(--guest-radius-2xl)*1.2)] border border-blue-100 bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 px-6 py-10 text-white shadow-card">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-100">Ready state</p>
          <h2 id="home-cta-heading" className="heading-lg text-white">
            Ready to book your next table?
          </h2>
          <p className="text-base text-blue-100">
            Book from the same interface guests use after sign-in—pre-styled inputs, cards, and receipts.
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="h-12 rounded-full px-7 text-base font-semibold bg-white text-blue-700 shadow-card hover:bg-blue-50 hover:text-blue-800"
            asChild
          >
            <Link href={BOOKING_PATH}>
              Start booking
              <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
            </Link>
          </Button>
          <Button
            size="lg"
            className="h-12 rounded-full px-7 text-base font-semibold bg-white/15 text-white border border-white/40 hover:bg-white/25 hover:text-white"
            asChild
          >
            <Link href={BOOKINGS_PATH}>View my bookings</Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-3 text-center text-sm text-blue-100 sm:grid-cols-3">
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

export function HomeReceiptsSection() {
  return (
    <section className="px-4 py-10 sm:px-6" aria-labelledby="home-receipts-heading">
      <div className="mx-auto max-w-6xl grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4 rounded-[var(--guest-radius-2xl)] border-sem bg-elevated p-5 shadow-card">
          <Badge variant="secondary" className="w-fit rounded-full px-4 py-1 text-blue-900">
            Receipts & follow-up
          </Badge>
          <div className="space-y-2">
            <h2 id="home-receipts-heading" className="heading-lg font-semibold text-slate-900">
              Your receipt is ready as soon as you book
            </h2>
            <p className="text-body text-subtle">
              Get a calendar-ready file, a shareable link, and live status you can reopen from My Bookings or your email.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-[var(--guest-radius-lg)] border-sem bg-white/90 p-3 shadow-card">
              <CalendarCheck className="mt-0.5 h-5 w-5 text-blue-700" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Calendar-ready receipts</p>
                <p className="text-sm text-subtle">Add to calendar instantly and keep status in sync across devices.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[var(--guest-radius-lg)] border-sem bg-white/90 p-3 shadow-card">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Secure share links</p>
                <p className="text-sm text-subtle">Send a token link or sign in to view your receipt at /guest/bookings/[id]/receipt.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[var(--guest-radius-lg)] border-sem bg-white/90 p-3 shadow-card">
              <Clock3 className="mt-0.5 h-5 w-5 text-blue-700" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Always-on access</p>
                <p className="text-sm text-subtle">Check or update your status from My Bookings without re-learning the flow.</p>
              </div>
            </div>
          </div>
        </div>
        <Card className="relative flex h-full flex-col gap-3 overflow-hidden rounded-[var(--guest-radius-2xl)] border border-blue-100 bg-gradient-to-br from-blue-600/90 via-blue-500/90 to-blue-700/90 p-5 text-white shadow-card">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.28em] text-blue-100">Receipt preview</p>
            <h3 className="text-2xl font-semibold">Reservation confirmed</h3>
            <p className="text-sm text-blue-100">Calendar file • Share link • Live status</p>
          </div>
          <div className="rounded-[var(--guest-radius-lg)] border border-white/15 bg-white/10 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-100">Status</span>
              <Badge className="rounded-full bg-white text-blue-700">Confirmed</Badge>
            </div>
            <div className="mt-3 space-y-2 text-sm text-blue-50">
              <p>Party of 4 · Tonight · 7:30 PM</p>
              <p>Live sync to calendar + shareable link</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              size="lg"
              className="h-11 rounded-full bg-white text-blue-700 shadow-card hover:bg-blue-50 hover:text-blue-800"
              asChild
            >
              <Link href={BOOKINGS_PATH}>View my bookings</Link>
            </Button>
            <Button
              size="lg"
              className="h-11 rounded-full px-6 bg-white/20 text-white border border-white/40 hover:bg-white/25 hover:text-white"
              asChild
            >
              <Link href={BOOKING_PATH}>Start booking</Link>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
