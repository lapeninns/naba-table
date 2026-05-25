import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Guest booking actions',
};

export default function GuestBookingActionsDevPage() {
  enforceDevOnly();

  return (
    <main className="guest-theme min-h-dvh bg-background px-4 py-8 text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-2 border-b border-border pb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Booking actions harness
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Old Crown Girton</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Local-only proof for guest manage and contact action panels.
          </p>
        </header>

        <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Guest Information</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Primary Guest</dt>
              <dd className="font-medium">Guest Booker</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">guest@example.com</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">+44 1234 567890</dd>
            </div>
          </dl>
        </article>
      </section>
    </main>
  );
}
