import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Guest dashboard',
};

export default function GuestDashboardDevPage() {
  enforceDevOnly();

  return (
    <main className="guest-theme min-h-dvh bg-background px-4 py-8 text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-2 border-b border-border pb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Guest dashboard harness
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Your bookings</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Local-only proof for dashboard booking summaries, quick links, and the current
            reservation panel.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Current reservation
            </p>
            <h2 className="mt-2 text-xl font-semibold">White Horse</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              2 guests, dinner service, receipt and manage actions available.
            </p>
          </article>

          <aside className="rounded-xl border border-border bg-muted/30 p-5">
            <h2 className="text-base font-semibold">Profile details</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Contact details and receipts stay available from the dashboard.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
