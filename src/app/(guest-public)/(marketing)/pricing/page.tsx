import type { Metadata } from "next";

import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import config from "@/config";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$249",
    cadence: "per month / location",
    description: "Launch self-serve guest bookings plus the operator console for a single venue.",
    features: ["Guest booking flow", "Confirmation emails", "Ops console access", "Email support"],
    cta: { href: "/ops/login", label: "Sign in to console" },
  },
  {
    id: "growth",
    name: "Growth",
    price: "$499",
    cadence: "per month / location",
    description: "For multi-room concepts that need table/zone controls and a full customer directory.",
    features: [
      "Table + zone management",
      "Walk-in + hold tracking",
      "Team roles & permissions",
      "Priority success manager",
    ],
    highlight: true,
    cta: { href: "/ops/login", label: "Start with Growth" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    description: "For groups needing dedicated onboarding, multi-location controls, and custom integrations.",
    features: [
      "Dedicated success engineer",
      "Multi-location reporting",
      "Custom integrations",
      "Phone + chat support",
    ],
    cta: { href: "/contact", label: "Talk to our team" },
  },
];

const FAQS = [
  {
    question: "How fast can we go live?",
    answer: "Most restaurants import covers, configure pacing, and run their first service in 10 business days.",
  },
  {
    question: "Is there a per-cover fee?",
    answer: "No. Pricing is transparent per location. We believe you should keep the revenue you create.",
  },
  {
    question: "Do you support multi-brand groups?",
    answer: "Yes. Growth and Enterprise plans include group dashboards, exports, and custom reporting.",
  },
  {
    question: "Can we self-host data?",
    answer: "Enterprise plans can push nightly exports to your warehouse and respect your data policies.",
  },
];

export const metadata: Metadata = {
  title: `${config.appName} · Pricing for restaurant owners`,
  description: "Transparent pricing for SajiloReserveX operations console, automations, and analytics.",
};

export default function PricingPage() {
  const supportEmail = config.email?.supportEmail ?? "support@example.com";

  return (
    <main className="space-y-16 bg-background text-foreground">
      <section className="border-b border-border bg-gradient-to-b from-white via-slate-50 to-white px-6 py-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 text-center">
          <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-[0.3em]">
            Pricing
          </Badge>
          <h1 className="text-balance text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
            Pick the plan that keeps ownership in your hands.
          </h1>
          <p className="text-lg text-muted-foreground">
            All plans include unlimited direct bookings, analytics, and access to the operations console. Upgrade as your group grows.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              "flex h-full flex-col border-border bg-white",
              plan.highlight ? "ring-2 ring-primary/40" : undefined,
            )}
          >
            <CardHeader className="space-y-3">
              <Badge variant="outline" className="w-fit border-border text-muted-foreground">
                {plan.name}
              </Badge>
              <CardTitle className="text-3xl font-semibold text-slate-900">
                {plan.price}
                {plan.cadence ? <span className="text-base font-normal text-muted-foreground"> {plan.cadence}</span> : null}
              </CardTitle>
              <CardDescription className="text-muted-foreground">{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-6">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary/60" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href={plan.cta.href}
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition",
                  plan.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border text-foreground hover:bg-muted",
                )}
              >
                {plan.cta.label}
              </a>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6">
        <div className="space-y-3 text-center">
          <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-[0.25em]">
            FAQ
          </Badge>
          <h2 className="text-balance text-3xl font-semibold md:text-4xl text-slate-900">Questions from operators</h2>
          <p className="text-muted-foreground">Still unsure? Email {supportEmail} and we’ll respond within one business day.</p>
        </div>
        <div className="space-y-4">
          {FAQS.map((faq) => (
            <Card key={faq.question} className="border-border bg-white">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-slate-900">{faq.question}</CardTitle>
                <CardDescription className="text-muted-foreground">{faq.answer}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl border border-border bg-white px-8 py-12 shadow-[0_45px_90px_-45px_rgba(15,23,42,0.35)]">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.2em]">
            Ready to convert
          </Badge>
          <h2 className="text-balance text-3xl font-semibold md:text-4xl text-slate-900">Long-term partnerships, not lock-in</h2>
          <p className="text-muted-foreground">
            Start by signing in to the console or loop partnerships in for a pricing review tailored to your locations.
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
