import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

import ButtonSignin from "@/components/ButtonSignin";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/reserve", label: "Reservations" },
  { href: "/dashboard", label: "Operations" },
  { href: "/profile/manage", label: "Guest profiles" },
];

const metrics = [
  { value: "98%", label: "Guest satisfaction", description: "Post-visit survey average" },
  { value: "24%", label: "Fewer no-shows", description: "Automated reminders & confirmations" },
  { value: "12k", label: "Monthly bookings", description: "Managed across every location" },
  { value: "< 2m", label: "Average response", description: "To confirm or adjust a reservation" },
];

const workflowSteps = [
  {
    title: "Capture every detail",
    description: "Log guest preferences, allergy notes, and party specifics in a single guided flow.",
  },
  {
    title: "Stay in sync in real time",
    description: "Staff get instant status updates and smart alerts whenever timelines change.",
  },
  {
    title: "Delight guests automatically",
    description: "Personalized confirmations and reminder texts go out without your team lifting a finger.",
  },
];

const features = [
  {
    title: "Shift-aware scheduling",
    description: "Block covers, set pacing goals, and watch capacity fill in real time with predictive insights.",
    icon: CalendarCheck,
  },
  {
    title: "360° guest history",
    description: "Never miss a VIP preference again with unified visit notes and loyalty context.",
    icon: Users,
  },
  {
    title: "Automated safeguards",
    description: "Trust double-booking protection and configurable approvals for large parties.",
    icon: ShieldCheck,
  },
  {
    title: "Revenue intelligence",
    description: "Spot spend trends, popular seating zones, and high-value segments instantly.",
    icon: BarChart3,
  },
  {
    title: "Seamless integrations",
    description: "Connect POS, messaging, and loyalty platforms without custom setup work.",
    icon: Sparkles,
  },
  {
    title: "Actionable analytics",
    description: "Daily insights highlight bottlenecks so you can respond before the rush hits.",
    icon: ArrowRight,
  },
];

const testimonial = {
  quote:
    "“SajiloReserveX gives our entire hospitality team one source of truth. Capacity planning used to be guesswork—now we glide through peak hours.”",
  name: "Sujata Sharma",
  role: "Director of Guest Experience, Horizon Hotels",
};

export default function Page() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-90">
        <div className="absolute inset-0 bg-[radial-gradient(140%_120%_at_0%_0%,hsl(var(--primary)/0.12),transparent_65%),radial-gradient(120%_100%_at_100%_10%,hsl(var(--accent-foreground)/0.08),transparent_70%),linear-gradient(180deg,hsl(var(--background)),color-mix(in_srgb,hsl(var(--background))_88%,hsl(var(--accent)/0.12)))]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background via-background/70 to-transparent" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-3 text-base font-semibold tracking-tight text-foreground">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              SRX
            </span>
            SajiloReserveX
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-8 text-sm font-medium md:flex">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ButtonSignin text="Sign in" />
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/80 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-20 md:pb-28 md:pt-28">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
            <div className="space-y-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground backdrop-blur">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Hospitality CRM
              </span>
              <div className="space-y-6">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Turn every reservation into a returning guest
                </h1>
                <p className="max-w-xl text-lg text-muted-foreground sm:text-xl">
                  Orchestrate front-of-house, kitchen, and guest communications from one modern command center. SajiloReserveX brings clarity to the rush so your team can stay composed.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/reserve"
                  className={cn(
                    buttonVariants({ variant: "primary", size: "primary" }),
                    "group flex w-full items-center justify-center gap-2 sm:w-auto"
                  )}
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "primary" }),
                    "w-full border-border/60 bg-background/60 text-foreground backdrop-blur sm:w-auto"
                  )}
                >
                  Watch 2-min overview
                </Link>
              </div>

              <ul className="flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center">
                <li className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                  No credit card required
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                  Cancel anytime
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                  Concierge onboarding included
                </li>
              </ul>
            </div>

            <div className="relative">
              <div className="absolute -top-20 right-0 h-64 w-64 rounded-full bg-primary/15 blur-3xl" aria-hidden />
              <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg backdrop-blur">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                      Live occupancy
                    </p>
                    <p className="mt-3 text-4xl font-semibold text-foreground">82%</p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Peak hours
                  </span>
                </div>

                <div className="mt-8 space-y-4">
                  {["Table 8 · Garden", "Table 3 · Chef's counter", "Private dining · Skyline"].map((label, index) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4 text-sm text-foreground"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{label}</p>
                        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                          {index === 0 ? "Seated" : index === 1 ? "Arriving" : "Confirming"}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {index === 0 ? "Started 5m ago" : index === 1 ? "ETA 6m" : "Reply pending"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-background/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                    Next to seat
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">Riya K. · Party of 4</p>
                      <p className="text-sm text-muted-foreground">Window seating · Anniversary</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      Arriving in 8m
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 md:pb-24" aria-label="Key metrics">
          <div className="grid gap-6 rounded-3xl border border-border/60 bg-background/70 p-6 backdrop-blur sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="space-y-2">
                <p className="text-3xl font-semibold text-foreground">{metric.value}</p>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="text-sm text-muted-foreground">{metric.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:pb-28"
          aria-labelledby="workflow-heading"
        >
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                Reliable operations
              </span>
              <h2 id="workflow-heading" className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Coordinate every shift with clarity
              </h2>
              <p className="text-lg text-muted-foreground">
                Give hosts, managers, and service leads the same up-to-the-minute picture. SajiloReserveX adapts to the pace of your dining room so your team can move with confidence.
              </p>
            </div>

            <div className="space-y-6">
              {workflowSteps.map((step) => (
                <div key={step.title} className="rounded-2xl border border-border/60 bg-background/70 p-5">
                  <p className="text-base font-semibold text-foreground">{step.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>

            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:underline"
            >
              Explore the operations guide
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Tonight's pacing
              </p>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Updated 2m ago
              </span>
            </div>

            <ul className="mt-6 space-y-5">
              {[
                { label: "Pre-service briefing", time: "3:30 PM", status: "Completed" },
                { label: "First seating", time: "5:00 PM", status: "On track" },
                { label: "Large party arrival", time: "7:15 PM", status: "Prep underway" },
              ].map((item) => (
                <li
                  key={item.label}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-background/60 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-background/70 p-5">
              <p className="text-sm font-semibold text-foreground">Shift insights</p>
              <p className="mt-2 text-sm text-muted-foreground">
                12 VIPs flagged · 4 allergy notes · Goal pacing at 92% capacity
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20 md:pb-28" aria-labelledby="features-heading">
          <div className="mx-auto max-w-3xl text-center">
            <h2 id="features-heading" className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Built for seamless hospitality teamwork
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Intuitive tools help your staff focus on guests—not juggling tablets. Every workflow is designed with service in mind.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-3xl border border-border/60 bg-background/70 p-6 transition-shadow hover:shadow-lg"
                >
                  <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-lg font-semibold text-foreground">{feature.title}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{feature.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                    Learn more
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20 md:pb-28" aria-labelledby="testimonial-heading">
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-8 shadow-lg backdrop-blur md:p-12">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
              <div className="relative flex-1 space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Trusted by teams worldwide
                </span>
                <p id="testimonial-heading" className="text-2xl font-semibold leading-snug text-foreground sm:text-3xl">
                  {testimonial.quote}
                </p>
                <div>
                  <p className="text-base font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-6 rounded-3xl border border-dashed border-border/70 bg-background/60 p-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Operational wins this quarter</p>
                  <p className="text-sm text-muted-foreground">
                    17% increase in returning guests · 12 hrs saved weekly on manual confirmations · Team NPS 68 → 82
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {["Staff collaboration", "Guest feedback", "Data visibility", "Training speed"].map((label) => (
                    <div key={label} className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
                      <p className="font-semibold text-foreground">{label}</p>
                      <p className="mt-1 text-muted-foreground">Improved</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24 md:pb-32" aria-labelledby="cta-heading">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-r from-primary/90 via-primary/80 to-primary/60 p-8 shadow-lg md:p-12">
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(120%_120%_at_30%_50%,hsl(var(--primary-foreground)/0.2),transparent)] opacity-70" aria-hidden />
            <div className="relative grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-center">
              <div className="space-y-4 text-primary-foreground">
                <h2 id="cta-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Ready to orchestrate every guest experience?
                </h2>
                <p className="text-lg opacity-90">
                  Schedule a guided walkthrough to see how SajiloReserveX adapts to your floor plan, peak hours, and guest cadence.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Link
                  href="/reserve"
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "primary" }),
                    "w-full justify-center bg-primary-foreground text-primary sm:w-auto"
                  )}
                >
                  Book a live demo
                </Link>
                <Link
                  href="/contact"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "primary" }),
                    "w-full justify-center border border-primary-foreground/30 bg-primary/10 text-primary-foreground backdrop-blur sm:w-auto"
                  )}
                >
                  Talk to sales
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/70">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-4">
              <Link href="/" className="flex items-center gap-3 text-base font-semibold tracking-tight text-foreground">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  SRX
                </span>
                SajiloReserveX
              </Link>
              <p className="max-w-md text-sm text-muted-foreground">
                End-to-end reservation intelligence for modern hospitality teams. Give guests a seamless journey from booking to repeat visits.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Product</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    { label: "Platform", href: "/dashboard" },
                    { label: "Mobile app", href: "/mobile" },
                    { label: "Pricing", href: "/pricing" },
                    { label: "Status", href: "/status" },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="transition-colors hover:text-foreground">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Company</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    { label: "About", href: "/about" },
                    { label: "Careers", href: "/careers" },
                    { label: "Press", href: "/press" },
                    { label: "Support", href: "/support" },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="transition-colors hover:text-foreground">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} SajiloReserveX. All rights reserved.</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">
                Terms
              </Link>
              <Link href="/contact" className="transition-colors hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
