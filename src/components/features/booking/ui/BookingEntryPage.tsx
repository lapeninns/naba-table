import { ArrowRight, CalendarClock, ShieldCheck, Sparkles, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function BookingEntryPage() {
  return (
    <div className="min-h-screen bg-transparent pb-[var(--luminous-space-grand)]">
      {/* Hero — editorial full-bleed */}
      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden px-4 py-3 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[88rem]">
          <div className="luminous-panel relative overflow-hidden px-6 py-10 shadow-[var(--luminous-shadow-float)] sm:px-10 sm:py-14 lg:px-14 lg:py-20">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--luminous-primary-container)_18%,transparent),transparent_52%)]" />
            <div className="absolute -right-20 top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--luminous-primary)_10%,transparent),transparent_68%)] blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--luminous-primary-container)_6%,transparent),transparent_70%)] blur-3xl" />

            <div className="relative">
              <div className="max-w-3xl space-y-6">
                <p className="luminous-kicker animate-fade-in-up">Booking journey</p>
                <h1 className="heading-hero luminous-balance max-w-[18ch] animate-fade-in-up [animation-delay:60ms]">
                  Your table, one calm step at a time.
                </h1>
                <p className="text-body-warm luminous-copy-measure text-[1.08rem] leading-relaxed animate-fade-in-up [animation-delay:120ms]">
                  Browse venues, secure a table, and keep every follow-up in one place — without switching mental gears halfway through.
                </p>

                <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap animate-fade-in-up [animation-delay:180ms]">
                  <Button
                    asChild
                    size="lg"
                    className="luminous-cta btn-tactile min-h-[48px] rounded-[var(--luminous-radius)] px-7 text-white"
                  >
                    <Link href="/restaurants">
                      Browse restaurants
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="secondary"
                    className="luminous-secondary btn-tactile min-h-[48px] rounded-[var(--luminous-radius)] px-6"
                  >
                    <Link href="/auth/signin?redirectedFrom=/bookings">Sign in to manage</Link>
                  </Button>
                </div>
              </div>

              {/* Aside — visible on lg+, floated right with editorial offset */}
              <aside className="hidden lg:block absolute right-0 bottom-0 w-[19rem] translate-y-6 animate-fade-in-up [animation-delay:240ms]">
                <div className="luminous-glass rounded-[var(--luminous-radius-panel)] px-6 py-6">
                  <p className="luminous-kicker">Guest standard</p>
                  <div className="mt-5 space-y-5">
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">Live availability</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        The same timing language carries from venue page to final receipt.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">Quiet confidence</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        No clutter, no dead ends, no second-guessing where to go next.
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* Content — asymmetric editorial sections */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mt-[var(--luminous-space-grand)]">
        {/* Primary: Start with a venue — dominant section */}
        <section className="luminous-panel px-6 py-8 sm:px-10 sm:py-10 animate-fade-in-up [animation-delay:200ms]">
          <div className="grid gap-8 lg:grid-cols-[1fr_16rem] lg:items-start">
            <div className="space-y-5">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--luminous-radius)] bg-[var(--luminous-primary-tint)] text-primary">
                <UtensilsCrossed className="h-6 w-6" aria-hidden />
              </div>
              <div className="space-y-3">
                <p className="luminous-kicker">Start with a venue</p>
                <h2 className="heading-section max-w-[22ch]">
                  Pick a restaurant, then move through booking without leaving the guest context.
                </h2>
                <p className="text-body-warm luminous-copy-measure">
                  The booking flow stays anchored to the restaurant you chose — live timing, practical details, one clear confirmation path.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  asChild
                  size="lg"
                  className="luminous-cta btn-tactile min-h-[48px] rounded-[var(--luminous-radius)] px-7 text-white"
                >
                  <Link href="/restaurants">
                    Find a table
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Steps — vertical stack in a glass column */}
            <div className="luminous-glass rounded-[var(--luminous-radius-panel)] px-5 py-5 space-y-4">
              <p className="luminous-kicker text-[0.62rem]">How it works</p>
              <article className="luminous-card-soft rounded-[var(--luminous-radius)] px-4 py-3">
                <p className="luminous-kicker text-[0.58rem]">01</p>
                <p className="mt-1.5 text-sm font-semibold text-foreground">Choose the date</p>
              </article>
              <article className="luminous-card rounded-[var(--luminous-radius)] px-4 py-4">
                <p className="luminous-kicker text-[0.58rem]">02</p>
                <p className="mt-1.5 text-[0.94rem] font-semibold text-foreground">Refine the details</p>
                <p className="mt-1 text-xs text-muted-foreground leading-5">Party size, seating, and notes.</p>
              </article>
              <article className="luminous-card-soft rounded-[var(--luminous-radius)] px-4 py-3">
                <p className="luminous-kicker text-[0.58rem]">03</p>
                <p className="mt-1.5 text-sm font-semibold text-foreground">Confirm once</p>
              </article>
            </div>
          </div>
        </section>

        {/* Secondary: Manage bookings — supporting, narrower */}
        <section className="luminous-card mx-auto mt-[var(--luminous-space-breath)] max-w-2xl px-6 py-7 sm:px-8 sm:py-8 animate-fade-in-up [animation-delay:320ms]">
          <div className="flex flex-col items-center text-center gap-6 sm:items-start sm:text-left sm:flex-row sm:gap-8">
            <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--luminous-radius)] bg-[var(--luminous-primary-tint)] text-primary">
              <CalendarClock className="h-6 w-6" aria-hidden />
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <p className="luminous-kicker">Manage an existing plan</p>
                <h2 className="heading-subsection">
                  Review confirmed tables and changes without hunting through old emails.
                </h2>
                <p className="text-body-warm text-[0.94rem]">
                  Sign in to see your reservations, or use the latest recovery link from your booking email.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <article className="luminous-card-soft rounded-[var(--luminous-radius)] px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Signed-in view</p>
                      <p className="text-xs leading-5 text-muted-foreground">All reservations in one place.</p>
                    </div>
                  </div>
                </article>
                <article className="luminous-card-soft rounded-[var(--luminous-radius)] px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Recovery links</p>
                      <p className="text-xs leading-5 text-muted-foreground">Direct access when available.</p>
                    </div>
                  </div>
                </article>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="luminous-secondary btn-tactile min-h-[48px] rounded-[var(--luminous-radius)] px-6"
                >
                  <Link href="/guest/bookings">Open my bookings</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="luminous-ghost min-h-[48px] rounded-[var(--luminous-radius)] px-2"
                >
                  <Link href="/auth/signin?redirectedFrom=/bookings">Use sign-in</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
