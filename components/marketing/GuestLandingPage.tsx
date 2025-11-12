"use client";

import Link from "next/link";

import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import config from "@/config";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Search,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

const SUPPORT_EMAIL = config.email?.supportEmail ?? "support@example.com";

const STATS = [
  { value: "5,000+", label: "Partner restaurants across the country" },
  { value: "50,000+", label: "Happy diners served monthly" },
  { value: "4.8/5", label: "Average diner satisfaction rating" },
];

const FEATURES = [
  {
    title: "Instant Reservations",
    description:
      "Browse availability and book your table in real-time. Get immediate confirmation—no waiting for callbacks.",
    icon: CalendarCheck,
    bullets: ["Real-time availability", "Instant confirmation", "Flexible timing"],
  },
  {
    title: "Discover Great Dining",
    description:
      "Explore curated restaurants by cuisine, location, or occasion. Find hidden gems and local favorites.",
    icon: Search,
    bullets: ["Advanced search", "Personalized recommendations", "Verified reviews"],
  },
  {
    title: "Manage With Ease",
    description:
      "View, modify, or cancel reservations from your dashboard. Get reminders and updates via email or SMS.",
    icon: Sparkles,
    bullets: ["Reservation history", "Modification options", "Smart reminders"],
  },
  {
    title: "Dietary Preferences",
    description:
      "Save your dietary restrictions and preferences. Restaurants get notified automatically with every reservation.",
    icon: UtensilsCrossed,
    bullets: ["Allergy alerts", "Preference tracking", "Seamless communication"],
  },
];

const HOW_IT_WORKS = [
  {
    title: "Browse Restaurants",
    description: "Search by cuisine, location, or occasion. View menus, photos, and availability.",
  },
  {
    title: "Choose Your Time",
    description: "Select your preferred date and time. See real-time availability and seat options.",
  },
  {
    title: "Confirm Details",
    description: "Add party size and special requests. Get instant confirmation.",
  },
  {
    title: "Enjoy Your Meal",
    description: "Show up and enjoy. We'll handle the rest.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "SajiloReserveX made finding and booking our anniversary dinner so easy. The instant confirmation gave us peace of mind.",
    author: "Sarah Chen",
    context: "Regular diner, San Francisco",
  },
  {
    quote:
      "I love that I can manage all my reservations in one place. Modifying a booking takes seconds.",
    author: "James Rodriguez",
    context: "Frequent diner, New York",
  },
  {
    quote:
      "The dietary preference feature is a game-changer. Restaurants know about my gluten allergy before I even arrive.",
    author: "Priya Sharma",
    context: "Food enthusiast, Seattle",
  },
];

const FAQ_ITEMS = [
  {
    question: "Is SajiloReserveX free for diners?",
    answer:
      "Yes! Creating an account and making reservations is completely free for diners. You only pay for your meal at the restaurant.",
  },
  {
    question: "How do I cancel or modify a reservation?",
    answer:
      "Log into your account, go to \"My Bookings,\" and select the reservation you want to change. You can modify or cancel up to the restaurant's cancellation policy deadline.",
  },
  {
    question: "What if the restaurant doesn't honor my reservation?",
    answer:
      `This is extremely rare. If it happens, please contact us immediately at ${SUPPORT_EMAIL}. We'll work with the restaurant to resolve the issue.`,
  },
  {
    question: "Can I make a reservation for a large group?",
    answer:
      "Most restaurants support parties up to 6-8 people. For larger groups, we recommend contacting the restaurant directly or using our special requests field.",
  },
  {
    question: "Do I need to create an account to make a reservation?",
    answer:
      "Yes, an account ensures you can manage your reservations, receive reminders, and save your preferences for future bookings.",
  },
  {
    question: "How do dietary restrictions work?",
    answer:
      "Save your dietary preferences in your profile. When you make a reservation, restaurants automatically receive this information and can prepare accordingly.",
  },
];

function HeroSection() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-20 lg:flex-row lg:items-center lg:gap-16">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-white/30 text-xs uppercase tracking-[0.3em] text-white/80">
              For Diners
            </Badge>
            <span className="text-sm text-white/70">Instant Reservations · Easy Management</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-balance text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
              Find your table. Reserve in seconds. Enjoy the moment.
            </h1>
            <p className="text-lg text-white/80 md:text-xl">
              Discover the best restaurants in your city and secure your reservation instantly. No phone calls, no
              waiting—just great dining experiences.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <MarketingSessionActions
              mode="booking"
              size="lg"
              primaryVariant="secondary"
              secondaryVariant="outline"
              className="[&>a]:w-full sm:[&>a]:w-auto"
            />
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">Free for diners · No hidden fees</p>
          </div>
        </div>
        <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          {STATS.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
              <p className="text-4xl font-semibold">{stat.value}</p>
              <p className="mt-2 text-sm text-white/70">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background" />
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20">
      <div className="space-y-3 text-center">
        <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-[0.25em]">
          Features
        </Badge>
        <h2 className="text-balance text-3xl font-semibold md:text-4xl">Everything you need for great dining</h2>
        <p className="text-muted-foreground mx-auto max-w-3xl">
          From discovering restaurants to managing your reservations, SajiloReserveX makes dining out effortless.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <Card
            key={feature.title}
            className="h-full border-border/70 bg-card/80 shadow-[0px_10px_40px_-20px_rgba(15,23,42,0.4)]"
          >
            <CardHeader className="space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/40">
                <feature.icon className="h-6 w-6 text-primary" aria-hidden />
              </div>
              <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {feature.bullets.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="bg-muted/40 py-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        <div className="space-y-3 text-center">
          <Badge variant="outline" className="mx-auto w-fit uppercase tracking-[0.25em]">
            How it works
          </Badge>
          <h2 className="text-balance text-3xl font-semibold md:text-4xl">Reserve your table in four simple steps</h2>
          <p className="text-muted-foreground mx-auto max-w-3xl">
            Our streamlined process gets you from searching to dining in minutes.
          </p>
        </div>
        <ol className="grid gap-6 md:grid-cols-2">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                  {index + 1}
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20">
      <div className="space-y-3 text-center">
        <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-[0.25em]">
          Testimonials
        </Badge>
        <h2 className="text-balance text-3xl font-semibold md:text-4xl">Loved by diners everywhere</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((testimonial) => (
          <Card key={testimonial.author} className="h-full border-border/70 bg-card shadow-lg">
            <CardContent className="flex h-full flex-col gap-6 p-8">
              <p className="text-lg leading-relaxed text-foreground">"{testimonial.quote}"</p>
              <div>
                <p className="text-base font-semibold text-foreground">{testimonial.author}</p>
                <p className="text-sm text-muted-foreground">{testimonial.context}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-20">
      <div className="space-y-3 text-center">
        <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-[0.25em]">
          FAQ
        </Badge>
        <h2 className="text-balance text-3xl font-semibold md:text-4xl">Common questions from diners</h2>
        <p className="text-muted-foreground">
          Need something else? Email us any time at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-foreground">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
      <Accordion type="single" collapsible className="space-y-3">
        {FAQ_ITEMS.map((item, idx) => (
          <AccordionItem key={item.question} value={`faq-${idx}`} className="rounded-2xl border border-border/60 px-4">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="pb-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl bg-gradient-to-br from-primary/90 via-primary to-indigo-600 px-8 py-12 text-primary-foreground shadow-xl">
        <div className="space-y-3 text-center md:text-left">
          <Badge variant="secondary" className="bg-white/20 text-white">
            Ready to dine?
          </Badge>
          <h2 className="text-balance text-3xl font-semibold md:text-4xl">
            Ready to discover your next great meal?
          </h2>
          <p className="text-base text-primary-foreground/80 md:max-w-2xl">
            Join thousands of diners who trust SajiloReserveX for hassle-free reservations. Browse restaurants or sign
            in to manage your bookings.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <MarketingSessionActions
            mode="booking"
            size="lg"
            primaryVariant="secondary"
            secondaryVariant="outline"
            className="w-full md:w-auto [&>a]:w-full md:[&>a]:w-auto"
          />
          <Link
            href="/browse"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full justify-center border-white/50 text-white md:w-auto",
            )}
          >
            Explore restaurants
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function GuestLandingPage() {
  return (
    <div className="bg-background text-foreground">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <FAQSection />
      <FinalCTASection />
    </div>
  );
}
