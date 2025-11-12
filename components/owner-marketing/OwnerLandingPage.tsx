import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import config from "@/config";
import { cn } from "@/lib/utils";
import { Bot, CalendarCheck, CheckCircle2, Layers3, Sparkles } from "lucide-react";

const HERO_STATS = [
  { label: "Lift in direct covers", value: "+38%" },
  { label: "Ops messages auto-resolved", value: "78%" },
  { label: "Time to clear waitlist", value: "−12 min" },
];

const FEATURE_COLUMNS = [
  {
    title: "Bookings that convert",
    description:
      "Embed widgets, sync QR codes, and give concierge partners deep links that all honor the same pacing logic.",
    bullets: ["Real-time seat inventory", "Service pacing & blackout windows", "Auto-confirm + reminders"],
    icon: CalendarCheck,
  },
  {
    title: "Table management that adapts",
    description:
      "Hosts share the same living floor map as managers, so swaps, splits, and walk-ins stay aligned.",
    bullets: ["Role-based dashboards", "Walk-in & waitlist merge", "Shift notes + audits"],
    icon: Layers3,
  },
  {
    title: "Automation without losing the guest",
    description:
      "Journeys keep your tone while handling confirmations, reminders, and upsells inside one thread.",
    bullets: ["Journey templates", "SMS + email together", "Open + upsell reporting"],
    icon: Bot,
  },
];

const PLAYBOOK_STEPS = [
  {
    title: "Import your service DNA",
    content:
      "Map covers, turn-times, and overbooking tolerances in under 30 minutes with success engineering.",
  },
  {
    title: "Instrument every touchpoint",
    content: "Drop booking widgets anywhere, mirror menus, and pin deep links without adding another login.",
  },
  {
    title: "Coach the team once",
    content: "Hosts, sommeliers, and managers get role-based dashboards so everyone shares context at the rush.",
  },
  {
    title: "Measure what matters",
    content: "Daily summaries highlight pacing deltas, at-risk covers, and which journeys filled the book.",
  },
];

const AUTOMATION_CARDS = [
  {
    title: "Service pacing autopilot",
    description: "Hold or release seats automatically based on kitchen load and live wait times.",
    details: ["Dynamic throttle rules", "Floor-aware recommendations", "Manager approvals"],
  },
  {
    title: "Guest ownership",
    description: "Keep every message, allergy, and spend note tied to your brand and export it nightly.",
    details: ["Unified comms thread", "Allergy + VIP alerts", "Warehouse-ready exports"],
  },
  {
    title: "Ops-grade analytics",
    description: "See which channels fill the book and share cover pacing summaries with finance in seconds.",
    details: ["Channel attribution", "Shift retros", "Cover pacing forecasts"],
  },
];

export function OwnerLandingPage() {
  const supportEmail = config.email?.supportEmail ?? "support@example.com";

  return (
    <div className="bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-white via-slate-50 to-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-20 lg:flex-row lg:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-primary/70">
              <Badge variant="outline" className="border-border text-xs uppercase tracking-[0.3em] text-primary/70">
                Owners
              </Badge>
              <span className="text-muted-foreground">Bookings · Pacing · Automation</span>
            </div>
            <div className="space-y-4">
              <h1 className="text-balance text-4xl font-semibold leading-tight text-slate-900 md:text-5xl lg:text-6xl">
                Turn your website into a shameless booking engine.
              </h1>
              <p className="text-lg text-muted-foreground md:text-xl">
                Route every direct visit, QR scan, and concierge request into a console your hosts actually love.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <MarketingSessionActions
                mode="restaurant"
                size="lg"
                primaryVariant="default"
                secondaryVariant="outline"
                className="[&>a]:w-full sm:[&>a]:w-auto"
              />
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Live in 10 days · Humans on support</p>
            </div>
          </div>
          <div className="grid flex-1 gap-4 rounded-3xl border border-border bg-white p-6 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.45)] md:grid-cols-3 lg:flex lg:flex-col">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-slate-50 p-5">
                <p className="text-4xl font-semibold text-slate-900">{stat.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white" />
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20">
        <div className="space-y-3 text-center">
          <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-[0.25em]">
            Why operators switch
          </Badge>
          <h2 className="text-balance text-3xl font-semibold md:text-4xl text-slate-900">Every direct channel in one console</h2>
          <p className="mx-auto max-w-3xl text-muted-foreground">
            Keep the revenue you create. SajiloReserveX connects your owned channels with live pacing intelligence so no seat is wasted.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURE_COLUMNS.map((feature) => (
            <Card key={feature.title} className="h-full border-border bg-white">
              <CardHeader className="space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted">
                  <feature.icon className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <CardTitle className="text-xl text-foreground">{feature.title}</CardTitle>
                <CardDescription className="text-muted-foreground">{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 lg:flex-row lg:items-center">
          <div className="space-y-4 lg:w-1/2">
            <Badge variant="outline" className="w-fit border-border text-xs uppercase tracking-[0.25em] text-primary/70">
              Go live playbook
            </Badge>
            <h2 className="text-balance text-3xl font-semibold md:text-4xl text-slate-900">From intake to the first Friday double turn</h2>
            <p className="text-muted-foreground">
              Success engineers sit in your service, capture rituals, and translate them into rules you can tweak later.
            </p>
          </div>
          <ol className="grid flex-1 gap-6 md:grid-cols-2">
            {PLAYBOOK_STEPS.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 text-primary">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-base font-semibold">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{step.content}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20">
        <div className="space-y-3 text-center">
          <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-[0.25em]">
            Console superpowers
          </Badge>
          <h2 className="text-balance text-3xl font-semibold md:text-4xl text-slate-900">Give your team context before they greet</h2>
          <p className="mx-auto max-w-3xl text-muted-foreground">
            Hosts, sommeliers, and managers finally share the same reality—one thread for guests, one timeline for pacing, and receipts to prove what happened.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {AUTOMATION_CARDS.map((card) => (
            <Card
              key={card.title}
              className="h-full border-border bg-gradient-to-br from-white via-slate-50 to-slate-100"
            >
              <CardHeader className="space-y-3">
                <CardTitle className="text-lg font-semibold text-slate-900">{card.title}</CardTitle>
                <CardDescription className="text-muted-foreground">{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {card.details.map((detail) => (
                    <li key={detail} className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl border border-border bg-white px-8 py-12 shadow-[0_45px_90px_-40px_rgba(15,23,42,0.35)]">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.2em]">
            Ready when you are
          </Badge>
          <h2 className="text-balance text-3xl font-semibold md:text-4xl text-slate-900">Take back your guest relationship</h2>
          <p className="text-base text-muted-foreground md:max-w-3xl">
            Sign in to the operations console if you already have credentials, or email partnerships at {supportEmail}. We will map your floor, import reservations, and run the first double turn with you.
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <MarketingSessionActions
              mode="restaurant"
              size="lg"
              primaryVariant="default"
              secondaryVariant="outline"
              className="w-full md:w-auto [&>a]:w-full md:[&>a]:w-auto"
            />
            <a
              href={`mailto:${supportEmail}`}
              className={cn(
                "inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition hover:bg-muted",
              )}
            >
              Email partnerships
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
