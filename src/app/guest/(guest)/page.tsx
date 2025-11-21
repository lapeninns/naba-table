import Link from "next/link";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import { buttonVariants } from "@/components/ui/button";
import config from "@/config";
import { cn } from "@/lib/utils";

import type { Metadata } from "next";

const HIGHLIGHTS = [
  { title: "Book in seconds", copy: "Pick a time, confirm guests, and get an instant reference." },
  { title: "Stay in sync", copy: "Calendar-safe updates with email confirmations and reminders." },
  { title: "Your bookings, organized", copy: "View, edit, or cancel from bookings on any device." },
];

const STEPS = [
  { title: "Browse", copy: "Find the right restaurant and pick your date, time, and party size." },
  { title: "Confirm", copy: "Add your details, notes, and seating preferences." },
  { title: "Relax", copy: "Get instant confirmation plus a mail-back reference for easy changes." },
];

export const metadata: Metadata = {
  title: `${config.appName} - Book great tables fast`,
  description: "Reserve at SajiloReserveX partner restaurants with instant confirmation and easy changes.",
  openGraph: {
    title: `${config.appName} - Book great tables fast`,
    description: "Browse venues, hold your time, and manage bookings from one place.",
    type: "website",
  },
};

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-slate-50/30 selection:bg-primary/10 selection:text-primary flex flex-col">
      <Header />
      
      <main className="flex-1">
        <Hero />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-12 sm:px-8 lg:px-10 lg:py-16">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md"
              >
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.copy}</p>
              </article>
            ))}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8 lg:px-10 lg:py-12">
            <div className="space-y-3 text-left">
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">How it works</h2>
              <p className="text-sm text-slate-600 sm:text-base">
                A simple three-step booking flow with instant feedback and saved preferences for returning guests.
              </p>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, idx) => (
                <article
                  key={step.title}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-5"
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {idx + 1}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="text-sm text-slate-600">{step.copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Book with confidence</h2>
              <p className="mt-3 text-sm text-slate-600 sm:text-base">
                Secure your table with live availability, see pacing rules before you confirm, and keep your reference handy
                for fast changes. Every step is optimized for mobile and keyboard access.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
                  <div>
                    <p className="font-medium text-slate-900">Instant confirmation</p>
                    <p className="text-slate-600">We show you the final reference and email it immediately.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
                  <div>
                    <p className="font-medium text-slate-900">Easy changes</p>
                    <p className="text-slate-600">Modify or cancel through Bookings without calling ahead.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
                  <div>
                    <p className="font-medium text-slate-900">Thoughtful accessibility</p>
                    <p className="text-slate-600">Focus-visible styles, semantic headings, and aria-live for status updates.</p>
                  </div>
                </li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className={cn(buttonVariants({ variant: "default", size: "lg" }), "touch-manipulation")}
                  href="/restaurants"
                >
                  Find a restaurant
                </Link>
                <Link
                  className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "touch-manipulation")}
                  href="/bookings"
                >
                  View my bookings
                </Link>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm sm:p-8">
              <h3 className="text-xl font-semibold">Built for guests on the go</h3>
              <p className="mt-3 text-sm text-slate-200">
                Faster loads on mobile, large tap targets, reduced motion when requested, and predictable focus order.
              </p>
              <div className="mt-6 grid gap-4 text-sm">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="font-semibold text-white">Responsive by default</p>
                  <p className="text-slate-200">Layouts adapt from 360px to desktop without hidden actions.</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="font-semibold text-white">Reliable status</p>
                  <p className="text-slate-200">Inline validation and polite live regions for confirmations.</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="font-semibold text-white">Secure by design</p>
                  <p className="text-slate-200">Magic-link sign-in and protected booking history for your account.</p>
                </div>
              </div>
            </article>
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
