import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout · SajiloReserveX",
  description: "Review the final details for your reservation and access your confirmed bookings.",
};

const CHECKOUT_STEPS = [
  {
    title: "Pick a venue",
    description: "Choose a partner restaurant with availability that matches your plans.",
  },
  {
    title: "Confirm guest details",
    description: "Add party size, contact information, and special requests so the venue is ready.",
  },
  {
    title: "Share & manage",
    description: "Receive a confirmation email and manage the booking from your dashboard.",
  },
];

export default function CheckoutGuidePage() {
  return (
    <div className="sr-container sr-stack-lg min-h-screen px-[var(--sr-space-6)] py-[var(--sr-space-8)]">
      <header className="sr-stack-md text-left">
        <span className="inline-flex w-fit items-center justify-center rounded-full bg-primary/10 px-[var(--sr-space-3)] py-[var(--sr-space-1)] text-sm font-medium text-primary">
          Checkout
        </span>
        <div className="sr-stack-sm">
          <h1 className="text-balance text-[var(--sr-font-size-3xl)] font-semibold leading-[var(--sr-line-height-tight)]">
            Finalise your reservation
          </h1>
          <p className="max-w-2xl text-[var(--sr-font-size-md)] leading-[var(--sr-line-height-relaxed)] text-[var(--sr-color-text-secondary)]">
            Follow the steps below to complete your booking. You can return here anytime to access or
            manage upcoming reservations.
          </p>
        </div>
      </header>

      <section
        role="region"
        aria-labelledby="checkout-steps-heading"
        data-testid="checkout-steps"
        className="sr-stack-md rounded-3xl border border-[var(--sr-color-border)] bg-[var(--sr-color-surface)] p-[var(--sr-space-6)] shadow-[var(--sr-shadow-lg)]"
      >
        <div className="sr-stack-sm">
          <h2
            id="checkout-steps-heading"
            className="text-[var(--sr-font-size-2xl)] font-semibold leading-[var(--sr-line-height-tight)]"
          >
            How checkout works
          </h2>
          <p className="text-[var(--sr-font-size-sm)] text-[var(--sr-color-text-secondary)]">
            We store everything securely so you can edit or cancel with a couple of taps.
          </p>
        </div>
        <ol
          data-testid="checkout-steps-list"
          className="sr-stack-md list-inside list-decimal text-left"
        >
          {CHECKOUT_STEPS.map((step) => (
            <li key={step.title} className="sr-stack-sm">
              <h3 className="text-[var(--sr-font-size-lg)] font-semibold text-[var(--sr-color-text-primary)]">
                {step.title}
              </h3>
              <p className="text-[var(--sr-font-size-sm)] text-[var(--sr-color-text-secondary)]">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap items-center gap-[var(--sr-space-3)]">
        <Link
          href="/my-bookings"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "min-w-[12rem] touch-manipulation"
          )}
        >
          View upcoming bookings
        </Link>
        <Link
          href="/create"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-w-[12rem] touch-manipulation"
          )}
        >
          Start a new reservation
        </Link>
      </div>
    </div>
  );
}
