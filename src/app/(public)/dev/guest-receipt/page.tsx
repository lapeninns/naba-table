import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Guest receipt',
};

export default function GuestReceiptDevPage() {
  enforceDevOnly();

  return (
    <main className="guest-theme min-h-dvh bg-background px-4 py-8 text-foreground">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-2 border-b border-border pb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Booking receipt harness
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Radix Luma Dining Room</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Local-only proof for the guest receipt shell.
          </p>
        </header>

        <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Reservation reference
          </p>
          <p className="mt-2 font-mono text-2xl font-bold">NB5678</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep this receipt available for check-in and arrival details.
          </p>
        </article>
      </section>
    </main>
  );
}
