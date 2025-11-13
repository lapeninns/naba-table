import { Bot, CalendarCheck, CheckCircle2, Layers3, Sparkles } from "lucide-react";

import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import config from "@/config";
import { cn } from "@/lib/utils";

const HERO_STATS = [
  { label: "Self-serve guest bookings", value: "1 flow" },
  { label: "Team members you can invite", value: "Unlimited" },
  { label: "Time to update service hours", value: "<5 min" },
];

const FEATURE_COLUMNS = [
  {
    title: "Guest booking flow",
    description:
      "Guests reserve in a few clicks, receive confirmation emails automatically, and can edit or cancel without calling the host stand.",
    bullets: ["Responsive booking pages", "Email + dashboard confirmations", "Full booking CRUD"],
    icon: CalendarCheck,
  },
  {
    title: "Operations console",
    description:
      "Manage every reservation, assign tables, log walk-ins, and resolve issues from one screen built for front-of-house teams.",
    bullets: ["Live booking board", "Table + zone assignment", "Walk-in + hold tracking"],
    icon: Layers3,
  },
  {
    title: "Team & restaurant controls",
    description:
      "Onboard staff, configure opening and closing hours, and keep tables, zones, and guest settings in sync across locations.",
    bullets: ["Team roles & invitations", "Hours + service config", "Customer directory"],
    icon: Bot,
  },
];

const PLAYBOOK_STEPS = [
  {
    title: "Set up booking surfaces",
    content: "Connect the hosted booking page or embed it on your site so guests can reserve without calling.",
  },
  {
    title: "Configure tables & hours",
    content: "Define tables, zones, opening hours, and close-outs once—every reservation follows the same rules.",
  },
  {
    title: "Invite the ops team",
    content: "Add hosts, managers, and owners with the right permissions so everyone can edit bookings confidently.",
  },
  {
    title: "Run service with one console",
    content: "Track walk-ins, update bookings, message guests via email, and assign tables as the night evolves.",
  },
];

const AUTOMATION_CARDS = [
  {
    title: "Central booking board",
    description: "Filter by status, edit guest counts, and keep every reservation in sync with a couple of clicks.",
    details: ["Search + filters", "Full booking history", "Email confirmations"],
  },
  {
    title: "Table & zone controls",
    description: "Drag parties between tables, mark sections closed, and keep walk-ins lined up next to confirmed covers.",
    details: ["Table + zone management", "Walk-in + hold queue", "Service notes"],
  },
  {
    title: "Customer directory",
    description: "Look up guest contact info, record preferences, and follow up after service via email or phone.",
    details: ["Customer list", "Email + phone details", "Profile notes"],
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
                Capture bookings online, confirm them automatically, and hand every reservation to the team that seats your guests.
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
          <h2 className="text-balance text-3xl font-semibold md:text-4xl text-slate-900">Give your team everything they need to run service</h2>
          <p className="mx-auto max-w-3xl text-muted-foreground">
            The same booking board powers walk-ins, table assignments, customer lookup, and follow-ups—no extra tools or spreadsheets.
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
          <h2 className="text-balance text-3xl font-semibold md:text-4xl text-slate-900">Run bookings end-to-end with one tool</h2>
          <p className="text-base text-muted-foreground md:max-w-3xl">
            Sign in to the operations console if you already have credentials, or email partnerships at {supportEmail}. We will help you move bookings over, configure tables, and train the team.
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
