
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import config from "@/config";

import type { Metadata } from "next";

const CHECKLIST = [
  "Number of locations + service styles",
  "Current booking & waitlist tools",
  "Peak service pain points",
  "Ideal go-live window",
];

export const metadata: Metadata = {
  title: `${config.appName} · Contact our team`,
  description: "Reach the SajiloReserveX partnerships team for onboarding and pricing conversations.",
};

export default function ContactPage() {
  const supportEmail = config.email?.supportEmail ?? "support@example.com";

  return (
    <main className="bg-background px-6 py-20 text-foreground">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 text-center">
        <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-[0.3em]">
          Contact
        </Badge>
        <h1 className="text-balance text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
          Talk to real operators who ship this console.
        </h1>
        <p className="text-lg text-muted-foreground">
          Partnerships will reply within one business day. Share how you run service today and we’ll show exactly how SajiloReserveX fits.
        </p>
        <div className="flex flex-col items-center gap-4">
          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex w-full max-w-sm items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Email {supportEmail}
          </a>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Prefer calls? Include your number.</p>
        </div>
      </section>

      <section className="mx-auto mt-16 flex w-full max-w-5xl flex-col gap-6">
        <Card className="border-border bg-white">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-slate-900">When to reach out</CardTitle>
            <CardDescription className="text-muted-foreground">
              Ideal if you are consolidating tools, launching a new concept, or tired of marketplaces owning your guest data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We typically help teams that:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Run 1-25 locations with high-touch service</li>
              <li>Need a single view of bookings, walk-ins, and messaging</li>
              <li>Want automation without losing control of their voice</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border bg-white">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-slate-900">What to include</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sharing upfront context shortens onboarding dramatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-primary/60" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
