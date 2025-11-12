import type { Metadata } from "next";

import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import config from "@/config";

const PRODUCT_SECTIONS = [
  {
    id: "capture",
    title: "Capture",
    headline: "Turn every owned channel into a booking magnet",
    description:
      "Widgets, QR codes, concierge deep links, and calendar embeds all respect the same pacing logic so covers never collide.",
    bullets: ["No-code embeds for your website", "QR + NFC ready host tools", "Concierge & hotel partner deep links"],
  },
  {
    id: "operate",
    title: "Operate",
    headline: "One console for the entire front-of-house",
    description:
      "Hosts, sommeliers, and managers share the same context—from seating plans to service notes and live guest messaging.",
    bullets: ["Role-based dashboards", "Floor-aware table swaps", "Audit log of every change"],
  },
  {
    id: "communicate",
    title: "Communicate",
    headline: "Conversations that feel bespoke at scale",
    description:
      "Keep SMS and email threads inside the console. Confirmations, reminders, and upsells go out automatically with your tone.",
    bullets: ["Journey templates", "Two-way SMS + email", "Allergy & VIP context"],
  },
  {
    id: "service-match",
    title: "Service Match",
    headline: "Software that respects how you serve",
    description:
      "Pair pacing rules with prep stations, tasting menus, and walk-in policies so the product feels like your floor plan, not ours.",
    bullets: ["Multiple service periods", "Prep-station throttles", "Walk-in + waitlist merge"],
  },
  {
    id: "guest-ownership",
    title: "Guest Ownership",
    headline: "Every signal belongs to you",
    description:
      "Own the guest relationship end-to-end. Export data nightly, trigger loyalty campaigns, and give finance receipts that make sense.",
    bullets: ["Warehouse-ready exports", "Channel attribution", "Spend + visit history"],
  },
];

export const metadata: Metadata = {
  title: `${config.appName} · Product for restaurant operators`,
  description: "Unified booking, table management, and guest messaging built for restaurant owners.",
};

export default function ProductPage() {
  return (
    <main className="space-y-16 bg-background text-foreground">
      <section className="border-b border-border bg-gradient-to-b from-white via-slate-50 to-white px-6 py-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 text-center">
          <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-[0.3em]">
            Product
          </Badge>
          <h1 className="text-balance text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
            Replace marketplace fatigue with an operator-grade console.
          </h1>
          <p className="text-lg text-muted-foreground">
            SajiloReserveX unifies every tool your FOH team touches so you can capture, operate, communicate, and measure without sharing guests.
          </p>
          <div className="mx-auto">
            <MarketingSessionActions
              mode="restaurant"
              size="lg"
              primaryVariant="default"
              secondaryVariant="outline"
              className="[&>a]:w-full sm:[&>a]:w-auto"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6">
        {PRODUCT_SECTIONS.map((section) => (
          <Card key={section.id} id={section.id} className="border-border bg-white">
            <CardHeader className="space-y-3">
              <Badge variant="outline" className="w-fit border-border text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {section.title}
              </Badge>
              <CardTitle className="text-2xl font-semibold text-slate-900">{section.headline}</CardTitle>
              <CardDescription className="text-muted-foreground">{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                {section.bullets.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary/60" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl border border-border bg-white px-8 py-12 shadow-[0_45px_90px_-45px_rgba(15,23,42,0.35)]">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.2em]">
            Next steps
          </Badge>
          <h2 className="text-balance text-3xl font-semibold md:text-4xl text-slate-900">Put the console in the hands of your best host</h2>
          <p className="text-muted-foreground">
            Sign in to the ops console or loop partnerships in for a walkthrough. We’ll configure journeys, pacing, and access controls with you.
          </p>
          <div className="max-w-md">
            <MarketingSessionActions
              mode="restaurant"
              size="lg"
              primaryVariant="default"
              secondaryVariant="outline"
              className="[&>a]:w-full"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
