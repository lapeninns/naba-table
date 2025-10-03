import Link from "next/link";

import ButtonSignin from "@/components/ButtonSignin";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="text-lg font-semibold text-foreground">
            SajiloReserveX
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link href="/reserve" className="text-muted-foreground hover:text-foreground transition">
              Make a reservation
            </Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition">
              View dashboard
            </Link>
            <Link href="/profile/manage" className="text-muted-foreground hover:text-foreground transition">
              Manage profile
            </Link>
          </nav>

          <ButtonSignin text="Sign in" />
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto flex flex-col items-center gap-10 px-6 py-24 text-center md:px-10">
          <div className="max-w-3xl space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Hospitality CRM</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Plan, confirm, and manage reservations in seconds
            </h1>
            <p className="text-lg text-muted-foreground">
              SajiloReserveX keeps your tables full and your guests informed. Create bookings, monitor status changes, and update guest details without leaving your browser.
            </p>
          </div>

          <div className="flex w-full flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/reserve"
              className={cn(buttonVariants({ variant: "primary", size: "primary" }), 'w-full sm:w-auto')}
            >
              Start a new reservation
            </Link>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline", size: "primary" }), 'w-full sm:w-auto')}
            >
              Review upcoming bookings
            </Link>
            <Link
              href="/profile/manage"
              className={cn(buttonVariants({ variant: "ghost", size: "primary" }), 'w-full sm:w-auto')}
            >
              Update guest profile
            </Link>
          </div>

          <div className="grid w-full gap-6 rounded-3xl border border-border bg-card/80 p-8 text-left shadow-sm md:grid-cols-3">
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">Reserve in moments</h2>
              <p className="text-sm text-muted-foreground">
                Guide guests through availability, seating preferences, and confirmation emails without leaving the flow.
              </p>
              <Link href="/reserve" className="text-sm font-medium text-primary hover:underline">
                Try the booking flow →
              </Link>
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">Manage bookings centrally</h2>
              <p className="text-sm text-muted-foreground">
                Filter, edit, and cancel reservations from your dashboard with audit history and loyalty status at a glance.
              </p>
              <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
                Open the dashboard →
              </Link>
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">Keep contact info current</h2>
              <p className="text-sm text-muted-foreground">
                Upload a guest avatar, adjust names, and add reliable phone numbers so confirmations reach the right person.
              </p>
              <Link href="/profile/manage" className="text-sm font-medium text-primary hover:underline">
                Edit your profile →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
